"""OTP auth flow tests — signup, verify, resend, forgot, reset."""
import os
import time
import bcrypt
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

# Load backend env (MONGO_URL, DB_NAME) so we can connect locally
load_dotenv(Path(__file__).resolve().parents[1] / '.env')

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
    # Fall back to frontend .env
    fenv = Path(__file__).resolve().parents[2] / 'frontend' / '.env'
    for line in fenv.read_text().splitlines():
        if line.startswith('REACT_APP_BACKEND_URL'):
            BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
API = f"{BASE_URL}/api"

MONGO = MongoClient(os.environ['MONGO_URL'])
DB = MONGO[os.environ['DB_NAME']]

TS = int(time.time())
TEST_EMAIL_SIGNUP = f"effectifyui+rliqtest{TS}@gmail.com"
TEST_PASSWORD = "RliqTest123!"
NEW_PASSWORD = "RliqNewPass456!"


def _inject_code(email: str, otp_type: str, code: str, attempts: int = 0):
    """Replace the OTP record with a known code so we can verify the happy path."""
    now = datetime.now(timezone.utc)
    hashed = bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()
    DB.verification_codes.update_one(
        {"email": email, "type": otp_type},
        {"$set": {
            "email": email,
            "type": otp_type,
            "code_hash": hashed,
            "attempts": attempts,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(minutes=10)).isoformat(),
            "last_sent_at": (now - timedelta(seconds=120)).isoformat(),  # bypass cooldown
        }},
        upsert=True,
    )


# --- Root sanity ---
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("message") == "RLIQ API online"


# --- Signup ---
def test_signup_password_too_short():
    r = requests.post(f"{API}/auth/signup", json={
        "email": f"shortpw+{TS}@example.com",
        "password": "abc",
        "display_name": "Short",
    }, timeout=20)
    assert r.status_code == 400


def test_signup_success_creates_db_record():
    r = requests.post(f"{API}/auth/signup", json={
        "email": TEST_EMAIL_SIGNUP,
        "password": TEST_PASSWORD,
        "display_name": "RliqTester",
    }, timeout=30)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("ok") is True
    assert "sent" in (data.get("message") or "").lower()

    # Verify DB record
    rec = DB.verification_codes.find_one({"email": TEST_EMAIL_SIGNUP, "type": "signup"})
    assert rec is not None, "DB record not created"
    assert rec["attempts"] == 0
    assert rec["code_hash"].startswith("$2"), "code should be bcrypt-hashed"
    assert "424242" not in rec["code_hash"]
    # plaintext not stored
    assert "code" not in rec or not isinstance(rec.get("code"), str) or len(rec.get("code", "")) != 6
    exp = datetime.fromisoformat(rec["expires_at"])
    now = datetime.now(timezone.utc)
    delta = (exp - now).total_seconds()
    assert 500 <= delta <= 700, f"expires_at not ~10min ahead: {delta}s"


def test_signup_duplicate_unverified_succeeds():
    """Second signup with same email (unverified) should succeed and resend code."""
    r = requests.post(f"{API}/auth/signup", json={
        "email": TEST_EMAIL_SIGNUP,
        "password": TEST_PASSWORD,
        "display_name": "RliqTester2",
    }, timeout=30)
    assert r.status_code == 200, f"duplicate unverified signup should succeed: {r.status_code} {r.text}"


# --- Resend cooldown ---
def test_resend_within_cooldown_returns_429():
    r = requests.post(f"{API}/auth/resend-code", json={
        "email": TEST_EMAIL_SIGNUP, "type": "signup",
    }, timeout=20)
    assert r.status_code == 429, f"expected 429 cooldown, got {r.status_code} {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert "wait" in detail and "before" in detail


# --- Verify wrong code ---
def test_verify_wrong_code_increments_attempts():
    # Reset attempts to 0 first via injection so we have a deterministic count
    _inject_code(TEST_EMAIL_SIGNUP, "signup", "111111", attempts=0)
    r = requests.post(f"{API}/auth/verify-code", json={
        "email": TEST_EMAIL_SIGNUP, "code": "999999", "type": "signup",
    }, timeout=20)
    assert r.status_code == 401, f"expected 401, got {r.status_code}"
    detail = r.json().get("detail") or ""
    assert "Incorrect code" in detail and "attempts remaining" in detail
    rec = DB.verification_codes.find_one({"email": TEST_EMAIL_SIGNUP, "type": "signup"})
    assert rec["attempts"] == 1


# --- Verify happy path (DB-injected code) ---
def test_verify_correct_code_marks_email_confirmed():
    _inject_code(TEST_EMAIL_SIGNUP, "signup", "424242", attempts=0)
    r = requests.post(f"{API}/auth/verify-code", json={
        "email": TEST_EMAIL_SIGNUP, "code": "424242", "type": "signup",
    }, timeout=30)
    assert r.status_code == 200, f"verify happy path failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("ok") is True and data.get("verified") is True
    # OTP record should be deleted after success
    rec = DB.verification_codes.find_one({"email": TEST_EMAIL_SIGNUP, "type": "signup"})
    assert rec is None, "OTP record should be deleted after successful verify"


# --- Sign in via Supabase with original password works ---
def test_signin_after_verification_works():
    sup_url = os.environ['SUPABASE_URL']
    anon = os.environ['SUPABASE_ANON_KEY']
    r = requests.post(
        f"{sup_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon, "Content-Type": "application/json"},
        json={"email": TEST_EMAIL_SIGNUP, "password": TEST_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"signin failed: {r.status_code} {r.text}"
    assert "access_token" in r.json()


# --- Already-verified account: second signup returns 409 ---
def test_signup_already_verified_returns_409():
    r = requests.post(f"{API}/auth/signup", json={
        "email": TEST_EMAIL_SIGNUP,
        "password": TEST_PASSWORD,
        "display_name": "x",
    }, timeout=30)
    assert r.status_code == 409, f"expected 409 already verified, got {r.status_code} {r.text}"


# --- Forgot password ---
def test_forgot_password_unregistered_silent_ok():
    r = requests.post(f"{API}/auth/forgot-password", json={
        "email": f"nobody+rliq{TS}@example.com",
    }, timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_forgot_password_registered_ok():
    r = requests.post(f"{API}/auth/forgot-password", json={
        "email": TEST_EMAIL_SIGNUP,
    }, timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    rec = DB.verification_codes.find_one({"email": TEST_EMAIL_SIGNUP, "type": "recovery"})
    assert rec is not None, "recovery OTP record should exist"


# --- Reset password happy path ---
def test_reset_password_changes_password():
    _inject_code(TEST_EMAIL_SIGNUP, "recovery", "555555", attempts=0)
    r = requests.post(f"{API}/auth/reset-password", json={
        "email": TEST_EMAIL_SIGNUP,
        "code": "555555",
        "new_password": NEW_PASSWORD,
    }, timeout=30)
    assert r.status_code == 200, f"reset failed: {r.status_code} {r.text}"
    assert r.json().get("ok") is True

    sup_url = os.environ['SUPABASE_URL']
    anon = os.environ['SUPABASE_ANON_KEY']
    # NEW password works
    rn = requests.post(
        f"{sup_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon, "Content-Type": "application/json"},
        json={"email": TEST_EMAIL_SIGNUP, "password": NEW_PASSWORD},
        timeout=15,
    )
    assert rn.status_code == 200, f"new password should work: {rn.status_code} {rn.text}"
    # OLD password fails
    ro = requests.post(
        f"{sup_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon, "Content-Type": "application/json"},
        json={"email": TEST_EMAIL_SIGNUP, "password": TEST_PASSWORD},
        timeout=15,
    )
    assert ro.status_code in (400, 401), f"old password should fail: {ro.status_code} {ro.text}"


def test_reset_password_record_deleted_after_success():
    rec = DB.verification_codes.find_one({"email": TEST_EMAIL_SIGNUP, "type": "recovery"})
    assert rec is None, "recovery OTP should be deleted after successful reset"


# --- Cleanup test user from Supabase ---
def test_zz_cleanup_test_user():
    sup_url = os.environ['SUPABASE_URL']
    svc = os.environ['SUPABASE_SERVICE_KEY']
    # find
    r = requests.get(
        f"{sup_url}/auth/v1/admin/users?email={TEST_EMAIL_SIGNUP}",
        headers={"apikey": svc, "Authorization": f"Bearer {svc}"},
        timeout=15,
    )
    if r.status_code == 200:
        users = r.json().get("users") or []
        for u in users:
            if (u.get("email") or "").lower() == TEST_EMAIL_SIGNUP.lower():
                requests.delete(
                    f"{sup_url}/auth/v1/admin/users/{u['id']}",
                    headers={"apikey": svc, "Authorization": f"Bearer {svc}"},
                    timeout=15,
                )
    DB.verification_codes.delete_many({"email": TEST_EMAIL_SIGNUP})
    assert True
