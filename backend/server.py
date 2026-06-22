from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_ANON_KEY = os.environ['SUPABASE_ANON_KEY']

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


class QuizCreate(BaseModel):
    title: str
    description: str = ""
    youtube_url: str
    difficulty: str = "rookie"  # rookie / all-star / grand-champ
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
async def list_quizzes(mine: bool = False, user=Depends(get_optional_user)):
    query: Dict[str, Any] = {}
    if mine:
        if not user:
            raise HTTPException(status_code=401, detail="Auth required for 'mine'")
        query["creator_id"] = user["id"]
    docs = await db.quizzes.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/quizzes/{quiz_id}", response_model=Quiz)
async def get_quiz(quiz_id: str):
    doc = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return doc


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


@api_router.get("/me/attempts", response_model=List[Attempt])
async def my_attempts(user=Depends(get_current_user)):
    docs = await db.attempts.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return docs


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
