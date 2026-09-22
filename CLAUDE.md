# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repository.

## What this is

ParkAway — a parking marketplace (find/book guaranteed parking) and, longer-term, a "Parking OS" for property managers. Single-micro-market MVP; scope is deliberately locked to avoid building ahead of pilot validation (see `docs/planning/`).

**Read `docs/tech-stack.md` and `docs/planning/*.md` before making architecture or scope decisions.** They are the living source of truth for locked decisions, module boundaries, and non-negotiable rules (idempotency, audit trail, provider-adapter boundary, etc.). Don't re-decide something already locked there; don't silently decide something marked "not yet decided" — flag it instead.

The `/run-team` skill (`.claude/skills/run-team/`) orchestrates a simulated dev team (BA → Tech Lead → Frontend/Backend → QA → DevOps) for planning new work. Use it for anything beyond a small fix.

## Repo layout

```
apps/
  api/             Fastify backend — Postgres/PostGIS + Drizzle, Redis, JWT auth
  driver-web/      React + Vite — driver-facing web (OTP login, profile, vehicles)
  admin-web/       React + Vite — admin console (user search, suspend/restore)
  driver-mobile/   Expo (React Native) — driver mobile app, same feature set as driver-web
packages/
  design-tokens/   Shared color/spacing/type/motion scale + per-surface themes (driver, admin)
  ui-web/          Shared React component primitives (Button, TextField, Modal, ...) — CSS Modules
  ui-native/       Shared React Native component primitives — same names/props shape as ui-web, StyleSheet-based
docs/
  tech-stack.md              Stack decisions + rationale, non-negotiable rules
  planning/                  Feature modules, kanban, sprint plan, per-sprint detailed plans
```

Sprint 1 (identity/auth/profile/vehicles/admin RBAC) is fully implemented across all four apps as of this writing — see `docs/planning/04-sprint-1-detailed-plan.md` for the detailed spec and its "Implementation status" section for what's actually built vs. still open.

## Local development

### Prerequisites

- Node.js 22+, Docker Desktop running.
- Copy `.env.example` → `.env` at the repo root and fill in real values (strong random passwords — see the "non-negotiable rules" below). `apps/driver-mobile` needs its own `.env` too (copy `apps/driver-mobile/.env.example`, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP).

### First-time setup

```bash
npm install                          # installs all workspaces
docker compose up -d                 # Postgres+PostGIS on :55432 (not :5432 — see docker-compose.yml comment), Redis on :6379
npm run db:migrate                   # apply migrations
npm run db:seed:admin                # creates the first platform_admin from SEED_ADMIN_EMAIL/PASSWORD in .env
```

**Postgres runs on host port 55432, not the default 5432** — a workaround for a common local-dev trap: if anything (another project, a native install) is already listening on 5432, Docker Desktop forwards to it silently instead of erroring, and you get "password authentication failed" against what looks like your container but isn't. Check `docker-compose.yml`'s comment if you ever hit that again.

### Running things

```bash
npm run dev:api                                    # backend on :3000
npm run dev --workspace apps/driver-web             # :5173
npm run dev --workspace apps/admin-web              # :5174
npm run start --workspace apps/driver-mobile        # Expo dev server — scan the QR code with Expo Go
```

### Testing

```bash
npm run test --workspace apps/api                   # unit tests + Testcontainers concurrency tests (needs Docker)
npm run test --workspace apps/driver-web             # jsdom + React Testing Library
npm run test --workspace apps/admin-web              # jsdom + React Testing Library
```

`apps/driver-mobile` and the `packages/*` have no dedicated test suite yet — `npx tsc --noEmit` (typecheck) and `npx expo export --platform android` (Metro bundle check, catches resolution/bundling errors without a device) are the fastest signal there.

### Linting

```bash
npm run lint          # whole monorepo, one flat config at the repo root (eslint.config.js)
npm run lint:fix
```

One `eslint.config.js` covers `apps/*` and `packages/*` with per-surface rule blocks (Node globals for the backend, browser globals + React rules for the web apps, React Native rules for the mobile app/`ui-native`). **Run `npm run lint` after any development pass across backend/web/mobile, before considering work done** — this is a standing expectation for this repo, not a one-off.

## The `.js`-import-extension trap

This is the single most common way to break the frontend build in this repo — it has happened four separate times in this codebase's history (twice building the mobile app's navigation redesign alone) despite being documented here the whole time. Read this before adding an import statement anywhere outside `apps/api`.

- **`apps/api`** uses `"moduleResolution": "NodeNext"` and runs under Node's own ESM loader (via `tsx`), which **requires** explicit `.js` extensions on relative imports (`from "../lib/errors.js"`) even though the source file is `errors.ts`. This is correct and necessary there.
- **Everywhere else** (`packages/design-tokens`, `packages/ui-web`, `packages/ui-native`, `apps/driver-web`, `apps/admin-web`, `apps/driver-mobile`) is bundled by Vite or Metro, neither of which resolves a `.js`-suffixed import to a `.ts` source file. TypeScript's checker doesn't catch this (it happily accepts the `.js` suffix under `"moduleResolution": "bundler"`), so the mistake only surfaces at bundle/runtime, not at typecheck time — Metro in particular fails with an opaque "Unable to resolve module" error deep in the import graph.
- **Rule of thumb: `.js` extensions only in `apps/api`. Extensionless relative imports everywhere else.** If you copy a pattern from the backend into a frontend file (or vice versa), check this before moving on.
- **`npm run lint` now catches this automatically** — `eslint.config.js` has a `no-restricted-syntax` rule scoped to every non-backend surface that flags a relative import/export ending in `.js`. Documentation alone didn't stop this mistake from recurring; the lint rule is what actually will. If you're editing `eslint.config.js`, `noJsExtensionOnRelativeImportsRules` is where it lives.

## Architecture notes worth knowing before touching auth/session code

- Sessions are stateless JWT (access token) + opaque refresh token with rotation and reuse detection (`apps/api/src/modules/auth/session.service.ts`). The refresh-rotation "claim" step is a single atomic `UPDATE ... WHERE token_hash = $1 AND revoked_at IS NULL` — **not** a SELECT-then-transaction pattern. An earlier version used SELECT-then-transaction and had a real race (two concurrent refresh calls on the same token could both succeed); the comment on that function explains why. Testcontainers-based concurrency tests exist specifically to catch regressions of this class of bug — see `apps/api/test/integration/concurrency.test.ts`.
- Suspension takes effect via `session_version` on the `users`/`admin_users` row plus a short-TTL Redis cache, not a JWT denylist. Cache-miss (including "Redis is down") falls back to Postgres — never assumes "still valid" on a miss.
- `vehicles.is_default` has a **database-level** partial unique index (`vehicles_user_id_default_unique_idx`, one row per `user_id` where `is_default = true`) — the real correctness guarantee against two concurrent "set default" calls, not the application-level unset-then-set transaction alone (which by itself has the same class of race as the refresh-token bug above). See `apps/api/src/modules/identity/vehicle.service.ts`.
- Every status-changing action (suspend/restore, profile email change, login/logout, admin searches) writes to the shared `audit_log` table via `lib/audit.ts`'s `recordAudit()` — use it rather than writing to `audit_log` directly, so actor/timestamp/source/reason stays structurally guaranteed rather than a convention to remember per-route.

## Design system

`packages/design-tokens` is the single source of truth for spacing/type/radius/motion (raw numbers) and two color themes (`driver`: warm terracotta/cream; `admin`: cool neutral/deep teal). `packages/ui-web` and `packages/ui-native` implement the same component set (`Button`, `TextField`, `OtpInput`, `Modal`, `EmptyState`, `WizardProgress`, `InlineBanner`, `Card`, `Table`/`StatusBadge` on web only) against those tokens — same names and prop shapes where the platform allows it, so a screen built on one reads naturally if you've seen the other. Don't hand-roll a one-off styled component in an app when an existing primitive (or a new variant on one) would do — extend the shared package instead.

Before adding a new screen/flow, see `.claude/skills/run-team/frontend.md`'s design philosophy section — the short version: no AI-generated-default look, research real reference patterns first (Mobbin MCP, once connected), and each surface family gets a deliberately different tone (driver: warm/reassuring; admin: dense/unglamorous; a future security-guard surface: near-brutalist).
