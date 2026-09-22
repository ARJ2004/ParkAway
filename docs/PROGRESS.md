# ParkAway — Progress

**Last updated:** 2026-09-23
**Status:** Sprint 1 (identity, profiles, admin foundation) built end-to-end across backend, both web apps, and the mobile app. Not yet device-tested on mobile; several product decisions still open (listed below).

This is a standing status summary — update it at the end of each sprint, not a historical log of every change. For day-to-day decision history, see `docs/planning/04-sprint-1-detailed-plan.md`'s "Implementation status" entries and the git log. For repo conventions and setup, see `CLAUDE.md` and `README.md`.

---

## What's built

### Backend (`apps/api`)

Fastify + Drizzle/PostgreSQL+PostGIS + Redis, covering `AUTH-01`–`04`, `ADM-01`/`02` (= `AUTH-03`), `DRV-02`–`04`:

- **OTP login** — request/verify, single-use atomic consumption, rate limiting (fail-closed on Redis outage), mock SMS provider with a production-boot guard that refuses to start if the bypass is left enabled outside dev
- **Sessions** — stateless JWT access tokens + opaque refresh tokens with rotation and reuse detection (atomic claim, not a check-then-act race)
- **Suspension enforcement** — `session_version` + short-TTL Redis cache, fails safe (re-checks Postgres) on a cache miss rather than assuming still-valid
- **Admin auth + RBAC** — email/password login, two roles (`platform_admin` full access, `support` sees masked PII), generic invalid-credentials error that never reveals whether an email exists
- **Driver profile & vehicles** — CRUD, phone immutable (rejected explicitly, not silently ignored), vehicle registration numbers validated against the standard Indian format (`KA05HR1096`-style) and **globally unique while active** — one live account per plate system-wide, not per-user
- **Admin user management** — search (phone/ID/vehicle/email) with role-based PII masking, suspend/restore with a required reason, every action audited
- **Shared infrastructure** — `audit_log` (actor/timestamp/source/reason on every status change), provider-adapter pattern for the OTP/SMS integration, S3-ready photo upload path (presigned URLs, not proxied)

**Two real concurrency bugs were found and fixed by tests, not by review:**
1. Refresh-token rotation had a genuine race (two concurrent refreshes on the same token could both succeed) — fixed by making the revoke itself an atomic `UPDATE ... WHERE ... AND revoked_at IS NULL` claim.
2. Vehicle default-swap had the same class of race — fixed with a database-level partial unique index, not just careful application code.

A third bug (`pgConstraintName()` never actually reaching the wrapped Postgres error's message, silently disabling constraint-specific recovery logic in two places) was caught while writing the vehicle-uniqueness test and fixed the same way — by writing a precise assertion instead of a loose one.

**Tests:** 32 (20 unit + 5 Testcontainers concurrency tests against real Postgres/Redis, covering the two races above, duplicate-account handling, and the vehicle-uniqueness behavior end-to-end).

### Shared design system (`packages/design-tokens`, `packages/ui-web`, `packages/ui-native`)

One numeric scale (spacing/type/radius/motion) with two themes — `driver` (warm terracotta/cream) and `admin` (cool neutral/deep teal) — consumed two ways: `ui-web` via CSS custom properties + CSS Modules, `ui-native` via a React Context + `StyleSheet`. Same component names and prop shapes across both where the platform allows it (`Button`, `TextField`, `OtpInput`, `Modal`, `EmptyState`, `WizardProgress`, `InlineBanner`, `Card`; `Table`/`StatusBadge` web-only so far, `Badge` native-only so far — noted as a small follow-up to bring the two inventories back in sync).

Design direction was grounded in real reference research via the Mobbin MCP (bottom-tab navigation, garage/vehicle-list screens, profile/account layouts from Freenow, Lyft, Careem, My BMW, Affirm, PayPal, and others) — synthesized into ParkAway's own palette, not copied.

### Driver Web (`apps/driver-web`) and Admin Web Console (`apps/admin-web`)

React + Vite + TanStack Query. Driver Web: OTP login → skippable onboarding wizard (profile + vehicle, each step equally-weighted Skip/Continue) → home/profile/vehicles. Admin Web: login → user search with role-based masking → suspend/restore with a required-reason modal.

**Tests:** 7 component tests (jsdom + React Testing Library — real rendering and simulated interaction) covering the behaviors that mattered most: new vs. returning user wizard behavior, specific error messages per OTP failure mode, generic admin login error, PII masking differing by role, suspend confirm disabled until a reason is typed.

### Driver Mobile App (`apps/driver-mobile`, Expo/React Native)

Same feature set as Driver Web, native from the start rather than a ported layout:

- **Bottom tab bar** (Home / Vehicles / Profile — exactly what's built, no placeholder tabs)
- **Home** — a real dashboard: greeting, a "search is coming" highlight card, a default-vehicle status card or add-vehicle CTA
- **Vehicles** — card-based garage list with a themed icon tile and a `Default` badge
- **Profile** — avatar-initials header, grouped editable fields, sign-out as its own separated destructive row
- **Session storage** via `expo-secure-store` (encrypted — a deliberate upgrade over the web apps' localStorage, not an inconsistency)

**Verification gap, stated plainly:** no browser or device/emulator was available in the session that built this, so it's confirmed via clean typecheck and a full Metro production bundle (897 modules, no resolution errors) — structurally sound, but never actually seen running or tapped through on a phone. First real device test is still outstanding.

### Tooling

- **Lint** — one `eslint.config.js` at the repo root, surface-appropriate rules per workspace (Node globals for the backend, browser+React for the web apps, React Native for mobile). Includes a custom rule that specifically catches the `.js`-relative-import-extension mistake (a genuine recurring trap in this monorepo — correct only in `apps/api`'s strict Node ESM, silently breaks Vite/Metro everywhere else; happened four times before the rule existed to catch it automatically). `npm run lint` is clean monorepo-wide.
- **Local dev** — `docker-compose.yml` for Postgres+PostGIS (host port `55432`, not the default `5432` — a pre-existing native Postgres on the dev machine silently ate that port otherwise) and Redis, both with strong auth even in dev per the non-negotiable rules.
- **Docs** — `CLAUDE.md` (repo conventions, the import-extension trap, concurrency-bug notes worth knowing before touching that code again), `README.md` (getting started).

---

## Still open — real product decisions, not implementation gaps

1. **Can the `support` admin role suspend/restore users, or should it be read-only-plus-masked?** Currently shipped as "can suspend" by default. Reversible (a permission check, not a schema change), but was never explicitly confirmed.
2. **Phone-number recycling / dormant-account-takeover risk.** Explicitly deferred by request ("leave this for now") — not resolved, not forgotten. Tied to `GATE-11` when it's picked back up.
3. **The Sprint 0 Engineering Gate is still not formally checked off** anywhere in this repo (`docs/planning/02-kanban-board.md`), despite `GATE-10` (admin overrides) and `GATE-11` (PII/KYC retention) being directly relevant to code that's now live with real PII in it.
4. **Mobile has never been run on an actual device or emulator.** Structurally verified only. First priority next time someone has a phone or emulator handy.

## Known pragmatic deviations (documented where they live, listed here for visibility)

- Password hashing is bcrypt, not the originally-specified argon2id — `argon2` needs a native build step this dev environment can't guarantee; bcrypt at cost factor 12 is still industry-standard. Isolated to one file, swappable later.
- `ui-web` and `ui-native` are two independent implementations of the same component contract, with nothing but convention enforcing they stay in sync. Fine at the current size; worth a shared contract test if a third surface joins and drift becomes a real problem rather than a named risk.

## Suggested next steps

1. Get the mobile app running on an actual device (Expo Go is the fastest path — no SDK/emulator install needed) and do a real click-through.
2. Resolve the four open items above, or explicitly decide to keep carrying them forward.
3. Start Sprint 2 (Property & Listing Foundation) per `docs/planning/03-sprint-plan.md` — nothing built so far blocks it.
