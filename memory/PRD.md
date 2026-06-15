# Rocket League Quiz Platform — PRD

## Original Problem
Interactive Rocket League replay analysis platform. Creators upload YouTube replay clips and pin questions at decision-making timestamps. Players must answer (video auto-pauses) before continuing — training game sense, rotations, boost mgmt, positioning, and challenge timing.

## Architecture
- **Frontend**: React 19 + TailwindCSS + shadcn/ui + Rajdhani/Chivo/JetBrains Mono fonts + Supabase JS client + react-youtube
- **Backend**: FastAPI + MongoDB (motor) + Supabase JWT verification via `/auth/v1/user`
- **Auth**: Supabase Email/Password (project `iavfegyovaictppxrrvz`)
- **Video**: YouTube embeds only (no file uploads)

## User Persona
- Rocket League players (Bronze → GC) wanting to improve game sense via active learning, not passive watching.
- Coaches/Creators wanting to share decision-making lessons with their squad.

## Core Requirements
- Every user is both creator AND player.
- 5 question types: single-select, multi-select, rank options, confidence rating, short explanation.
- Video auto-pauses at pinned timestamps; player cannot peek ahead.
- Skipping = unanswered, recorded.
- Results screen with detailed explanations per question.

## Implemented (Feb 2026)
- Landing page (RL esports HUD vibe, hero, how-it-works, question types, CTA)
- Auth (Sign In / Sign Up with Supabase email+password)
- Dashboard (stats, browse all quizzes, my quizzes tab)
- Quiz Builder (paste YouTube URL, scrub timeline, pin questions, edit all 5 types)
- Quiz Player (embedded YouTube + auto-pause, question HUD overlay, skip, locked progress)
- Results page (score, per-question correctness, explanations, replay)
- Rule-based loading screen (Rule #1, #2, #5, #12, etc.)

## Backlog (P1/P2)
- Leaderboards per quiz
- Quiz sharing via public link / embed
- Question categories/tags (rotations, boost, defense, etc.)
- Creator profile pages
- Mobile-optimized HUD overlay
- Quiz drafts / scheduled publishing
- Video upload (direct file) — currently YouTube only

## Next Actions
- (Optional) Add leaderboards to drive replay/engagement
- (Optional) Public quiz share URLs for viral growth
