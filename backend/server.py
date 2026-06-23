from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import uuid
import secrets
import bcrypt
import httpx
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_ANON_KEY = os.environ['SUPABASE_ANON_KEY']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
BREVO_API_KEY = os.environ['BREVO_API_KEY']
BREVO_SENDER_EMAIL = os.environ['BREVO_SENDER_EMAIL']
BREVO_SENDER_NAME = os.environ.get('BREVO_SENDER_NAME', 'RLIQ')

OTP_TTL_SECONDS = 600        # 10 minutes
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN = 60     # seconds

app = FastAPI(title="RLIQ Quiz API")
api_router = APIRouter(prefix="/api")

http_bearer = HTTPBearer(auto_error=False)


# ============== AUTH ==============
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> Dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    async with httpx.AsyncClient(timeout=10.0) as hc:
        resp = await hc.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return resp.json()


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> Optional[Dict[str, Any]]:
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


# ============== MODELS ==============
QuestionType = Literal["single", "multi", "rank", "confidence", "short"]


class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float  # seconds
    type: QuestionType
    prompt: str
    options: List[str] = Field(default_factory=list)  # for single/multi/rank
    correct: List[int] = Field(default_factory=list)  # indices (single=1, multi=N, rank=ordered)
    ideal_confidence: Optional[int] = None  # 1-5 for confidence
    explanation: str = ""


GameMode = Literal[
    "duel", "doubles", "standard", "hoops", "snowday", "rumble", "dropshot", "tournaments", "other"
]


class QuizCreate(BaseModel):
    title: str
    description: str = ""
    youtube_url: str
    difficulty: str = "rookie"  # legacy field, kept for backwards compat
    min_rank: int = 1   # 1=Bronze … 8=Supersonic Legend
    max_rank: int = 8
    game_mode: GameMode = "standard"
    is_draft: bool = False
    duration_seconds: Optional[float] = None
    questions: List[Question] = Field(default_factory=list)


class Quiz(QuizCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    video_id: str
    creator_id: str
    creator_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    play_count: int = 0


class AnswerSubmission(BaseModel):
    question_id: str
    type: QuestionType
    selected: List[int] = Field(default_factory=list)
    confidence: Optional[int] = None
    text: Optional[str] = None
    skipped: bool = False


class AttemptCreate(BaseModel):
    quiz_id: str
    answers: List[AnswerSubmission]


class Attempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quiz_id: str
    user_id: str
    user_name: str
    answers: List[Dict[str, Any]]
    score: float
    correct_count: int
    total_count: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============== HELPERS ==============
YT_REGEX = re.compile(
    r'(?:youtube\.com/(?:[^/]+/.+/|(?:v|e(?:mbed)?|shorts)/|.*[?&]v=)|youtu\.be/)([^"&?/\s]{11})'
)


def extract_youtube_id(url: str) -> Optional[str]:
    m = YT_REGEX.search(url)
    return m.group(1) if m else None


def user_display_name(user: Dict[str, Any]) -> str:
    meta = user.get("user_metadata") or {}
    return (
        meta.get("display_name")
        or meta.get("name")
        or (user.get("email") or "").split("@")[0]
        or "Player"
    )


# ============== OTP / EMAIL AUTH ==============
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


def _gen_code() -> str:
    # 6-digit numeric, zero-padded
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_code(code: str) -> str:
    return bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()


def _verify_code(code: str, code_hash: str) -> bool:
    try:
        return bcrypt.checkpw(code.encode(), code_hash.encode())
    except ValueError:
        return False


async def _supa_admin(method: str, path: str, **kwargs) -> httpx.Response:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        **kwargs.pop("headers", {}),
    }
    async with httpx.AsyncClient(timeout=15.0) as hc:
        return await hc.request(method, f"{SUPABASE_URL}{path}", headers=headers, **kwargs)


async def _find_supa_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    # Supabase admin list-users supports filter by email
    r = await _supa_admin("GET", f"/auth/v1/admin/users?email={email}")
    if r.status_code != 200:
        return None
    data = r.json()
    users = data.get("users") or []
    for u in users:
        if (u.get("email") or "").lower() == email:
            return u
    return None


async def _send_otp_email(to_email: str, code: str, purpose: str) -> None:
    """Send OTP via Brevo transactional HTTPS API."""
    is_signup = purpose == "signup"
    subject = "Verify your RLIQ account" if is_signup else "RLIQ password recovery code"
    headline = "Verify your email" if is_signup else "Reset your password"
    body_text = (
        "Welcome to RLIQ. Use the code below to confirm your email."
        if is_signup
        else "We received a password reset request for your RLIQ account."
    )
    html = f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif;color:#fff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #222;">
        <tr><td style="padding:32px;">
          <div style="font:700 13px/1.2 'Courier New',monospace;letter-spacing:.3em;color:#ff6b00;margin-bottom:8px;">/// RLIQ // {purpose.upper()}</div>
          <h1 style="font:900 28px/1.1 Arial,sans-serif;text-transform:uppercase;margin:0 0 16px;color:#fff;">{headline}</h1>
          <p style="font:14px/1.5 Arial,sans-serif;color:#a1a1aa;margin:0 0 24px;">{body_text}</p>
          <div style="background:#000;border:1px solid #ff6b00;padding:24px;text-align:center;margin:0 0 24px;">
            <div style="font:700 12px/1.2 'Courier New',monospace;letter-spacing:.25em;color:#ff6b00;margin-bottom:8px;">YOUR CODE</div>
            <div style="font:900 40px/1 'Courier New',monospace;letter-spacing:.4em;color:#fff;">{code}</div>
          </div>
          <p style="font:13px/1.5 Arial,sans-serif;color:#71717a;margin:0 0 8px;">This code expires in 10 minutes.</p>
          <p style="font:13px/1.5 Arial,sans-serif;color:#71717a;margin:0;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #222;margin:32px 0 16px;" />
          <div style="font:11px/1.4 'Courier New',monospace;letter-spacing:.2em;color:#52525b;">RLIQ // RULE #1: ALWAYS GO FOR KICKOFF.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    payload = {
        "sender": {"email": BREVO_SENDER_EMAIL, "name": BREVO_SENDER_NAME},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html,
    }
    async with httpx.AsyncClient(timeout=15.0) as hc:
        r = await hc.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": BREVO_API_KEY,
                "accept": "application/json",
                "content-type": "application/json",
            },
            json=payload,
        )
    if r.status_code >= 300:
        logging.getLogger(__name__).error("Brevo send failed: %s %s", r.status_code, r.text)
        raise HTTPException(status_code=502, detail="Could not send verification email. Try again.")


async def _store_otp(email: str, otp_type: str, code: str) -> None:
    """Upsert OTP record for (email, type). Replaces any existing one."""
    now = _now()
    doc = {
        "email": email,
        "type": otp_type,
        "code_hash": _hash_code(code),
        "attempts": 0,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=OTP_TTL_SECONDS)).isoformat(),
        "last_sent_at": now.isoformat(),
    }
    await db.verification_codes.update_one(
        {"email": email, "type": otp_type},
        {"$set": doc},
        upsert=True,
    )


# ============== AUTH MODELS ==============
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str
    type: Literal["signup", "recovery"] = "signup"


class ResendRequest(BaseModel):
    email: EmailStr
    type: Literal["signup", "recovery"] = "signup"


class ForgotRequest(BaseModel):
    email: EmailStr


class ResetRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


def grade_answer(question: Dict[str, Any], submission: AnswerSubmission) -> bool:
    if submission.skipped:
        return False
    qtype = question["type"]
    correct = question.get("correct", [])
    if qtype == "single":
        return len(submission.selected) == 1 and submission.selected == correct
    if qtype == "multi":
        return sorted(submission.selected) == sorted(correct)
    if qtype == "rank":
        return submission.selected == correct
    if qtype == "confidence":
        ideal = question.get("ideal_confidence")
        if ideal is None or submission.confidence is None:
            return False
        return abs(submission.confidence - ideal) <= 1
    if qtype == "short":
        # Short answers are reflective; count as correct if non-empty
        return bool((submission.text or "").strip())
    return False


# ============== ROUTES ==============
@api_router.get("/")
async def root():
    return {"message": "RLIQ API online"}


# ---- Custom OTP auth endpoints (Brevo email) ----
@api_router.post("/auth/signup")
async def auth_signup(payload: SignupRequest):
    email = _norm_email(payload.email)
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = await _find_supa_user_by_email(email)
    if existing:
        if existing.get("email_confirmed_at"):
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")
        # Unverified account exists — update password + metadata, resend OTP
        r = await _supa_admin(
            "PUT",
            f"/auth/v1/admin/users/{existing['id']}",
            json={
                "password": payload.password,
                "user_metadata": {"display_name": payload.display_name or email.split("@")[0]},
            },
        )
        if r.status_code >= 300:
            logging.getLogger(__name__).error("Supabase update user failed: %s", r.text)
            raise HTTPException(status_code=502, detail="Could not update account")
    else:
        r = await _supa_admin(
            "POST",
            "/auth/v1/admin/users",
            json={
                "email": email,
                "password": payload.password,
                "email_confirm": False,
                "user_metadata": {"display_name": payload.display_name or email.split("@")[0]},
            },
        )
        if r.status_code >= 300:
            logging.getLogger(__name__).error("Supabase create user failed: %s", r.text)
            raise HTTPException(status_code=502, detail="Could not create account")

    code = _gen_code()
    await _store_otp(email, "signup", code)
    await _send_otp_email(email, code, "signup")
    return {"ok": True, "message": "Verification code sent"}


@api_router.post("/auth/verify-code")
async def auth_verify_code(payload: VerifyRequest):
    email = _norm_email(payload.email)
    rec = await db.verification_codes.find_one({"email": email, "type": payload.type})
    if not rec:
        raise HTTPException(status_code=400, detail="No active code. Request a new one.")
    if rec["attempts"] >= OTP_MAX_ATTEMPTS:
        await db.verification_codes.delete_one({"_id": rec["_id"]})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Request a new code.")
    if datetime.fromisoformat(rec["expires_at"]) < _now():
        await db.verification_codes.delete_one({"_id": rec["_id"]})
        raise HTTPException(status_code=410, detail="Code expired. Request a new one.")

    if not _verify_code(payload.code.strip(), rec["code_hash"]):
        await db.verification_codes.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        remaining = OTP_MAX_ATTEMPTS - (rec["attempts"] + 1)
        raise HTTPException(
            status_code=401,
            detail=f"Incorrect code. {max(0, remaining)} attempts remaining.",
        )

    # Successful verify
    if payload.type == "signup":
        user = await _find_supa_user_by_email(email)
        if not user:
            raise HTTPException(status_code=404, detail="Account not found")
        r = await _supa_admin(
            "PUT",
            f"/auth/v1/admin/users/{user['id']}",
            json={"email_confirm": True},
        )
        if r.status_code >= 300:
            logging.getLogger(__name__).error("Supabase confirm email failed: %s", r.text)
            raise HTTPException(status_code=502, detail="Could not confirm email")
        await db.verification_codes.delete_one({"_id": rec["_id"]})
        return {"ok": True, "verified": True}

    # For recovery we keep the record around briefly so /auth/reset-password can re-verify.
    # Mark verified by extending TTL by 5 mins and zeroing attempts.
    await db.verification_codes.update_one(
        {"_id": rec["_id"]},
        {
            "$set": {
                "verified": True,
                "expires_at": (_now() + timedelta(minutes=5)).isoformat(),
                "attempts": 0,
            }
        },
    )
    return {"ok": True, "verified": True}


@api_router.post("/auth/resend-code")
async def auth_resend_code(payload: ResendRequest):
    email = _norm_email(payload.email)

    # For recovery, never leak existence — always return ok if user is unknown,
    # before any cooldown / DB lookup so timing is consistent.
    user = await _find_supa_user_by_email(email)
    if payload.type == "recovery" and not user:
        return {"ok": True}

    existing = await db.verification_codes.find_one({"email": email, "type": payload.type})
    if existing:
        last = datetime.fromisoformat(existing["last_sent_at"])
        elapsed = (_now() - last).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN:
            wait = int(OTP_RESEND_COOLDOWN - elapsed)
            raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting another code.")

    if payload.type == "signup":
        if not user:
            raise HTTPException(status_code=404, detail="No pending signup for this email")
        if user.get("email_confirmed_at"):
            raise HTTPException(status_code=409, detail="Email already verified. Sign in instead.")

    code = _gen_code()
    await _store_otp(email, payload.type, code)
    await _send_otp_email(email, code, payload.type)
    return {"ok": True}


@api_router.post("/auth/forgot-password")
async def auth_forgot_password(payload: ForgotRequest):
    email = _norm_email(payload.email)
    user = await _find_supa_user_by_email(email)
    # Do not leak whether the email exists
    if user:
        code = _gen_code()
        await _store_otp(email, "recovery", code)
        await _send_otp_email(email, code, "recovery")
    return {"ok": True, "message": "If that email is registered, a code has been sent."}


@api_router.post("/auth/reset-password")
async def auth_reset_password(payload: ResetRequest):
    email = _norm_email(payload.email)
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    rec = await db.verification_codes.find_one({"email": email, "type": "recovery"})
    if not rec:
        raise HTTPException(status_code=400, detail="No active code. Request a new one.")
    if datetime.fromisoformat(rec["expires_at"]) < _now():
        await db.verification_codes.delete_one({"_id": rec["_id"]})
        raise HTTPException(status_code=410, detail="Code expired. Request a new one.")
    if rec["attempts"] >= OTP_MAX_ATTEMPTS:
        await db.verification_codes.delete_one({"_id": rec["_id"]})
        raise HTTPException(status_code=429, detail="Too many failed attempts. Request a new code.")
    if not _verify_code(payload.code.strip(), rec["code_hash"]):
        await db.verification_codes.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        remaining = OTP_MAX_ATTEMPTS - (rec["attempts"] + 1)
        raise HTTPException(status_code=401, detail=f"Incorrect code. {max(0, remaining)} attempts remaining.")

    user = await _find_supa_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    r = await _supa_admin(
        "PUT",
        f"/auth/v1/admin/users/{user['id']}",
        json={"password": payload.new_password, "email_confirm": True},
    )
    if r.status_code >= 300:
        logging.getLogger(__name__).error("Supabase password update failed: %s", r.text)
        raise HTTPException(status_code=502, detail="Could not update password")

    await db.verification_codes.delete_one({"_id": rec["_id"]})
    return {"ok": True}


@api_router.get("/me")
async def me(user=Depends(get_current_user)):
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "display_name": user_display_name(user),
    }


@api_router.post("/quizzes", response_model=Quiz)
async def create_quiz(payload: QuizCreate, user=Depends(get_current_user)):
    video_id = extract_youtube_id(payload.youtube_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    quiz = Quiz(
        **payload.model_dump(),
        video_id=video_id,
        creator_id=user["id"],
        creator_name=user_display_name(user),
    )
    await db.quizzes.insert_one(quiz.model_dump())
    return quiz


@api_router.get("/quizzes", response_model=List[Quiz])
async def list_quizzes(
    mine: bool = False,
    include_drafts: bool = False,
    q: Optional[str] = None,
    creator: Optional[str] = None,
    min_rank: Optional[int] = None,
    max_rank: Optional[int] = None,
    min_duration: Optional[float] = None,
    max_duration: Optional[float] = None,
    game_mode: Optional[str] = None,
    user=Depends(get_optional_user),
):
    query: Dict[str, Any] = {}
    if mine:
        if not user:
            raise HTTPException(status_code=401, detail="Auth required for 'mine'")
        query["creator_id"] = user["id"]
        # Show drafts only to the creator
        if not include_drafts:
            query["$or"] = [{"is_draft": {"$ne": True}}, {"is_draft": {"$exists": False}}]
    else:
        # Public browse never sees drafts
        query["$or"] = [{"is_draft": {"$ne": True}}, {"is_draft": {"$exists": False}}]
    if q:
        query["title"] = {"$regex": re.escape(q), "$options": "i"}
    if creator:
        query["creator_name"] = {"$regex": re.escape(creator), "$options": "i"}
    if min_rank is not None:
        query["max_rank"] = {"$gte": min_rank}
    if max_rank is not None:
        query["min_rank"] = {"$lte": max_rank}
    if min_duration is not None:
        query.setdefault("duration_seconds", {})["$gte"] = min_duration
    if max_duration is not None:
        query.setdefault("duration_seconds", {})["$lte"] = max_duration
    if game_mode:
        modes = [m.strip() for m in game_mode.split(",") if m.strip()]
        if modes:
            query["game_mode"] = {"$in": modes}
    docs = await db.quizzes.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    for d in docs:
        d.setdefault("min_rank", 1)
        d.setdefault("max_rank", 8)
        d.setdefault("duration_seconds", None)
        d.setdefault("game_mode", "standard")
        d.setdefault("is_draft", False)
    return docs


@api_router.get("/quizzes/{quiz_id}", response_model=Quiz)
async def get_quiz(quiz_id: str):
    doc = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")
    doc.setdefault("min_rank", 1)
    doc.setdefault("max_rank", 8)
    doc.setdefault("duration_seconds", None)
    doc.setdefault("game_mode", "standard")
    doc.setdefault("is_draft", False)
    return doc


@api_router.get("/quizzes/{quiz_id}/leaderboard")
async def quiz_leaderboard(quiz_id: str, limit: int = 25):
    quiz = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0, "id": 1})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    # For each user, take their BEST attempt on this quiz
    pipeline = [
        {"$match": {"quiz_id": quiz_id}},
        {"$sort": {"score": -1, "created_at": 1}},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "score": {"$first": "$score"},
            "correct_count": {"$first": "$correct_count"},
            "total_count": {"$first": "$total_count"},
            "attempt_id": {"$first": "$id"},
            "created_at": {"$first": "$created_at"},
        }},
        {"$sort": {"score": -1, "created_at": 1}},
        {"$limit": min(max(limit, 1), 100)},
    ]
    rows = []
    rank = 0
    async for r in db.attempts.aggregate(pipeline):
        rank += 1
        rows.append({
            "rank": rank,
            "user_id": r["_id"],
            "user_name": r.get("user_name", ""),
            "score": r["score"],
            "correct_count": r.get("correct_count", 0),
            "total_count": r.get("total_count", 0),
            "attempt_id": r.get("attempt_id"),
            "created_at": r.get("created_at"),
        })
    return {"quiz_id": quiz_id, "entries": rows}


@api_router.put("/quizzes/{quiz_id}", response_model=Quiz)
async def update_quiz(quiz_id: str, payload: QuizCreate, user=Depends(get_current_user)):
    existing = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if existing["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    video_id = extract_youtube_id(payload.youtube_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    update = payload.model_dump()
    update["video_id"] = video_id
    await db.quizzes.update_one({"id": quiz_id}, {"$set": update})
    merged = {**existing, **update}
    return merged


@api_router.delete("/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: str, user=Depends(get_current_user)):
    existing = await db.quizzes.find_one({"id": quiz_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if existing["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not the owner")
    await db.quizzes.delete_one({"id": quiz_id})
    return {"ok": True}


@api_router.post("/attempts", response_model=Attempt)
async def submit_attempt(payload: AttemptCreate, user=Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"id": payload.quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions_by_id = {q["id"]: q for q in quiz["questions"]}
    graded_answers = []
    correct_count = 0
    total = len(quiz["questions"])
    for sub in payload.answers:
        q = questions_by_id.get(sub.question_id)
        if not q:
            continue
        is_correct = grade_answer(q, sub)
        if is_correct:
            correct_count += 1
        graded_answers.append({
            **sub.model_dump(),
            "correct": is_correct,
            "correct_answer": q.get("correct"),
            "ideal_confidence": q.get("ideal_confidence"),
            "explanation": q.get("explanation", ""),
        })
    score = (correct_count / total * 100.0) if total else 0.0
    attempt = Attempt(
        quiz_id=payload.quiz_id,
        user_id=user["id"],
        user_name=user_display_name(user),
        answers=graded_answers,
        score=round(score, 1),
        correct_count=correct_count,
        total_count=total,
    )
    await db.attempts.insert_one(attempt.model_dump())
    await db.quizzes.update_one({"id": payload.quiz_id}, {"$inc": {"play_count": 1}})
    return attempt


@api_router.get("/attempts/{attempt_id}", response_model=Attempt)
async def get_attempt(attempt_id: str, user=Depends(get_current_user)):
    doc = await db.attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your attempt")
    return doc


@api_router.get("/me/attempts")
async def my_attempts(user=Depends(get_current_user)):
    """Return attempts joined with quiz title/video_id for the history tab."""
    attempts = await db.attempts.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    quiz_ids = list({a["quiz_id"] for a in attempts})
    quizzes = await db.quizzes.find(
        {"id": {"$in": quiz_ids}}, {"_id": 0, "id": 1, "title": 1, "video_id": 1, "creator_name": 1}
    ).to_list(len(quiz_ids))
    quiz_map = {q["id"]: q for q in quizzes}
    out = []
    for a in attempts:
        q = quiz_map.get(a["quiz_id"])
        out.append({
            "id": a["id"],
            "quiz_id": a["quiz_id"],
            "score": a["score"],
            "correct_count": a["correct_count"],
            "total_count": a["total_count"],
            "created_at": a["created_at"],
            "quiz_title": q["title"] if q else "(deleted quiz)",
            "video_id": q["video_id"] if q else None,
            "creator_name": q["creator_name"] if q else "",
        })
    return out


# ============== FAVORITES ==============
@api_router.get("/me/favorites")
async def my_favorites(user=Depends(get_current_user)):
    doc = await db.favorites.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    quiz_ids = doc.get("quiz_ids", [])
    creator_ids = doc.get("creator_ids", [])
    # Fetch full quiz docs for favorited quizzes
    quizzes = []
    if quiz_ids:
        quizzes = await db.quizzes.find({"id": {"$in": quiz_ids}}, {"_id": 0}).to_list(200)
        for d in quizzes:
            d.setdefault("min_rank", 1)
            d.setdefault("max_rank", 8)
            d.setdefault("duration_seconds", None)
    # Aggregate creator info (just id + name + quiz count) from quizzes collection
    creators = []
    if creator_ids:
        pipeline = [
            {"$match": {"creator_id": {"$in": creator_ids}}},
            {"$group": {
                "_id": "$creator_id",
                "creator_name": {"$first": "$creator_name"},
                "quiz_count": {"$sum": 1},
            }},
        ]
        async for c in db.quizzes.aggregate(pipeline):
            creators.append({
                "creator_id": c["_id"],
                "creator_name": c["creator_name"],
                "quiz_count": c["quiz_count"],
            })
    return {
        "quiz_ids": quiz_ids,
        "creator_ids": creator_ids,
        "quizzes": quizzes,
        "creators": creators,
    }


@api_router.post("/me/favorites/quizzes/{quiz_id}")
async def favorite_quiz(quiz_id: str, user=Depends(get_current_user)):
    q = await db.quizzes.find_one({"id": quiz_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    await db.favorites.update_one(
        {"user_id": user["id"]},
        {"$addToSet": {"quiz_ids": quiz_id}},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/me/favorites/quizzes/{quiz_id}")
async def unfavorite_quiz(quiz_id: str, user=Depends(get_current_user)):
    await db.favorites.update_one(
        {"user_id": user["id"]},
        {"$pull": {"quiz_ids": quiz_id}},
    )
    return {"ok": True}


@api_router.post("/me/favorites/creators/{creator_id}")
async def favorite_creator(creator_id: str, user=Depends(get_current_user)):
    await db.favorites.update_one(
        {"user_id": user["id"]},
        {"$addToSet": {"creator_ids": creator_id}},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/me/favorites/creators/{creator_id}")
async def unfavorite_creator(creator_id: str, user=Depends(get_current_user)):
    await db.favorites.update_one(
        {"user_id": user["id"]},
        {"$pull": {"creator_ids": creator_id}},
    )
    return {"ok": True}


@api_router.get("/me/stats")
async def my_stats(user=Depends(get_current_user)):
    attempts = await db.attempts.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    created = await db.quizzes.count_documents({"creator_id": user["id"]})
    if not attempts:
        return {
            "attempts": 0,
            "avg_score": 0.0,
            "best_score": 0.0,
            "quizzes_created": created,
        }
    avg = sum(a["score"] for a in attempts) / len(attempts)
    best = max(a["score"] for a in attempts)
    return {
        "attempts": len(attempts),
        "avg_score": round(avg, 1),
        "best_score": round(best, 1),
        "quizzes_created": created,
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
