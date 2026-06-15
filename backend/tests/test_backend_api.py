"""Backend smoke tests for RL Quiz API."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://replay-quiz-1.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


# Root health
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("message") == "RL Quiz API online"


# Public listing works without auth
def test_list_quizzes_public():
    r = requests.get(f"{API}/quizzes", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# /api/me without auth should 401
def test_me_requires_auth():
    r = requests.get(f"{API}/me", timeout=15)
    assert r.status_code == 401


# Quiz creation requires bearer
def test_create_quiz_requires_auth():
    r = requests.post(f"{API}/quizzes", json={
        "title": "no auth",
        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "questions": []
    }, timeout=15)
    assert r.status_code == 401


# mine=true requires auth
def test_list_mine_requires_auth():
    r = requests.get(f"{API}/quizzes?mine=true", timeout=15)
    assert r.status_code == 401


# Attempts requires auth
def test_attempts_requires_auth():
    r = requests.post(f"{API}/attempts", json={"quiz_id": "x", "answers": []}, timeout=15)
    assert r.status_code == 401


# Invalid bearer returns 401
def test_invalid_bearer():
    r = requests.get(f"{API}/me", headers={"Authorization": "Bearer notavalidtoken"}, timeout=15)
    assert r.status_code == 401


# Non-existent quiz returns 404
def test_get_quiz_not_found():
    r = requests.get(f"{API}/quizzes/nonexistent-id-xyz", timeout=15)
    assert r.status_code == 404
