"""Iteration 5: filters, favorites, hydrated /me/attempts tests."""
import os
import time
import requests
import pytest

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or 'https://replay-quiz-1.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

SUPABASE_URL = os.environ.get('SUPABASE_URL') or "https://iavfegyovaictppxrrvz.supabase.co"
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')

CREATOR_EMAIL = "creator@rocketsense.test"
CREATOR_PASSWORD = "RocketTest123!"


@pytest.fixture(scope="module")
def token():
    """Sign in via Supabase to get an access_token."""
    # Try to read anon key from backend .env if not in env
    key = SUPABASE_ANON_KEY
    if not key:
        with open('/app/backend/.env') as f:
            for line in f:
                if line.startswith('SUPABASE_ANON_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": key, "Content-Type": "application/json"},
        json={"email": CREATOR_EMAIL, "password": CREATOR_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def created_quiz_id(auth):
    """Create a quiz with min_rank=5, max_rank=8, duration_seconds=210.5"""
    payload = {
        "title": "TEST_FilterTarget_RankRange",
        "description": "filter target",
        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "min_rank": 5,
        "max_rank": 8,
        "duration_seconds": 210.5,
        "questions": [{
            "timestamp": 10.0, "type": "single", "prompt": "Q1",
            "options": ["a", "b"], "correct": [0], "explanation": ""
        }],
    }
    r = requests.post(f"{API}/quizzes", json=payload, headers=auth, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["min_rank"] == 5
    assert data["max_rank"] == 8
    assert data["duration_seconds"] == 210.5
    qid = data["id"]
    yield qid
    # cleanup
    requests.delete(f"{API}/quizzes/{qid}", headers=auth, timeout=15)


# ---- Quiz creation with new fields persistence ----
def test_create_quiz_persists_new_fields(auth, created_quiz_id):
    r = requests.get(f"{API}/quizzes/{created_quiz_id}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["min_rank"] == 5
    assert d["max_rank"] == 8
    assert d["duration_seconds"] == 210.5


# ---- Legacy backfill ----
def test_legacy_quizzes_have_rank_defaults():
    r = requests.get(f"{API}/quizzes", timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) > 0
    for q in lst:
        assert "min_rank" in q and isinstance(q["min_rank"], int)
        assert "max_rank" in q and isinstance(q["max_rank"], int)
        assert 1 <= q["min_rank"] <= 8
        assert 1 <= q["max_rank"] <= 8


# ---- Filter: q (title search) ----
def test_filter_by_q(created_quiz_id):
    r = requests.get(f"{API}/quizzes?q=TEST_FilterTarget", timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert created_quiz_id in ids
    # negative
    r2 = requests.get(f"{API}/quizzes?q=NonExistentZZZ123", timeout=15)
    assert r2.status_code == 200
    assert r2.json() == []


# ---- Filter: creator name ----
def test_filter_by_creator(created_quiz_id):
    r = requests.get(f"{API}/quizzes?creator=creator", timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert created_quiz_id in ids


# ---- Filter: rank overlap ----
def test_filter_min_rank_overlap(created_quiz_id):
    # Our quiz is rank 5-8; min_rank=5 filter should INCLUDE it
    r = requests.get(f"{API}/quizzes?min_rank=5", timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert created_quiz_id in ids


def test_filter_max_rank_overlap(created_quiz_id):
    # max_rank filter=4 means user looking for quizzes up to platinum;
    # our quiz min_rank=5, so it should NOT appear
    r = requests.get(f"{API}/quizzes?max_rank=4", timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert created_quiz_id not in ids


def test_filter_combined_rank(created_quiz_id):
    # min=5 max=8 should include our quiz
    r = requests.get(f"{API}/quizzes?min_rank=5&max_rank=8", timeout=15)
    assert created_quiz_id in [q["id"] for q in r.json()]


# ---- Filter: duration ----
def test_filter_min_duration_excludes(created_quiz_id):
    # min_duration=999 sec → nothing matches
    r = requests.get(f"{API}/quizzes?min_duration=999", timeout=15)
    assert r.status_code == 200
    assert created_quiz_id not in [q["id"] for q in r.json()]


def test_filter_max_duration_includes(created_quiz_id):
    # max_duration=300 → our 210.5s quiz should match
    r = requests.get(f"{API}/quizzes?max_duration=300", timeout=15)
    assert r.status_code == 200
    assert created_quiz_id in [q["id"] for q in r.json()]


def test_filter_combined_all(created_quiz_id):
    r = requests.get(
        f"{API}/quizzes?q=TEST_FilterTarget&min_rank=5&max_rank=8&min_duration=100&max_duration=300",
        timeout=15,
    )
    assert r.status_code == 200
    assert created_quiz_id in [q["id"] for q in r.json()]


# ---- Hydrated /me/attempts ----
def test_me_attempts_hydrated(auth, created_quiz_id):
    # Create an attempt first
    quiz = requests.get(f"{API}/quizzes/{created_quiz_id}", timeout=15).json()
    qid = quiz["questions"][0]["id"]
    sub = {
        "quiz_id": created_quiz_id,
        "answers": [{"question_id": qid, "type": "single", "selected": [0]}],
    }
    r = requests.post(f"{API}/attempts", json=sub, headers=auth, timeout=15)
    assert r.status_code == 200

    r2 = requests.get(f"{API}/me/attempts", headers=auth, timeout=15)
    assert r2.status_code == 200
    arr = r2.json()
    assert isinstance(arr, list)
    assert len(arr) > 0
    item = arr[0]
    for k in ("id", "quiz_id", "score", "correct_count", "total_count",
              "created_at", "quiz_title", "video_id", "creator_name"):
        assert k in item, f"Missing key {k} in /me/attempts item"


def test_me_attempts_requires_auth():
    r = requests.get(f"{API}/me/attempts", timeout=15)
    assert r.status_code == 401


# ---- Favorites ----
def test_favorite_quiz_idempotent(auth, created_quiz_id):
    # Add twice
    r1 = requests.post(f"{API}/me/favorites/quizzes/{created_quiz_id}", headers=auth, timeout=15)
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/me/favorites/quizzes/{created_quiz_id}", headers=auth, timeout=15)
    assert r2.status_code == 200

    favs = requests.get(f"{API}/me/favorites", headers=auth, timeout=15).json()
    assert favs["quiz_ids"].count(created_quiz_id) == 1
    assert any(q["id"] == created_quiz_id for q in favs["quizzes"])

    # delete
    requests.delete(f"{API}/me/favorites/quizzes/{created_quiz_id}", headers=auth, timeout=15)
    favs2 = requests.get(f"{API}/me/favorites", headers=auth, timeout=15).json()
    assert created_quiz_id not in favs2["quiz_ids"]


def test_favorite_creator_idempotent(auth):
    # Use the current user id as a creator id (it's also a creator)
    me = requests.get(f"{API}/me", headers=auth, timeout=15).json()
    cid = me["id"]
    r1 = requests.post(f"{API}/me/favorites/creators/{cid}", headers=auth, timeout=15)
    r2 = requests.post(f"{API}/me/favorites/creators/{cid}", headers=auth, timeout=15)
    assert r1.status_code == 200 and r2.status_code == 200

    favs = requests.get(f"{API}/me/favorites", headers=auth, timeout=15).json()
    assert favs["creator_ids"].count(cid) == 1
    # creators list should have entry with creator_id == cid (since they own quizzes)
    assert any(c["creator_id"] == cid for c in favs["creators"])

    requests.delete(f"{API}/me/favorites/creators/{cid}", headers=auth, timeout=15)


def test_favorites_requires_auth():
    r = requests.get(f"{API}/me/favorites", timeout=15)
    assert r.status_code == 401
    r2 = requests.post(f"{API}/me/favorites/quizzes/any-id", timeout=15)
    assert r2.status_code == 401


def test_favorite_quiz_not_found(auth):
    r = requests.post(f"{API}/me/favorites/quizzes/does-not-exist-xyz", headers=auth, timeout=15)
    assert r.status_code == 404
