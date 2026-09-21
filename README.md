# ParkAway

A parking marketplace for guaranteed, verified parking — find a spot, book it, and know it'll be there. Longer-term, ParkAway also aims to be a "Parking OS" for property managers running multi-tenant parking operations.

This repository holds the full-stack MVP: a Fastify backend, two React web apps (driver-facing and admin), and an Expo/React Native mobile app, sharing a design system across the frontend surfaces.

## Status

Early build. Sprint 1 (identity: OTP login, sessions, driver profile/vehicles, admin auth + user management) is implemented end-to-end across all four apps. See `docs/planning/03-sprint-plan.md` for the overall roadmap and `docs/planning/04-sprint-1-detailed-plan.md` for what's shipped so far.

## Repository structure

| Path | What it is |
|---|---|
| `apps/api` | Fastify backend — PostgreSQL/PostGIS + Drizzle ORM, Redis, JWT auth |
| `apps/driver-web` | Driver-facing web app (React + Vite) |
| `apps/admin-web` | Admin console (React + Vite) — user search, suspend/restore |
| `apps/driver-mobile` | Driver mobile app (Expo / React Native) |
| `packages/design-tokens` | Shared spacing/type/color scale and per-surface themes |
| `packages/ui-web` | Shared React component library (web) |
| `packages/ui-native` | Shared React Native component library (mobile) |
| `docs/tech-stack.md` | Stack decisions, rationale, and non-negotiable engineering rules |
| `docs/planning/` | Feature modules, architecture, kanban board, sprint plans |

## Getting started

**Prerequisites:** Node.js 22+, Docker Desktop.

```bash
npm install
cp .env.example .env          # fill in real values — see comments in the file
docker compose up -d          # Postgres+PostGIS and Redis
npm run db:migrate
npm run db:seed:admin         # creates the first admin login from .env
```

Then, in separate terminals:

```bash
npm run dev:api                               # backend — http://localhost:3000
npm run dev --workspace apps/driver-web        # http://localhost:5173
npm run dev --workspace apps/admin-web         # http://localhost:5174
npm run start --workspace apps/driver-mobile   # Expo dev server — scan with the Expo Go app
```

For the mobile app, also copy `apps/driver-mobile/.env.example` to `apps/driver-mobile/.env` and set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (not `localhost` — a phone or emulator can't reach that).

## Testing & linting

```bash
npm run test --workspace apps/api          # unit + Testcontainers concurrency tests
npm run test --workspace apps/driver-web
npm run test --workspace apps/admin-web
npm run lint                               # whole monorepo, one config
```

## More detail

Start with `CLAUDE.md` for repo conventions and architecture notes (session/auth design, the shared design system, a couple of concurrency bugs already found and fixed that are worth understanding before touching that code again), and `docs/tech-stack.md` for the reasoning behind each stack choice.
