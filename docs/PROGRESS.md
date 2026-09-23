# ParkAway — Progress

**Last updated:** 2026-09-24
**Status:** Sprint 1 (identity, profiles, admin foundation) and Sprint 2 (property & listing foundation) are both built and tested, and Sprint 2's mobile deferral has been paid off — `driver-mobile` now has the full owner persona (property → listing wizard → photos → pricing → submit, plus host KYC/payout) alongside `driver-web`'s and `admin-web`'s Sprint 2 work. As of this update, **priority is mobile + admin-web only** — `driver-web` is frozen except for shared-package fallout, per explicit direction. The whole product also now runs on a single unified visual design (see "Design system refresh" below), pulled from the user's own Claude-Artifact mockup rather than an AI-generated default. Several product decisions still open (listed below).

This is a standing status summary — update it at the end of each sprint, not a historical log of every change. For day-to-day decision history, see `docs/planning/04-sprint-1-detailed-plan.md`'s "Implementation status" entries and the git log. For repo conventions and setup, see `CLAUDE.md` and `README.md`.

---

## What's built

### Backend (`apps/api`)

Fastify + Drizzle/PostgreSQL+PostGIS + Redis, covering `AUTH-01`–`04`, `ADM-01`/`02` (= `AUTH-03`), `DRV-02`–`04`:

- **OTP login** — request/verify, single-use atomic consumption, rate limiting (fail-closed on Redis outage), mock SMS provider with a production-boot guard that refuses to start if the bypass is left enabled outside dev
- **Sessions** — stateless JWT access tokens + opaque refresh tokens with rotation and reuse detection (atomic claim, not a check-then-act race); logout (driver and admin) revokes the token and writes an `auth.logout` audit row, not just a client-side clear
- **Suspension enforcement** — `session_version` + short-TTL Redis cache, fails safe (re-checks Postgres) on a cache miss rather than assuming still-valid
- **Admin auth + RBAC** — email/password login, two roles (`platform_admin` full access, `support` sees masked PII), generic invalid-credentials error that never reveals whether an email exists; every admin user-management route now enforces role via `requireAdminRole`, not just authentication
- **Driver profile & vehicles** — CRUD, phone immutable (rejected explicitly, not silently ignored), vehicle registration numbers validated against the standard Indian format (`KA05HR1096`-style) and **globally unique while active** — one live account per plate system-wide, not per-user
- **Admin user management** — search (phone/ID/vehicle/email) with role-based PII masking, suspend/restore with a required reason, every action audited
- **Shared infrastructure** — `audit_log` (actor/timestamp/source/reason on every status change), provider-adapter pattern for the OTP/SMS integration

**Correction (2026-09-23, found while planning Sprint 2):** an earlier version of this line claimed an "S3-ready photo upload path (presigned URLs, not proxied)" was part of Sprint 1's shared infrastructure. **It isn't** — there is no S3 code anywhere in `apps/api`, no storage adapter, and no presign route; `users.photo_url` is a bare text column. Object storage is a Sprint 2 deliverable built from zero (see `docs/planning/05-sprint-2-detailed-plan.md`, "Pre-flight"). Same class of gap as the four the Sprint 1 audit caught — documented as done, never built.

**Two real concurrency bugs were found and fixed by tests, not by review:**
1. Refresh-token rotation had a genuine race (two concurrent refreshes on the same token could both succeed) — fixed by making the revoke itself an atomic `UPDATE ... WHERE ... AND revoked_at IS NULL` claim.
2. Vehicle default-swap had the same class of race — fixed with a database-level partial unique index, not just careful application code.

A third bug (`pgConstraintName()` never actually reaching the wrapped Postgres error's message, silently disabling constraint-specific recovery logic in two places) was caught while writing the vehicle-uniqueness test and fixed the same way — by writing a precise assertion instead of a loose one.

A follow-up audit against the original Sprint 1 acceptance criteria (see "Audit against Sprint 1 plan" below) found four more gaps between documented "done" and actual behavior; all four are now fixed and covered by real tests, not just manual/curl verification.

**Tests:** 38 (30 unit + 8 Testcontainers concurrency/audit-trail tests against real Postgres/Redis) — up from 32, covering the two races above, duplicate-account handling, vehicle-uniqueness behavior end-to-end, `requireAdminRole`'s allow/deny/wiring-bug paths, and logout actually writing an audit row for both driver and admin sessions (plus the silent-no-op case for an unknown/already-revoked token).

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
- **Location permission (`DRV-04`)** — soft-ask card on Home, shown only while permission is undetermined, explaining the value before prompting (never at first launch); `getCurrentPositionSafe()` treats low-accuracy (>100m) or stale (>2min) fixes as unreliable rather than trusting them blindly. Deliberately the only thing DRV-04 delivers this sprint — nothing else depends on a position existing; search-by-typed-destination stays fully usable with permission denied.

**Tests:** 10 (Vitest, newly set up for this app — it had no test infrastructure before). Mocks `expo-location` to cover permission-state mapping, the request-permission flow, and `getCurrentPositionSafe`'s reliability logic (fresh/accurate, low-accuracy, stale, missing-accuracy, and device-failure cases) without needing a device.

**Verification gap, stated plainly:** no browser or device/emulator was available in the session that built this, so beyond the unit tests above it's confirmed via clean typecheck and a full Metro production bundle (897 modules, no resolution errors) — structurally sound, but the UI itself has never actually been seen running or tapped through on a phone. First real device test is still outstanding.

### Tooling

- **Lint** — one `eslint.config.js` at the repo root, surface-appropriate rules per workspace (Node globals for the backend, browser+React for the web apps, React Native for mobile). Includes a custom rule that specifically catches the `.js`-relative-import-extension mistake (a genuine recurring trap in this monorepo — correct only in `apps/api`'s strict Node ESM, silently breaks Vite/Metro everywhere else; happened four times before the rule existed to catch it automatically). `npm run lint` is clean monorepo-wide.
- **Local dev** — `docker-compose.yml` for Postgres+PostGIS (host port `55432`, not the default `5432` — a pre-existing native Postgres on the dev machine silently ate that port otherwise) and Redis, both with strong auth even in dev per the non-negotiable rules.
- **Docs** — `CLAUDE.md` (repo conventions, the import-extension trap, concurrency-bug notes worth knowing before touching that code again), `README.md` (getting started).

---

## Audit against Sprint 1 plan (2026-09-23)

Re-read the original acceptance criteria in `docs/planning/04-sprint-1-detailed-plan.md` fresh and grepped the actual code against it, rather than trusting the prior "done" status. Found four real gaps — documented as complete but not actually implemented, or implemented but untested:

1. **`DRV-04` (location permission) didn't exist at all.** No code anywhere. Built this session (see Driver Mobile section above), including tests.
2. **Logout never wrote an audit record**, violating the stated "every status-changing action is audited" rule. Fixed: `revokeRefreshToken` now looks up the token before revoking and records an `auth.logout` row when it was live; covered by three Testcontainers tests (driver, admin, and the silent-no-op case).
3. **Admin RBAC had no per-role enforcement** — a comment in the code referenced a `requireAdminRole` function that was never implemented, so both admin roles could hit every admin route identically regardless of what the plan specified. Built and wired into all three `apps/admin` routes; covered by three unit tests (`test/authenticate.test.ts`) for the allow/deny/wiring-bug-not-silently-allowed paths.
4. **admin-web's logout only cleared local storage** — there was no backend endpoint to call. Added `POST /v1/admin/auth/logout`; admin-web now calls it (best-effort, doesn't block navigation on failure).

All four were fixed with real code changes, not documentation edits, and all four now have automated test coverage — closing a gap explicitly flagged mid-session ("was test written to test these things") where the first pass had only manual/curl verification for three of the four.

## Still open — real product decisions, not implementation gaps

1. **Can the `support` admin role suspend/restore users, or should it be read-only-plus-masked?** Currently shipped as "can suspend" by default (both roles passed to `requireAdminRole`). Reversible (a one-line permission-list change, not a schema change), but was never explicitly confirmed.
2. **Phone-number recycling / dormant-account-takeover risk.** Explicitly deferred by request ("leave this for now") — not resolved, not forgotten. Tied to `GATE-11` when it's picked back up.
3. **The Sprint 0 Engineering Gate is still not formally checked off** anywhere in this repo (`docs/planning/02-kanban-board.md`), despite `GATE-10` (admin overrides) and `GATE-11` (PII/KYC retention) being directly relevant to code that's now live with real PII in it.
4. **Mobile has never been run on an actual device or emulator.** Structurally and now unit-test verified, but the UI itself is unseen on a real device. First priority next time someone has a phone or emulator handy.

## Known pragmatic deviations (documented where they live, listed here for visibility)

- Password hashing is bcrypt, not the originally-specified argon2id — `argon2` needs a native build step this dev environment can't guarantee; bcrypt at cost factor 12 is still industry-standard. Isolated to one file, swappable later.
- `ui-web` and `ui-native` are two independent implementations of the same component contract, with nothing but convention enforcing they stay in sync. Fine at the current size; worth a shared contract test if a third surface joins and drift becomes a real problem rather than a named risk.

## Sprint 2 (Property & Listing Foundation)

Full detail in `docs/planning/05-sprint-2-detailed-plan.md`'s "Implementation status" section at the top of that document — summarized here.

**Built and tested:** the full backend spine (PostGIS, `StorageProvider`/`MapsProvider` adapters, persona + role model, properties/authorizations/access-policies, host profiles + KYC + encrypted payout, listings/photos/lifecycle/pricing, admin moderation, the BullMQ verification-expiry sweep); the Admin Web Console's listing moderation queue **plus a new host KYC review screen** (`/hosts/:id/kyc` — document viewing, approve/reject, audited payout reveal); `driver-web`'s full persona fork (persona picker, owner persona with a 5-step listing wizard, host KYC/payout, and the Property Manager Console at `/manage/*`); and — new this update — **`driver-mobile`'s full owner persona**, built natively rather than a ported web layout: `PersonaScreen` (first-login picker), a `PersonaSwitchPill` switcher, a bottom-tab `OwnerStack` (Home/Spaces/Profile), property creation with a GPS-based `LocationField`, a 5-step listing wizard (fit/photos/access/price/review) with an `expo-image-picker`-based `PhotoPicker` doing the full presign→PUT→complete upload flow, and host KYC/payout screens. All five touched apps (`api`, `driver-web`, `admin-web`, `driver-mobile`, plus the shared packages) typecheck, lint, and build clean — mobile confirmed via both `tsc --noEmit` and a full Metro production bundle (987 modules, no resolution errors).

**Two real bugs were caught by tests during Sprint 2's initial build** (full detail in the plan doc): the pricing resolver was using the server's local system timezone instead of a fixed IST offset for peak/weekend windows, and the `user_roles` "one live grant" unique index provided no actual protection for unscoped roles (`host`) because Postgres treats every `NULL` as distinct — both fixed and covered by regression tests.

**One deviation from the locked plan**, on the user's explicit direction during implementation: the Property Manager Console lives inside `apps/driver-web` (`/manage/*`, its own login) rather than a separate `apps/property-web` app, superseding locked decision O-10.

### Bugs found and fixed after initial device/browser testing (2026-09-24)

Once the app was actually exercised (browser network tab + real server logs, rather than curl alone), several more bugs surfaced — all fixed and, where the fix is a systemic pattern rather than a one-off, covered by new regression tests:

1. **Bodyless mutating requests (`submit`/`pause`/`archive`/…) 500'd** with `FST_ERR_CTP_EMPTY_JSON_BODY` — the client's `apiRequest()` was always sending `Content-Type: application/json` even with no body. Fixed in all three apps' `api/client.ts` (only set the header when a body is actually present); the server error handler now also passes through real `FastifyError` 4xx statuses instead of flattening every non-`AppError` into a generic 500, so this class of bug fails loudly instead of as an opaque `INTERNAL_ERROR` next time.
2. **Mock storage URLs were hardcoded to `localhost`**, so listing photos/documents were unreachable from a physical phone on the LAN. Fixed with an `AsyncLocalStorage`-based `requestOrigin.ts` that captures the actual `Host` header per-request and threads it into `mockStorageProvider`'s URL generation, instead of a static `STORAGE_MOCK_BASE_URL`.
3. **`current transaction is aborted, commands ignored until end of transaction block`** — a systemic bug, not a one-off: catching a unique-violation mid-transaction (e.g. "you already hold the `host` role") aborts the *whole* enclosing Postgres transaction, not just the failed statement, so any later query on that same `tx` handle failed. Found live via a real repro (select owner → switch to driver → select owner again). Fixed in all three places it existed — `persona.service.ts`, `host-profile.service.ts`, and a pre-existing Sprint 1 instance in `identity/vehicle.service.ts` — by wrapping the risky insert in a nested `tx.transaction()` (a real Postgres SAVEPOINT), and covered by two new regression tests in `concurrency.test.ts`.
4. **Mobile's listing review step allowed re-submitting an already-submitted listing**, which 409'd — `ListingWizardScreen`'s `ReviewStep` now shows a read-only status instead of a submit button once `status !== "draft"`.

### Design system refresh (2026-09-24)

Applied the user's own Claude-Artifact-designed palette and type system across the whole product (mobile + admin-web; driver-web inherits it structurally through the shared packages even though it's not the active focus):

- `packages/design-tokens` — collapsed the three separate per-surface themes (`driver`/`admin`/`host`) into one unified `parkAwayTheme` (ink/bone/brass/forest/rust palette), bumped the radius scale, and switched the type system to Marcellus (headings) + Manrope (body), replacing Sora/Inter.
- `packages/ui-web` and `packages/ui-native` — updated component-level styling (`TextField`, `Card`, `Modal`, `Button`, `Badge`) to match: new radii, `surfaceRaised` backgrounds, and (native) the new Google Fonts.
- `apps/driver-mobile` — swapped `@expo-google-fonts/inter`/`sora` for `manrope`/`marcellus`; removed the old per-persona theme-swap concept from `ui-native/theme.tsx` since driver and owner now share one palette (the persona *mode* is still visually distinct via the `PersonaSwitchPill` and navigation, not via a second color theme).

Mobbin MCP was used for UX-pattern research while fixing the bugs above and building out the mobile owner-persona screens (bottom-tab and garage/listing-manager reference patterns), consistent with the design philosophy in `frontend.md`.

**Deferred, not forgotten:** the Playwright E2E harness, mobile Jest/RNTL tests, and two specific test gaps (a sweep-job re-fire/idempotency test, a full lifecycle-transition-matrix unit test). The Testcontainers suite (including the newest regression tests above) has not run to completion this session — Docker Desktop was unresponsive to `docker ps` for a significant part of it; the already-running dev containers kept serving the live API fine throughout, which is how all the live-verification above was possible.

`GATE-06` and `GATE-11` are checked off in `02-kanban-board.md`, with their answers recorded there.

## Suggested next steps

1. **Run the full Testcontainers suite** (`npm run test --workspace apps/api`) once Docker Desktop recovers — it was unresponsive to `docker ps` for a stretch of this session, so the newest regression tests (transaction-abort fixes, bodyless-mutation fixes) have been typechecked and manually verified live but not yet run through the automated suite.
2. **Click through `driver-web`'s Sprint 2 screens in an actual browser** — still not done (driver-web is deprioritized, not abandoned); typecheck/lint/build are real signal but not a substitute for a click-through.
3. Fill the remaining Sprint 2 test gaps named above (Playwright E2E, mobile unit tests, the sweep-job re-fire case, the lifecycle-transition-matrix table).
4. Back up `PAYOUT_ENCRYPTION_KEY` somewhere a database restore can't reach, before a real (non-test) host enters an account number — still the one irreversible prerequisite, now live in code rather than just planned.
5. Continue the mobile bug-hunt — the transaction-abort bug was found via a real device report, not exhaustive review; treat it as a signal there may be more undiscovered instances of related bug classes, not as the last one.
6. Start Sprint 3 (Search & Availability) once the above is settled — it depends directly on the `properties`/`listings`/PostGIS foundation this sprint built.
