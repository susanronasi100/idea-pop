# Idea Pop — Project Guide for Claude Code

Idea Pop is a web learning platform for kids 8+ and teens: Explore (nature videos),
Library (expert courses/makes), Challenge (8-step real-world missions). Kids watch,
learn, solve, and build — earning XP/stickers. Brand line: "Ask nature. Build with your hands."

## Stack
- Backend: Rust, Axum, SQLx, PostgreSQL. Cargo workspace: crates/{domain, infra, api, server}.
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS, next-intl (EN + FA/RTL).
- Infra: Docker Compose (dev), GitHub Actions CI, deploy to a VPS. S3/MinIO for photos. SMTP/MailHog for email.

## Repo layout
backend/crates/{domain,infra,api,server}, backend/migrations, frontend/src/{app,components,lib,styles,messages},
packages/api-types, .github/workflows, docs/.

## Architecture rules
- Dependencies point inward: api -> domain <- infra. The `domain` crate has NO IO (no SQLx, no HTTP).
- Business rules live in domain services. Handlers are thin: validate -> call service -> map to DTO/status.
- `infra` implements domain ports (traits) like ChildRepo, ChallengeRepo, EmailSender, PhotoStore.
- Errors: thiserror in domain; map to RFC 7807 problem+json at the API edge. Never leak internals.
- All SQL via SQLx with the offline cache (.sqlx committed). Migrations are append-only and reversible.

## Product safety rules (non-negotiable)
- Everything a child creates is PRIVATE by default. class/public visibility requires a recorded human approval.
- Children start RESTRICTED. Sharing, social, and extra data collection are disabled until a parent grants
  consent (email verification). Enforce via consent-gating middleware.
- Kid tokens are scoped: NO billing/transactions, no other children, no free chat. Kids MAY view pricing/plans,
  but cannot check out — tapping Upgrade hands off to the parent, who completes payment on their own session.
- Collect from children only: nickname, avatar, birth year. Never full name, address, phone, school, face photo.
- Project photos are "project, not face". AI-generated content is flagged `ai_generated` and labeled in the UI.

## Design tokens (see docs/design-tokens.md, wired in frontend/tailwind.config.ts)
- Fonts: APP screens (inside AppShell) use Cherry Bomb One (display) + Montserrat (body), with Playpen Sans Arabic
  for the fa locale (Cherry Bomb One/Montserrat lack Persian glyphs; globals.css sets every `:lang(fa)` element in it,
  marketing pages included). MARKETING/landing keeps Baloo 2 (display)
  + Nunito (body). Scoped via `--font-display`/`--font-body` (globals.css `.app-typography`). Min body ~14px; larger for kids.
- Section colors (chameleon nav): Explore green, Library #F2994A, Challenge #2D9CDB, Pricing purple.
- Pastel page tints: #F3FFC2 lime, #FBF7D5 cream, #C0F0FF blue, #F1D8FB lavender, #F9DED7 blush.
- One button system (primary/secondary/tertiary) with default/hover/focus/pressed/disabled. One input anatomy.
- One mascot: POPI, a small floating robot (frontend/public/popi/popi.png) — "Ask Me" in the app, "Hi, I'm Idea Pop!" on marketing. ("Poppy" is only the
  TTS narrator-voice identity from the Voice Bible, not a visual character.) One icon set. Tablet-first, WCAG AA.
- Edition-2 UI notes: app shell = persistent LEFT SIDEBAR (My profile · Exploring · Library · Challenges) +
  content area in per-section tint + top-right IDEA POP logo (tree-in-a-bulb badge) + a floating "Ask Me"
  penguin helper (bottom-right) + a bottom "Themes" bar (cosmetic themes unlock at Lv 4). Explore content
  grouped by "superpower" categories: Masters of Disguise / Soft Engineers / Speed Champions / Master Builders.

## Gamification (canonical)
- XP: Explore +5/video, Learn +10/lesson, Solve +20/challenge. Levels derived from an append-only xp_events ledger.
- Medals per adventure: bronze@3, silver@6, gold@10. Creative Cycle: explore+learn+solve in one ISO week -> +15 XP.
- Ranks: Explorer -> Maker -> Inventor -> Innovator -> Master -> Mentor.

## Challenge engine (canonical)
Challenge = DATA, not a page. One generic engine renders any challenge from its JSON.
8 steps: 1 Brief, 2 Your idea?, 3 Nature clues, 4 Design secret, 5 Skill, 6 Sketch, 7 Build & test, 8 Celebrate & share.
"Yes, I have an idea" jumps to step 6; all steps stay reachable from the mission menu. Ideas Wall is locked until the kid submits.

## Commands
- Dev up: `docker compose up` (or `just up`). DB UI: adminer (:8081). Mail: mailhog (:8025). Storage: minio (:9001).
- Backend: `cargo test --all`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --all`,
  `cargo sqlx prepare`, `cargo sqlx migrate run`. Coverage: `cargo llvm-cov`.
- Frontend: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (add Vitest), `npx playwright test`.

## Definition of done for ANY task
1. Code compiles; `cargo fmt` clean; `cargo clippy --all-targets -- -D warnings` clean; `npm run lint` + `tsc` clean.
2. Unit tests for new domain logic; integration tests for new endpoints (testcontainers Postgres).
3. OpenAPI updated; regenerate the frontend api-types if the API changed.
4. `.sqlx` offline cache refreshed (`cargo sqlx prepare`).
5. No coverage drop below threshold.

## Git workflow for EVERY task (Claude Code owns this end to end)
1. Start clean: `git checkout main && git pull`, then `git checkout -b <type>/<scope>` (feat/…, fix/…, chore/…).
2. Do the work in small commits with Conventional Commit messages. NEVER commit directly to main.
3. Make the full gate green locally before opening a PR:
   `cargo fmt --all -- --check && cargo clippy --all-targets -- -D warnings && cargo test --all`
   and in `frontend/`: `npm run lint && npm run typecheck && npm run build`.
4. Push and open a PR to main with a summary + the verification you ran:
   `git push -u origin HEAD && gh pr create --fill`
5. Let CI gate the merge, then squash-merge and clean up:
   `gh pr checks --watch`
   `gh pr merge --squash --delete-branch`
   `git checkout main && git pull`
6. NEVER merge red. If CI fails, stop and fix on the same branch, then re-run the checks.

## Conventions
- Never commit secrets; use .env (see .env.example).
- If a task conflicts with the safety rules above, STOP and flag it rather than weakening them.

## Current state
Phase 1 in progress: SQLx + Postgres, migrations, RFC 7807 error layer, request-id/trace/timeout middleware,
OpenAPI (utoipa + Swagger UI at /docs), integration-test harness (testcontainers). Phase 0 done.
