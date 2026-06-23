"""Iteration 6: game_mode, drafts, leaderboard tests."""
import os
import requests
import pytest

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or 'https://replay-quiz-1.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

SUPABASE_URL = os.environ.get('SUPABASE_URL') or "https://iavfegyovaictppxrrvz.supabase.co"
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')

CREATOR_EMAIL = "creator@rocketsense.test"
CREATOR_PASSWORD = "RocketTest123!"
PLAYER_EMAIL = "player@rocketsense.test"
PLAYER_PASSWORD = "RocketTest123!"


def _get_token(email, password):
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
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def creator_auth():
    return {"Authorization": f"Bearer {_get_token(CREATOR_EMAIL, CREATOR_PASSWORD)}"}


@pytest.fixture(scope="module")
def player_auth():
    return {"Authorization": f"Bearer {_get_token(PLAYER_EMAIL, PLAYER_PASSWORD)}"}


@pytest.fixture(scope="module")
def hoops_quiz_id(creator_auth):
    payload = {
        "title": "TEST_HoopsQuiz_GameMode",
        "description": "hoops mode test",
        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "min_rank": 1, "max_rank": 8,
        "game_mode": "hoops",
        "is_draft": False,
        "questions": [{
            "timestamp": 5.0, "type": "single", "prompt": "Q",
            "options": ["a", "b"], "correct": [0], "explanation": ""
        }],
    }
    r = requests.post(f"{API}/quizzes", json=payload, headers=creator_auth, timeout=15)
    assert r.status_code == 200, r.text
    qid = r.json()["id"]
    yield qid
    requests.delete(f"{API}/quizzes/{qid}", headers=creator_auth, timeout=15)


@pytest.fixture(scope="module")
def draft_quiz_id(creator_auth):
    payload = {
        "title": "TEST_DraftQuiz_HiddenFromBrowse",
        "description": "draft test",
        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "min_rank": 1, "max_rank": 8,
        "game_mode": "duel",
        "is_draft": True,
        "questions": [{
            "timestamp": 5.0, "type": "single", "prompt": "Q",
            "options": ["a", "b"], "correct": [0], "explanation": ""
        }],
    }
    r = requests.post(f"{API}/quizzes", json=payload, headers=creator_auth, timeout=15)
    assert r.status_code == 200, r.text
    qid = r.json()["id"]
    assert r.json()["is_draft"] is True
    assert r.json()["game_mode"] == "duel"
    yield qid
    requests.delete(f"{API}/quizzes/{qid}", headers=creator_auth, timeout=15)


# ---- POST/GET game_mode + is_draft persistence ----
def test_create_quiz_persists_game_mode_and_is_draft(hoops_quiz_id):
    r = requests.get(f"{API}/quizzes/{hoops_quiz_id}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["game_mode"] == "hoops"
    assert d["is_draft"] is False


def test_create_draft_persists(draft_quiz_id):
    r = requests.get(f"{API}/quizzes/{draft_quiz_id}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["is_draft"] is True
    assert d["game_mode"] == "duel"


# ---- Legacy backfill: game_mode='standard', is_draft=False ----
def test_legacy_backfill():
    r = requests.get(f"{API}/quizzes", timeout=15)
    assert r.status_code == 200
    for q in r.json():
        assert "game_mode" in q
        assert "is_draft" in q
        assert q["is_draft"] is False  # public browse hides drafts


# ---- Filter by single game_mode ----
def test_filter_by_single_game_mode(hoops_quiz_id):
    r = requests.get(f"{API}/quizzes?game_mode=hoops", timeout=15)
    assert r.status_code == 200
    lst = r.json()
    ids = [q["id"] for q in lst]
    assert hoops_quiz_id in ids
    for q in lst:
        assert q["game_mode"] == "hoops"


def test_filter_by_game_mode_no_match():
    r = requests.get(f"{API}/quizzes?game_mode=snowday", timeout=15)
    assert r.status_code == 200
    for q in r.json():
        assert q["game_mode"] == "snowday"


# ---- Filter by multiple game_modes (OR / comma separated) ----
def test_filter_by_multi_game_mode(hoops_quiz_id):
    r = requests.get(f"{API}/quizzes?game_mode=hoops,duel", timeout=15)
    assert r.status_code == 200
    lst = r.json()
    ids = [q["id"] for q in lst]
    assert hoops_quiz_id in ids
    for q in lst:
        assert q["game_mode"] in ("hoops", "duel")


# ---- Combined filter ----
def test_filter_combined_game_mode_and_rank(hoops_quiz_id):
    r = requests.get(f"{API}/quizzes?game_mode=hoops&min_rank=1&max_rank=8", timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert hoops_quiz_id in ids


# ---- Drafts hidden from public Browse ----
def test_draft_hidden_from_public_browse(draft_quiz_id):
    r = requests.get(f"{API}/quizzes", timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert draft_quiz_id not in ids, "Draft must NOT appear in public browse"


def test_draft_hidden_with_game_mode_filter(draft_quiz_id):
    r = requests.get(f"{API}/quizzes?game_mode=duel", timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert draft_quiz_id not in ids


# ---- mine=true without include_drafts hides drafts ----
def test_mine_without_include_drafts_hides_drafts(creator_auth, draft_quiz_id):
    r = requests.get(f"{API}/quizzes?mine=true", headers=creator_auth, timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert draft_quiz_id not in ids


# ---- mine=true&include_drafts=true SHOWS drafts to creator ----
def test_mine_with_include_drafts_shows_drafts(creator_auth, draft_quiz_id):
    r = requests.get(f"{API}/quizzes?mine=true&include_drafts=true", headers=creator_auth, timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert draft_quiz_id in ids


# ---- Draft is not visible to OTHER user via mine=true (creator_id filter) ----
def test_draft_not_visible_to_other_user(player_auth, draft_quiz_id):
    # Other user's mine=true never returns the creator's draft
    r = requests.get(f"{API}/quizzes?mine=true&include_drafts=true", headers=player_auth, timeout=15)
    assert r.status_code == 200
    ids = [q["id"] for q in r.json()]
    assert draft_quiz_id not in ids


# ---- Direct GET of draft by id still works (no auth check on detail) ----
def test_draft_detail_still_fetchable(draft_quiz_id):
    r = requests.get(f"{API}/quizzes/{draft_quiz_id}", timeout=15)
    assert r.status_code == 200
    assert r.json()["is_draft"] is True


# ---- Leaderboard structure ----
def test_leaderboard_returns_proper_structure(creator_auth, hoops_quiz_id):
    # Submit an attempt so leaderboard has entries
    quiz = requests.get(f"{API}/quizzes/{hoops_quiz_id}", timeout=15).json()
    qid = quiz["questions"][0]["id"]
    sub = {"quiz_id": hoops_quiz_id, "answers": [{"question_id": qid, "type": "single", "selected": [0]}]}
    a = requests.post(f"{API}/attempts", json=sub, headers=creator_auth, timeout=15)
    assert a.status_code == 200

    r = requests.get(f"{API}/quizzes/{hoops_quiz_id}/leaderboard", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["quiz_id"] == hoops_quiz_id
    assert "entries" in data
    assert len(data["entries"]) >= 1
    entry = data["entries"][0]
    for k in ("rank", "user_id", "user_name", "score", "correct_count", "total_count", "attempt_id", "created_at"):
        assert k in entry, f"Missing key {k}"
    assert entry["rank"] == 1


# ---- Leaderboard: each user appears at most once (their best attempt) ----
def test_leaderboard_dedupes_per_user(creator_auth, hoops_quiz_id):
    # Submit a second attempt (will have same 100%, but should still only count once)
    quiz = requests.get(f"{API}/quizzes/{hoops_quiz_id}", timeout=15).json()
    qid = quiz["questions"][0]["id"]
    sub = {"quiz_id": hoops_quiz_id, "answers": [{"question_id": qid, "type": "single", "selected": [0]}]}
    requests.post(f"{API}/attempts", json=sub, headers=creator_auth, timeout=15)

    r = requests.get(f"{API}/quizzes/{hoops_quiz_id}/leaderboard", timeout=15)
    data = r.json()
    user_ids = [e["user_id"] for e in data["entries"]]
    assert len(user_ids) == len(set(user_ids)), "Each user should appear at most once"


# ---- Leaderboard sorted by score desc ----
def test_leaderboard_sorted_desc(hoops_quiz_id):
    r = requests.get(f"{API}/quizzes/{hoops_quiz_id}/leaderboard", timeout=15)
    data = r.json()
    scores = [e["score"] for e in data["entries"]]
    assert scores == sorted(scores, reverse=True)


# ---- Leaderboard 404 for nonexistent quiz ----
def test_leaderboard_not_found():
    r = requests.get(f"{API}/quizzes/does-not-exist-xyz/leaderboard", timeout=15)
    assert r.status_code == 404


# ---- Leaderboard limit cap ----
def test_leaderboard_limit_param(hoops_quiz_id):
    r = requests.get(f"{API}/quizzes/{hoops_quiz_id}/leaderboard?limit=5", timeout=15)
    assert r.status_code == 200
    assert len(r.json()["entries"]) <= 5
