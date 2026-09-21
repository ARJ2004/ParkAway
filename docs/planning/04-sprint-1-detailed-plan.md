## Implementation status (2026-09-21, updated) — Sprint 1 complete across backend, web, and mobile

**Backend (`apps/api`) is implemented and smoke-tested end-to-end** for all of `AUTH-01`–`04`, `ADM-01`/`02`, `DRV-02`–`04`: schema + migrations, OTP request/verify, JWT + refresh rotation with reuse detection, admin auth + RBAC with PII masking, driver profile/vehicle CRUD, and the shared `audit_log`/rate-limiter/production-boot-guard infrastructure. 20 unit tests + 3 Testcontainers-backed concurrency tests (real Postgres + Redis) pass; every endpoint was also manually verified live via curl (OTP flow, refresh rotation + reuse detection, suspend/restore + session enforcement, admin masking for both roles, rate-limit boundary, production-boot guard).

**Two real concurrency bugs were found and fixed by the Testcontainers tests, not just by review:**
1. `rotateRefreshToken`'s original SELECT-then-transaction-UPDATE pattern let two truly concurrent refresh calls with the same token both pass the "not yet revoked" check before either committed, producing two live child tokens from one parent. Fixed by making the revoke itself the atomic claim (`UPDATE ... WHERE token_hash = $1 AND revoked_at IS NULL`) — see the comment on `rotateRefreshToken` in `session.service.ts`.
2. The vehicle default-swap ("unset previous default, then set new one" in one transaction) had the same class of race: two concurrent set-default calls for different vehicles could both unset "whatever was previously default" before either committed its own new default, leaving two defaults. Fixed with a database-enforced partial unique index (`vehicles_user_id_default_unique_idx` — at most one `is_default = true` row per `user_id`) plus a small retry loop in `updateVehicle` so the rare race resolves transparently instead of surfacing an error.

**Deviations from this document, made during implementation and documented in code comments:**
- **Password hashing is bcrypt (`bcryptjs`), not argon2id** as originally specified — `argon2` requires a native build step this environment can't guarantee across dev machines; bcrypt at cost factor 12 is still an industry-standard choice. Isolated to `lib/crypto.ts`, swappable later.
- **Local dev Postgres runs on host port 55432, not 5432** — this dev machine has a pre-existing native Postgres install already bound to 5432 that Docker Desktop silently forwarded to instead of erroring; see the comment in `docker-compose.yml`. Container-internal port is still 5432; only the host mapping differs, and only for local dev.
- `refresh_tokens.family_id`-based revoke and the `CHECK` constraints described below were implemented exactly as the architecture review specified.

**Frontend (Driver Web + Admin Web Console) is now also implemented and tested.** `packages/design-tokens` and `packages/ui-web` exist as specified — two themes (`driver`: warm terracotta/cream; `admin`: cool neutral/deep teal) sharing one spacing/type/motion scale, and the full component inventory from the table above (`Button` with a first-class equal-weight `skip` variant, `TextField`, `OtpInput`, `Modal`, `EmptyState`, `WizardProgress`, `Table`, `StatusBadge`, `InlineBanner`, `Card`). `apps/driver-web` implements the full OTP login → skippable onboarding wizard → home/profile/vehicles flow; `apps/admin-web` implements login → user search (role-based PII masking) → suspend/restore with a required-reason modal. Both are plain React + Vite + TanStack Query (no heavy UI-kit dependency, so the distinctive styling stays under our control) — proposed defaults per the "state management/UI-kit not yet locked" note, not unilaterally final.

**Verified two ways, same discipline as the backend:** both apps typecheck clean and build cleanly for production; every screen/component file transforms without error through Vite's dev pipeline (confirms the linked-workspace-package + CSS-Modules setup actually works end to end, including cross-package CSS imports from `ui-web`). Beyond that, 7 component tests (jsdom + React Testing Library, real rendering + simulated user interaction, not just "it builds") cover the behaviors this sprint most cares about getting right: a new user lands on the skippable wizard while a returning user skips it entirely, every OTP failure mode shows its own specific message, the admin login error is generic regardless of whether the email exists, PII masking actually renders differently per role, and the suspend confirm button stays disabled until a reason is typed. **No real browser was available this session** (browser tooling wasn't connected) — a manual click-through is still worth doing before calling this sprint fully done. All three dev servers (API on :3000, Driver Web on :5173, Admin Web on :5174) are left running for that; the seeded admin login is `admin@parkaway.local` / the value of `SEED_ADMIN_PASSWORD` in your local `.env`.

**The Driver Mobile App (`apps/driver-mobile`, Expo/React Native) and `packages/ui-native` are now also built**, implementing the same OTP → skippable wizard → home/profile/vehicles flow as the web apps, via `expo-secure-store` (encrypted token storage, stronger than the web apps' localStorage — a deliberate upgrade, not an inconsistency) and a mirrored component set (`Button`, `TextField`, `OtpInput`, `Modal`, `EmptyState`, `WizardProgress`, `InlineBanner`, `Card`) built on the same `design-tokens` scale/theme. Verified via clean typecheck and a full Metro production bundle (897 modules, no resolution errors) — no device/emulator was available this session, so nothing has actually been tapped through on a phone yet.

**Building the mobile app surfaced a real cross-platform gotcha**, now documented in `CLAUDE.md`: the `.js` extensions on relative imports that Node's strict ESM resolution requires in `apps/api` silently break Metro's bundler (and would silently break Vite too, though that had already been avoided there) — Metro doesn't resolve a `.js`-suffixed import to a `.ts` source file the way `tsx`/Node does. All non-backend packages now use extensionless relative imports; the backend keeps `.js` extensions since it genuinely needs them.

**Linting is now set up project-wide** — one `eslint.config.js` at the repo root covering every workspace with surface-appropriate rules (Node globals for the backend, browser+React for the web apps, React Native for mobile/`ui-native`). `npm run lint` is clean. Real findings were fixed properly rather than suppressed: two backend errors were missing `cause` on a re-thrown error (now threaded through `AppError`), and a React `set-state-in-effect` anti-pattern in both web and mobile `ProfileScreen`s was fixed by removing the copy-into-state effect entirely (controlled inputs now fall back to the query/fetch result directly) rather than adding an eslint-disable.

**Everything is committed and pushed to `origin/main`** (`9a04ab0`, `222c089`), with `CLAUDE.md` and `README.md` added.

**Still-open items requiring the user's decision, unchanged by this update:** whether the `support` admin role can suspend/restore or should be read-only-plus-masked; the Sprint 0 Engineering Gate is still not formally checked off in `02-kanban-board.md`; `vehicles.registration_no` global-vs-per-user uniqueness; the phone-number-recycling identity risk. See Arjun's sign-off in Step 6 below for the full review of the finished implementation.

---

# ParkAway — Sprint 1 Detailed Plan: Identity, Profiles & Admin Foundation

**Status:** Detailed breakdown of Sprint 1 as scoped in `03-sprint-plan.md`. Produced via the `/run-team` workflow (Meera → Arjun → Kavya/Rohan → Divya → Nikhil → sign-off).
**Scope:** `AUTH-01`, `AUTH-02`, `AUTH-03` (= `ADM-01`), `AUTH-04`, `DRV-02`, `DRV-03`, `DRV-04`, `ADM-02` (minimal).
**Not in scope:** everything else — see each ticket's "Out of Scope" below and `02-kanban-board.md`.

**Decisions locked for this sprint (confirmed with the user 2026-09-21), not to be silently re-decided later:**
1. **Sessions are stateless JWT + refresh-token rotation** (not Redis opaque sessions) — access token short-lived, refresh token rotated on use with reuse-detection.
2. **Multiple concurrent device sessions are allowed** per driver — logging in on a new device does not kill existing sessions.
3. **Admin/staff login is email + password** (bcrypt/argon2), not OTP — with an MFA field scaffolded in the schema now but no MFA flow built this sprint.
4. **Admin RBAC ships with two roles this sprint: `platform_admin` (full PII) and `support` (masked PII)** — matches the spec's explicit "PII masking for support roles" requirement in `ADM-02`.
5. **Profile + vehicle registration are shown as a skippable onboarding wizard immediately after signup** (confirmed with the user 2026-09-21) — not a blocking mandatory flow, and not deferred-only-to-a-later-nudge either. Every step carries a first-class `Skip` action with equal visual weight to `Continue`; skipping is a fully supported, unpenalized path. See Group A/C's User Experience Flow and the `OnboardingWizard` component in Kavya's plan.

---

## Step 1 — Meera (BA): Requirements Refinement

### Ticket Group A — Driver Identity & Sessions (`AUTH-01`, `AUTH-02`, `AUTH-04`)

**Title:** Mobile OTP registration/login with session issuance and abuse prevention

**User Story:** As a driver, I want to register and log in using just my mobile number and an OTP, so that I can access the app without creating or remembering a password.

**Acceptance Criteria:**
1. Given a driver enters a valid Indian mobile number, when they request an OTP, then an OTP is generated, sent via the (mocked) SMS provider, and expires after 5 minutes.
2. Given a driver enters the correct OTP within the expiry window, when they submit it, then exactly one authenticated session (access + refresh token pair) is issued, and exactly one user account exists for that phone number (idempotent — repeated correct submissions or double-taps never create duplicate users or duplicate sessions from a single OTP verification).
3. Given a driver enters an incorrect OTP, when they submit it, then the attempt is rejected, the remaining-attempts counter decrements, and after 5 incorrect attempts the OTP is invalidated and a new one must be requested.
4. Given a phone number has requested more than 5 OTPs in a rolling hour, when a 6th is requested, then the request is rejected with a rate-limit error (no SMS sent, no attempt counted against a nonexistent OTP).
5. Given a driver has an existing account, when they complete OTP login again, then their existing account is loaded (not duplicated), and their profile/vehicles are unchanged.
6. Given a driver's account is suspended (`ADM-02` state), when they attempt OTP login, then the login is rejected with a clear "account suspended" error, not a generic failure.
7. Given a driver is logged in, when they call logout, then their current session's refresh token is invalidated server-side (a stolen/leaked refresh token can no longer be used after logout), while other active device sessions are unaffected.
8. Given a refresh token is used to obtain a new access token, when that same refresh token is presented a second time (replay), then the reuse is detected, that entire session is revoked, and the event is logged (refresh-token-reuse is treated as a compromise signal).
9. State change: every OTP request, verification attempt (success/fail), login, and logout is recorded with actor (phone/user id), timestamp, source (IP/device), and outcome.
10. Audit record: rate-limit rejections and suspended-account login attempts are logged for fraud/ops visibility (`TR-04` will later consume this).
11. Given a new user completes OTP verification, when the app shows the onboarding wizard, then skipping any step (or all steps) is a fully supported action that lands the driver in the app's normal home/search-ready state — never a dead end, error state, or forced retry.

**Out of Scope:** password-based login for drivers, social login, biometric login, admin login (Group B), real SMS provider integration (stays on `SMS_PROVIDER=mock` per `docs/tech-stack.md` §8 until Sprint 7 unless the provider is picked earlier).

**Scope check:** Identity & Access Management (`01-feature-modules-and-architecture.md` §2.1) — P0, MVP. No P2/P3 exception needed.

**User Experience Flow:**

1. App/web open → if no valid session, land directly on **Phone Entry** (single field, `+91` defaulted, one CTA). No marketing carousel, no "why sign up" filler — the objective is explicitly "low-friction," so the screen should feel like it takes five seconds, not a funnel.
2. Continue → **OTP Entry** (autofill-friendly on Android/iOS where the platform supports it), visible countdown to resend, a "change number" link back to step 1, remaining-attempts messaging only shown once an attempt fails (not upfront, to avoid feeling punitive on a clean flow).
3. On success:
   - **New user** → shown a short **onboarding wizard** (profile basics, then vehicle registration — see Group C) presented as *recommended, not mandatory*. **Decision confirmed with the user (2026-09-21):** every step of the wizard has a clear, first-class **Skip** action (not a buried/tiny link) — skipping is a fully legitimate path, not a "you're doing it wrong" dead end. The spec only hard-requires a vehicle before a *booking is confirmed* (`DRV-03` AC), so a driver who skips everything can still browse/search freely and only hits a vehicle prompt at the point booking actually requires it. Skipping the wizard does not block or degrade any other part of the app.
   - **Existing user** → straight to home, zero re-onboarding friction — the wizard is a new-user-only moment, never shown again once dismissed/completed (a driver who skipped can still reach Profile/Vehicles later via the account menu).
4. Failure forks, each with a distinct, specific message (not a shared generic "something went wrong"): wrong OTP (inline, shows remaining attempts), expired OTP (resend CTA foregrounded), rate-limited (cooldown messaging, not treated as a wrong-OTP error), suspended account (distinct copy, doesn't imply the OTP itself was wrong).

**Design research pointers for Kavya** (Mobbin MCP, once connected): OTP verification flows and phone-first sign-up patterns from mobility/marketplace apps; skippable-step onboarding wizards where "recommended, not required" is communicated visually (progress indicator that doesn't guilt-trip, a Skip action with equal visual weight to Continue rather than a de-emphasized afterthought).

**Routing:** Arjun (session/token architecture, rate-limit design), Rohan (backend), Kavya (mobile/web login UI), Divya (QA).

---

### Ticket Group B — Admin Identity, RBAC & User Management (`AUTH-03`/`ADM-01`, `ADM-02`)

**Title:** Admin authentication with RBAC, and minimal user search/suspend console

**User Story:** As a platform admin or support agent, I want to log in securely with a role-scoped account and look up / suspend a user, so that I can operate the platform and respond to abuse or support requests without needing engineering involvement.

**Acceptance Criteria:**
1. Given valid admin credentials (email + password), when the admin logs in, then a role-scoped session is issued reflecting their role (`platform_admin` or `support`).
2. Given invalid credentials, when login is attempted, then it is rejected without revealing whether the email exists (generic "invalid credentials" message), and the attempt is rate-limited per account and per IP.
3. Given an admin with the `support` role, when they search for a user, then phone number and email are shown masked (e.g. `98******21`), while `platform_admin` sees unmasked values.
4. Given any admin searches by phone, user ID, vehicle registration, or email, when a match exists, then the user's profile summary and current status (active/suspended) is returned.
5. Given an admin suspends a user with a reason, when the action is submitted, then the user's status changes to suspended, the reason and acting admin are stored, and the user's active sessions stop working on next token refresh (see Group A, item 6 — suspension is enforced at the session-version-check layer, not by scanning JWTs).
6. Given a suspended user is restored, when the action is submitted, then status reverts to active and the reason/actor is stored, and historical records (bookings, past status changes) are preserved unmodified.
7. State change: suspend/restore always requires a reason string (no silent status change is possible via the API).
8. Audit record: every suspend/restore action stores actor (admin user id), timestamp, source (IP), and reason — queryable per user (full "audit timeline" UI comes later in `ADM-04`, Sprint 7 — Sprint 1 just needs the record to exist and be readable).
9. Invalid flow: an admin without RBAC permission for user management (a future role) is rejected with 403, not a silent no-op.

**Out of Scope:** full booking/listing/refund admin operations (`ADM-03`–`ADM-08`, later sprints), MFA flow (field is scaffolded, not built), dual-control approval for sensitive actions, any role beyond `platform_admin`/`support` (Property Manager, Security Staff, etc. get their own login paths in their respective sprints, not through this admin RBAC path).

**Scope check:** Identity & Access Management (§2.1) + Admin Console (§2.14) — both P0, MVP. No P2/P3 exception needed.

**User Experience Flow:**

1. **Login** — email + password, no sign-up path (admin accounts are provisioned, not self-serve). "Forgot password" is a visible link but its flow is out of scope this sprint — stub it to a "contact your admin" message rather than a broken/missing link.
2. Success → a minimal **Admin shell** (nav placeholder for future sections, but only "Users" is live this sprint — don't build empty placeholder screens for `ADM-03`–`ADM-08`, just leave the nav item out until its sprint).
3. **User Search** — a persistent/sticky search bar (phone, user ID, vehicle, email) so a support agent doing repeat lookups never loses it scrolling through results. Results list → click a row → **Detail panel** (profile summary, status, PII masked or unmasked per the acting admin's role) without a full page reload.
4. **Suspend/Restore** — a single-field reason modal (fast, one required text input, immediate confirm) rather than a multi-step confirmation flow; status updates inline in the detail panel on success.
5. Forks: invalid credentials (generic message, doesn't reveal which field was wrong), login rate-limited, no search results (explicit empty state — "No user found for that search," not a blank list that looks like a loading bug), unauthorized action (403 state, for when a future role lacks permission).

This is an internal ops tool used repeatedly by the same few people — optimize for speed of repeated lookups over visual richness, consistent with the Admin Web Console's "dense, scannable, unglamorous" design brief.

**Design research pointers for Kavya** (Mobbin MCP, once connected): internal admin-console user-management screens (search + detail-panel pattern), audit/status-change confirmation modals from B2B ops tools.

**Routing:** Arjun (RBAC model, schema), Rohan (backend), Kavya (minimal Admin Web Console: login + user search/suspend screen), Divya (QA).

---

### Ticket Group C — Driver Profile, Vehicle & Location Context (`DRV-02`, `DRV-03`, `DRV-04`)

**Title:** Driver profile management, vehicle registration, and location-optional destination search groundwork

**User Story:** As a driver, I want to maintain my profile and register my vehicle(s), and have the app work whether or not I grant location access, so that I'm ready to search and book parking.

**Acceptance Criteria:**
1. Given a logged-in driver, when they update name, email, photo, or communication preferences, then the changes persist atomically and are reflected consistently across the app.
2. Given a driver attempts to change their verified phone number, when submitted, then it is rejected — phone stays the verified identity anchor; changing it requires a distinct re-verification flow (not built this sprint, but the profile endpoint must reject a bare phone-field update rather than silently accepting it).
3. Given a driver submits an invalid email format or a name/field exceeding length limits, when submitted, then the update is rejected with field-level validation errors.
4. Given a driver adds a vehicle with registration number, type, and make/model, when submitted, then the vehicle is created and normalized (uppercase, whitespace-stripped registration number) and becomes selectable.
5. Given a driver tries to add a vehicle whose normalized registration number already exists as an *active* vehicle on their account, when submitted, then it is rejected as a duplicate.
6. Given a driver has multiple vehicles, when they mark one as default, then exactly one vehicle is default at a time (setting a new default atomically un-defaults the previous one).
7. Given a driver marks a vehicle inactive (sold), when submitted, then it's excluded from future-booking selection but historical references (none exist yet this sprint — Booking module isn't built) are unaffected in principle.
8. Given a driver denies location permission, when they search a manually entered destination, then search remains fully functional (this sprint: prove the client sends/omits device coordinates correctly and the backend never requires them — full search itself is `SRCH-*`, Sprint 3).
9. Given the device reports a low-accuracy or stale GPS fix, when the app evaluates it, then it's flagged as unreliable and not used for precision actions, without blocking general use.
10. Audit record: profile field changes are logged with actor/timestamp for sensitive fields (email change specifically, since it's a contact/identity channel).

**Out of Scope:** vehicle dimension/size-category-driven booking eligibility (used later by Booking/Search, not enforced here), phone re-verification flow itself, actual destination search/geocoding (`SRCH-01`, Sprint 3) — this ticket only lands the permission-handling groundwork and the client-side location-state plumbing it depends on, commercial/oversized vehicle special rules (flagged as a future rule, not built now).

**Scope check:** Driver Profile & Vehicle Management (§2.2) — P0, MVP. No P2/P3 exception needed.

**User Experience Flow:**

1. **Two entry points, same screens:** (a) as steps 2–3 of the post-signup **onboarding wizard** from Group A, shown once to a new user immediately after OTP success, each step skippable; (b) the account menu, for anyone who skipped, or who wants to edit later — same `ProfileScreen`/`VehicleListScreen` components, no separate "edit mode" variant to maintain.
2. **Profile step / screen** — name/email/photo/comm-prefs editable; phone shown read-only with a "verified" indicator and no edit affordance at all (this is a deliberate UI constraint, not an oversight — it matches the backend's hard rejection of phone-field updates). In the wizard context, this step's CTA is "Continue" with an equally prominent "Skip" — not a de-emphasized link.
3. **Vehicle step / screen** — in the wizard context, presented as "Add your vehicle (recommended)" with the same Skip weighting as the profile step; reached standalone later, it's a **Vehicle list** with an empty state and clear CTA ("No vehicles yet — add one to book faster") rather than a blank list that looks broken. **Add Vehicle** form (registration number, type picker, make/model optional) → on save, returns to the list with the new vehicle visible and a "set as default" affordance.
4. **Location permission** — requested contextually the first time it would actually help (opening search), with a one-line explanation before the OS prompt ("Allow location to show parking near you — search still works without it"), never inside the onboarding wizard and never at first app launch. If denied, search's manual-destination path is the visible primary path, not a degraded fallback bolted on afterward.
5. Nothing in this group blocks first use of the app — the wizard makes profile/vehicle *recommended and visible* right after signup (per the confirmed decision), but skipping is always a complete, unpenalized path, and location permission stays fully separate from the wizard, requested only when actually useful.

**Design research pointers for Kavya** (Mobbin MCP, once connected): profile-edit screens and vehicle/car "add a vehicle" forms from ride-hailing/mobility apps; soft-ask location-permission patterns (the "explain before the OS dialog" approach) rather than a bare OS permission prompt with no context.

**Routing:** Rohan (backend), Kavya (mobile/web profile + vehicle UI, location permission handling), Divya (QA). Arjun's involvement here is light — mostly schema and the "don't overwrite booking-snapshot values" design note for later.

---

## Step 2 — Arjun (Tech Lead): Architecture & Technical Plan

### Technical approach

Everything in this sprint lives in two core domain modules per the architecture doc (§4.2): **Identity/Auth** and **User & Vehicle**. Both are internal modules inside the modular monolith — no service split. Admin RBAC reuses the same Identity/Auth module with a separate `admin_users` identity type rather than overloading the driver `users` table, since admin accounts have a structurally different auth mechanism (password vs OTP) and a different attribute set (role, not vehicles/profile).

### Database schema (Drizzle)

```
users
  id                uuid pk
  phone             text unique not null        -- E.164 normalized, e.g. +919876543210
  name              text
  email             text
  photo_url         text                         -- S3 key, private bucket, presigned GET
  comm_prefs        jsonb                        -- { push, sms, whatsapp, email: boolean }
  status            text not null default 'active'  -- active | suspended -- CHECK (status in ('active','suspended'))
  session_version   int not null default 0        -- bumped on suspend/logout-all; embedded in JWT, checked against cached value
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null default now()

otp_challenges
  id                uuid pk
  phone             text not null
  code_hash         text not null                -- hash, never store raw OTP
  purpose           text not null default 'login' -- CHECK (purpose in ('login','phone_change')) -- room for 'phone_change' later
  expires_at        timestamptz not null
  attempts          int not null default 0
  max_attempts      int not null default 5
  consumed_at       timestamptz
  created_at        timestamptz not null default now()
  index (phone, created_at)                       -- for rate-limit queries

refresh_tokens
  id                uuid pk
  user_type         text not null                -- 'driver' | 'admin' (shared table, discriminated) -- CHECK (user_type in ('driver','admin'))
  user_id           uuid not null
  token_hash        text not null unique          -- store hash, never raw token
  device_label      text                          -- best-effort UA/device string
  family_id         uuid not null                 -- generated once at login, copied unchanged through every rotation in that session's chain
  parent_id         uuid references refresh_tokens(id)  -- rotation chain, kept for forensics/debugging
  revoked_at        timestamptz
  expires_at        timestamptz not null
  created_at        timestamptz not null default now()
  index (user_type, user_id)
  index (family_id)                               -- reuse-detected revoke is a single UPDATE ... WHERE family_id = $1, not a parent_id walk

vehicles
  id                uuid pk
  user_id           uuid not null references users(id)
  registration_no   text not null                -- normalized: uppercase, no whitespace
  type              text not null                 -- hatchback | sedan | suv | bike | commercial ... -- CHECK (type in (...))
  make_model        text
  is_default        boolean not null default false
  status            text not null default 'active'  -- active | inactive -- CHECK (status in ('active','inactive'))
  created_at        timestamptz not null default now()
  unique (user_id, registration_no) where status = 'active'   -- partial unique index: duplicate check is scoped to active vehicles only, and only within the same user_id — see Risk #6 below on cross-user duplicates

admin_users
  id                uuid pk
  email             text unique not null
  password_hash     text not null                -- argon2id
  role              text not null                 -- 'platform_admin' | 'support' -- CHECK (role in ('platform_admin','support'))
  mfa_secret        text                          -- nullable, scaffolded, unused this sprint
  mfa_required      boolean not null default false
  status            text not null default 'active'  -- CHECK (status in ('active','suspended'))
  session_version   int not null default 0
  created_at        timestamptz not null default now()

audit_log
  id                uuid pk
  actor_type        text not null                 -- 'driver' | 'admin' | 'system'
  actor_id          uuid
  action            text not null                 -- e.g. 'user.suspend', 'profile.email_change', 'login.otp_success'
  target_type       text                          -- 'user' | 'vehicle' | 'admin_user'
  target_id         uuid
  reason             text
  source             text                          -- ip / device
  metadata          jsonb                          -- before/after or extra context
  created_at        timestamptz not null default now()
  index (target_type, target_id)
  index (actor_type, actor_id)
```

No geo columns or row-level locking needed this sprint — that starts in Sprint 3 (`INV-03`/`SRCH-*`) and Sprint 4 (`BKG-01`).

**`audit_log` is the shared table every later module writes to** — building it correctly now (per the non-negotiable rule: actor/timestamp/source/reason on every status change) avoids a schema migration fight later when Booking/Payment/Access start writing to it too.

**DB-level `CHECK` constraints added to every enum-like text column above** (`users.status`, `otp_challenges.purpose`, `refresh_tokens.user_type`, `vehicles.type`, `vehicles.status`, `admin_users.role`, `admin_users.status`) — this is the first sprint writing real PII, and a `CHECK` constraint costs nothing at migration time but prevents an application bug from ever writing an invalid status/role string that later code (RBAC checks, suspension enforcement) silently mis-handles. Cheap now, genuinely painful to retrofit once rows with bad values exist.

**`refresh_tokens.family_id` added** so reuse-detection revocation is `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL` — a single indexed query — instead of walking `parent_id` up an arbitrarily long rotation chain (a session refreshed every 15 minutes over a multi-hour driving trip would otherwise mean a growing per-request walk). `parent_id` is kept alongside it for forensic/debugging traceability, not as the revoke mechanism.

### API contract (Fastify)

| Method | Path | Purpose | Notes |
|---|---|---|---|
| `POST` | `/v1/auth/otp/request` | Request OTP for a phone | Body: `{ phone }`. Rate-limited per phone + per IP. |
| `POST` | `/v1/auth/otp/verify` | Verify OTP, issue session | Body: `{ phone, code }`. Returns `{ accessToken, refreshToken, user }`. Idempotent: verifying the same still-valid OTP twice in quick succession must not double-create a user or double-issue tokens for the *same* request (see concurrency plan). |
| `POST` | `/v1/auth/refresh` | Rotate refresh token | Body: `{ refreshToken }`. Returns new pair. Reuse of a revoked/rotated token revokes the whole chain. |
| `POST` | `/v1/auth/logout` | Invalidate current session | Revokes the presented refresh token only (other devices unaffected, per the multi-device decision). |
| `GET` | `/v1/me/profile` | Get driver profile | Auth required. |
| `PATCH` | `/v1/me/profile` | Update driver profile | Rejects `phone` field changes (422, not silently ignored). |
| `GET` | `/v1/me/vehicles` | List driver's vehicles | |
| `POST` | `/v1/me/vehicles` | Register a vehicle | Duplicate-registration check scoped to active vehicles. |
| `PATCH` | `/v1/me/vehicles/:id` | Update / set default / deactivate | Setting `isDefault: true` atomically clears the previous default in the same transaction. |
| `POST` | `/v1/admin/auth/login` | Admin email+password login | Rate-limited per account and IP; generic error on failure. |
| `POST` | `/v1/admin/auth/refresh` | Same rotation scheme as driver | |
| `GET` | `/v1/admin/users` | Search users (phone/id/vehicle/email) | RBAC: both roles; response shape differs — `support` gets masked PII fields. |
| `POST` | `/v1/admin/users/:id/suspend` | Suspend with reason | RBAC: both roles (confirm with product later if `support` should be allowed to suspend, or read-only — **flagged below as a risk**). |
| `POST` | `/v1/admin/users/:id/restore` | Restore with reason | Same RBAC note. |

All error responses use a shared envelope: `{ error: { code, message, details? } }` — Fastify JSON schema validation rejects malformed bodies before they reach business logic (this is *why* Fastify was picked, per `tech-stack.md` §2).

### Concurrency / idempotency plan

- **OTP verify race:** two near-simultaneous `verify` calls with the same valid OTP for a new phone number could both pass validation and try to create a user. Guard: `users.phone` has a unique constraint; the second insert fails and that request path catches the unique-violation and falls back to "load existing user" instead of erroring — so the *outcome* is idempotent (one user, both requests get a valid session) even though the insert itself isn't silently duplicated.
- **OTP consumption:** `otp_challenges.consumed_at` is set inside the same transaction that validates the code, using `UPDATE ... WHERE id = ? AND consumed_at IS NULL RETURNING *` — this makes "consume this OTP" itself atomic and prevents two concurrent requests from both treating the same OTP as freshly valid.
- **Refresh rotation reuse detection:** each refresh token row carries a `family_id` (constant for the life of a login session, set once at initial login and copied unchanged through every rotation) plus `parent_id` for traceability. On `/auth/refresh`, if the presented token's row is already `revoked_at IS NOT NULL`, treat it as a reuse/compromise signal — revoke the whole session with one query, `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1`, and require re-login. This is what actually delivers "logout invalidates refresh token" (`AUTH-01` acceptance criteria) under the JWT approach the user chose, without needing a full access-token denylist.
- **Suspension takes effect via `session_version`, not a JWT denylist:** access JWTs embed `sessionVersion` at issue time. A lightweight Redis cache (`session_version:{userType}:{userId}` → int, sourced from Postgres, short TTL e.g. 60s) is checked on request auth middleware — cheap enough to not defeat the point of stateless JWTs, but bounds "how long can a just-suspended user's existing access token still work" to ~60 seconds instead of the full access-token TTL. `refresh` always re-checks Postgres directly (not the cache), so refresh is never stale. Access token TTL itself should be short (15 min) to keep the worst case small.
  - **Cache-miss / Redis-restart behavior must be fail-safe, not fail-open:** on a cache miss (key absent — cold cache after a Redis restart, or simply not yet populated), the auth middleware queries Postgres synchronously for the current `session_version`, compares it, and then populates the cache — it never treats "no cached value" as "assume still valid." Given `docs/tech-stack.md` §6 explicitly designs Redis to be disposable and restartable, a fail-open read here would silently reopen the ~60s suspension-enforcement window to the full access-token TTL (15 min) every time Redis restarts, which defeats the whole point of the cache. This is cheap to get right now and easy to get wrong silently later, so it's called out explicitly rather than left as an implementation detail.
- **OTP/admin-login rate limiter must fail closed, not fail open, if Redis is unreachable:** `AUTH-04`'s per-phone/per-IP counters live in Redis. If Redis is down, the request must be rejected with a generic "service temporarily unavailable, try again shortly" error rather than silently proceeding as if the caller were under the limit — OTP sends cost real SMS money per request and are the exact vector `TR-04` (fraud/abuse controls) will later need to have stayed bounded, so unlimited unrated OTP sends during a Redis outage is a real (if narrow-window) cost/abuse exposure, not just a degraded-UX concern. Admin login rate limiting gets the same treatment for the same reason (credential-stuffing exposure).
- **Vehicle default-swap:** `PATCH .../vehicles/:id { isDefault: true }` runs `UPDATE vehicles SET is_default = false WHERE user_id = $1 AND is_default = true` and the target row's `is_default = true` in one transaction — not two separate round trips, to avoid a moment where either zero or two vehicles are default.

### Job/queue plan

Nothing in this sprint needs BullMQ. `otp_challenges` cleanup (deleting/expiring old rows) is cheap enough as a query-time filter (`WHERE expires_at > now()`) plus an optional daily cron later — not worth a dedicated job this sprint, consistent with the "deliberately not jobs" note in `tech-stack.md` §6 for similarly cheap expiry checks.

### External integration touchpoints

- **SMS/OTP provider** goes through the `OtpProvider` interface (`tech-stack.md` §8). This sprint runs exclusively on `SMS_PROVIDER=mock` — the mock accepts `DEV_OTP_BYPASS_CODE` (default `1234`) but still runs real expiry/attempt-limit logic against it, per the documented mock behavior. **The production-boot guard (non-negotiable rule #5) must exist from this sprint on**, even though there's no real provider yet — the app must refuse to boot with `SMS_PROVIDER=mock` or `DEV_OTP_BYPASS_CODE` set if `NODE_ENV=production` (or equivalent flag). This is cheap to build now and dangerous to bolt on later.

### Risks / concerns to flag

1. **`support` role suspend/restore permission is undecided** — spec doesn't say whether Support can suspend or only view. Defaulting to "both roles can suspend/restore, only `platform_admin` sees unmasked PII" for Sprint 1; flagging for explicit product confirmation before Sprint 7 builds the fuller admin console. Low risk to change later (it's a permission check, not a schema change).
2. **Refresh-token reuse detection adds real complexity** to what the user picked as the "simpler, stateless" option — Rohan should budget for this properly rather than treating it as an afterthought; it's what makes the JWT approach actually satisfy the spec's logout/suspension acceptance criteria.
3. **Phone re-verification flow is explicitly out of scope** but the profile endpoint's rejection of phone-field updates needs to ship now anyway, or a driver could silently take over another phone number's identity via a profile PATCH.
4. **No geo/location work is real geocoding yet** — `DRV-04` this sprint is permission-state plumbing only; don't let scope creep into building `SRCH-01`'s geocoding early.
5. **Shared-package scaffolding (`design-tokens`/`ui-web`/`ui-native`) is genuine up-front cost added to Sprint 1** — it's worth it precisely because this is the first UI sprint (every later sprint reuses these primitives instead of re-paying this cost per surface), but it means Kavya's first screens land slightly later than if she'd built them one-off. Budget for it explicitly rather than treating it as free.
6. **OPEN ITEM — needs a product decision, not silently defaulted: should `vehicles.registration_no` uniqueness be scoped per-user (as designed) or global across all active vehicles?** The current partial unique index (`user_id, registration_no) where status = 'active'`) allows two different ParkAway users to simultaneously have the *same* registration number as an active vehicle — which is the correct behavior for a legitimate used-car transfer (seller marks it inactive, buyer adds it fresh) but is indistinguishable, at the schema level, from one user impersonating another's vehicle. This doesn't block Sprint 1 (no booking/access-control consumes this yet), but the uniqueness scope is a schema decision that gets harder to tighten later once real vehicles exist under both patterns. Flagging for the user/product to confirm before `ACC-03` (vehicle verification, Sprint 5) and `TR-04` (fraud controls) start depending on this table — options include global-unique-while-active (reject the second user's add, force a transfer/dispute flow) or the current per-user scope plus a fraud-signal flag when the same plate appears active under >1 user. Not deciding this now; leaving it open.
7. **OPEN ITEM — needs a product decision, not silently defaulted: phone-number recycling / dormant-account takeover.** Indian telecom operators routinely recycle mobile numbers after a period of dormancy (commonly ~90 days of inactivity). Because OTP-to-a-phone-number is this system's entire identity anchor (`AUTH-01`, `users.phone` as the unique identity key), a new person who is assigned a previously-used number can OTP-log-in as the *previous* owner's account — inheriting their profile, vehicles, and (once later sprints add them) booking history and payment methods. Nothing in this sprint's plan, the Engineering Gate, or `docs/tech-stack.md` addresses this. It's arguably acceptable to ship Sprint 1 without a mitigation (low absolute volume at pilot scale, and the spec doesn't call it out), but it is a real, known gap in an OTP-only-identity design and should be a conscious call, not an oversight discovered after an account-takeover complaint. Flagging for the user to decide the mitigation approach and timing — options include: a dormancy-based re-verification prompt (e.g., "confirm this is still you" after N months of inactivity, tied to `otp_challenges.purpose`already having room for a non-login purpose), profile-data masking/reset on suspiciously-long-gap logins, or accepting the risk explicitly at this scale and revisiting post-pilot. Relevant to Engineering Gate item `GATE-11` (PII/KYC/payment data handling and retention).

### Task breakdown

**Rohan (backend):**
- Schema + migrations: `users`, `otp_challenges`, `refresh_tokens`, `vehicles`, `admin_users`, `audit_log`
- `OtpProvider` interface + mock implementation, with the production-boot guard
- `POST /v1/auth/otp/request` + `/verify` with rate limiting (Redis-backed counters: per-phone and per-IP)
- JWT issuance/verification middleware, `session_version` Redis-cache check
- Refresh rotation + reuse-detection logic, `/v1/auth/refresh`, `/v1/auth/logout`
- Driver profile + vehicle endpoints, with the phone-field rejection and default-vehicle transaction
- Admin auth (bcrypt/argon2 password), admin RBAC middleware, `/v1/admin/users` search with PII masking for `support`
- Suspend/restore endpoints writing to `audit_log`
- Audit logging helper used by every status-changing endpoint above
- **Admin PII search queries also write to `audit_log`** (`action: 'admin.user_search'`, `metadata: { query }`, no separate schema change needed — reuses the existing `audit.service.ts` helper). This isn't a status-changing action, so it sits outside the letter of the non-negotiable audit rule, but a search against real driver PII (phone/email lookups) is exactly the kind of access `GATE-11` (PII/KYC data handling and retention) is meant to cover — without it, there's no way to investigate insider misuse of the admin search tool later. Cheap to add now since the helper and table already exist for this sprint.
- **Bootstrap script/CLI for the first `platform_admin` account.** Admin login has no self-serve signup path by design (Ticket Group B), which means without a one-time seed mechanism nobody can log into the Admin Web Console after the first deploy. A small seed script (reads email + a securely-generated password or a `--generate` flag, argon2-hashes it, inserts the row) is a Sprint 1 deliverable, not an afterthought — flagged here since it's easy to discover missing only when someone actually tries to log in post-deploy.

**Kavya (frontend/mobile):**
- **Scaffold `packages/design-tokens`, `packages/ui-web`, `packages/ui-native`** and the initial primitive set (`Button`, `TextField`/`FormField`, `OtpInput`, `Modal`, `EmptyState`, `WizardStep`, `ListRow`, `Toast`) before/alongside the screens below — this is foundational for the sprint, not cleanup after
- Driver Mobile App: phone-entry → OTP-entry → home flow, session/token storage, logout
- Driver Web: same OTP flow, lightweight version
- Driver Mobile App + Web: `OnboardingWizard` (skippable profile + vehicle steps), standalone profile edit screen, vehicle list/add/edit/default-select screen — all built from the shared primitives, not one-off per surface
- Driver Mobile App: location-permission prompt/state handling (no map/search UI yet — that's Sprint 3)
- Admin Web Console (new, minimal): login screen, user search screen with role-aware masked/unmasked display, suspend/restore action with reason input — reusing the same `ui-web` primitives as Driver Web, themed for the admin surface

---

## Step 3 — Kavya & Rohan: Implementation Plan

### Kavya — Frontend/Mobile Plan

**Client surfaces touched:** Driver Mobile App, Driver Web, Admin Web Console (new — first screens for this surface).

**Design research & visual direction:** the Mobbin MCP isn't connected in this session yet (the user is setting it up before implementation starts) — this section states the intended direction and what to validate against real references once it's available, rather than skipping design thinking until then.

- **Driver Mobile App / Driver Web (OTP login, profile, vehicles):** warm, fast, reassuring — per the frontend design philosophy, this is not generic marketplace chrome. Concretely: a warm neutral (not stark-white or generic blue/purple-gradient) background, one confident accent color reserved *only* for primary CTAs and status states (not scattered across the UI), generous tap targets, and — deliberately — an almost-empty phone/OTP screen with no illustration slot or marketing copy competing with the single task. Avoid the two most common AI-slop tells: a centered card floating on a gradient blob, and a generic system sans font standing in for a brand identity. **Before building, pull real references** via `search_flows`/`search_screens` for OTP/phone-first onboarding in mobility and marketplace apps, and validate this direction against them rather than treating it as final.
- **Admin Web Console (login, user search/suspend):** dense, scannable, unglamorous, per the design philosophy — this is a repeated-use internal tool, not a marketing surface. Concretely: tabular figures for phone numbers/IDs so columns align, a neutral gray palette with one functional accent for primary actions and a distinct (not just red-text) treatment for the suspended state, a sticky search bar, and layout that favors fast repeated lookups over visual richness. **Before building, pull references** via `search_screens`/`search_sections` for admin/ops-console user-management and search+detail-panel patterns.
- Both directions are proposals for Arjun to sanction as the project's early design-system seed (palette, type scale) — not a unilateral lock-in, per the "flag design-system decisions" responsibility.

**Reusable component inventory — this is the founding sprint for the shared package structure.** Sprint 1 is the first ticket touching any client UI, so this is where `packages/design-tokens`, `packages/ui-web`, and `packages/ui-native` get scaffolded for the first time, not an optional nice-to-have layered on later. Every screen above should be built by composing the primitives below, not by hand-rolling per-screen styling:

| Primitive | Package | Used by (this sprint) | Notes |
|---|---|---|---|
| `Button` | `ui-web` + `ui-native` | every screen | Variant prop carries the per-surface theme (Driver "confident CTA" vs. Admin "compact action"), same component |
| `TextField` / `FormField` | `ui-web` + `ui-native` | Profile, Vehicle form, Admin login, Admin search | Wraps label + input + inline validation error consistently — no screen reimplements its own error-message layout |
| `OtpInput` | `ui-native` (+ `ui-web` for Driver Web) | `OtpEntryScreen` | New this sprint; used nowhere else yet, but built as a shared primitive since Group A explicitly needs it on two surfaces (mobile + web) |
| `Modal` / `Dialog` | `ui-web` + `ui-native` | Suspend/restore reason modal (Admin), vehicle default-confirm (Driver) | One implementation, themed per surface |
| `EmptyState` | `ui-web` + `ui-native` | Vehicle list ("no vehicles yet"), Admin search ("no user found") | Same component, different copy/illustration-or-lack-thereof per the design direction above |
| `WizardStep` / `ProgressIndicator` | `ui-web` + `ui-native` | `OnboardingWizard` | New this sprint; the "doesn't guilt-trip" progress treatment lives here once, reusable if a second wizard-shaped flow appears later (e.g. Host onboarding, Sprint 2) |
| `ListRow` / `Table` | `ui-web` | `UserSearchScreen` | Admin-console-specific density variant of a shared list primitive |
| `Toast` / `InlineBanner` | `ui-web` + `ui-native` | rate-limit/suspended-account error messaging, skip confirmations | Consistent, non-generic error/status presentation instead of ad hoc alerts per screen |

Anything not in this table that a screen seems to need should default to composing/theming one of the above rather than a new one-off component — if none fit, flag the gap to Arjun before adding a new shared primitive, same as any other design-system decision.

**Screens/components:**
- `PhoneEntryScreen`, `OtpEntryScreen` (shared component logic between Driver Mobile App and Driver Web where the RN/web split allows it)
- `OnboardingWizard` — thin new-user-only wrapper shown once after OTP success; steps through `ProfileScreen` and `VehicleFormScreen` in a "recommended" framing, with a first-class `Skip` action on every step (equal visual weight to `Continue`) and a progress indicator that doesn't read as a guilt/pressure device. Exits to home on completion *or* skip, and never reappears once dismissed.
- `ProfileScreen` (view/edit name, email, photo, comm prefs) — same component whether reached inside the wizard or standalone from the account menu
- `VehicleListScreen`, `VehicleFormScreen` (add/edit, default-toggle, deactivate) — `VehicleFormScreen` is also the wizard's vehicle step
- Admin Web Console: `AdminLoginScreen`, `UserSearchScreen` (table/list with masked-field rendering driven by the role returned in the session, not a client-side guess), `UserDetailPanel` with suspend/restore action + reason modal

**API integration plan:** matches Arjun's contract above 1:1. Access token attached via `Authorization: Bearer`; refresh handled by an interceptor that calls `/auth/refresh` on 401 and retries once, redirecting to login on a second failure (covers the reuse-detection revoke-everything case gracefully).

**Form/validation approach:** client-side validation mirrors server rules (email format, registration-number format) for fast feedback, but the server remains authoritative — no client-only validation is trusted for the actual write.

**Map/geo UI needs:** none this sprint. `DRV-04` here is just capturing/storing permission state and gating whether device coordinates are sent — no map render yet.

**Upload flow:** profile photo goes client → S3 via presigned URL (per the non-negotiable rule), client then PATCHes `/me/profile` with the resulting S3 key, not the file itself.

**Flag to Arjun — state management:** no state-management library is locked in `tech-stack.md`. Proposing **React Query (TanStack Query)** for server-state (session, profile, vehicles) plus local component state for forms — this avoids a heavier global-store decision (Redux/Zustand) before there's enough cross-screen shared state to justify it. Flagging this as a default, not a unilateral lock-in, since later sprints (Search/Booking) may need real client-side global state (active hold countdown, cart-like flow) that revisits this.

### Rohan — Backend Plan

**Endpoints:** as listed in Arjun's API contract table above.

**Route → service → repository layering:**
- `auth` module: `otp.service.ts` (request/verify/rate-limit), `session.service.ts` (issue/refresh/revoke, session_version logic), `admin-auth.service.ts`
- `identity` module: `user.repository.ts`, `vehicle.repository.ts`, `profile.service.ts`, `vehicle.service.ts`
- `admin` module: `user-management.service.ts` (search + masking + suspend/restore), `admin-user.repository.ts`
- Shared: `audit.service.ts` — single `record(actorType, actorId, action, target, reason?, metadata?)` call used by every status-changing path, so audit-writing is never ad hoc per-route.

**Drizzle schema/migrations:** as specified above — one migration per table is fine at this stage given they're mostly independent (partial unique index on `vehicles` needs its own migration step if Drizzle's migration generator doesn't express partial indexes cleanly — verify during implementation).

**BullMQ jobs:** none this sprint (see Arjun's job/queue plan).

**Provider adapter usage:** `OtpProvider` (mock only, per §8), with the hard production-boot check implemented as a startup guard (fail fast, not a runtime check per-request).

**S3 usage:** profile photo bucket is public-read + CDN-fronted per `tech-stack.md` §7 (listing/profile photos are explicitly the public-read category); presigned `PUT` generation endpoint needed: `POST /v1/me/profile/photo-upload-url`.

**Audit trail fields:** every suspend/restore/email-change writes actor, timestamp, source (IP), reason (reason required for suspend/restore; optional-but-recommended for profile changes).

**Error handling and idempotency guarantees:** as detailed in Arjun's concurrency/idempotency plan — unique-constraint-driven idempotency for OTP-verify user creation, atomic OTP consumption, refresh-chain reuse detection, transactional default-vehicle swap.

---

## Step 4 — Divya (QA): Test Plan

### Test types required

| Layer | Tool | Covers |
|---|---|---|
| Backend unit/service | Vitest | OTP validation logic, rate-limit counter logic, JWT issuance/claims, phone normalization, registration-number normalization |
| Backend API/integration | Fastify `.inject()` + Vitest | Each endpoint's request/response schema, error envelope, RBAC rejection paths |
| Backend concurrency | Testcontainers (real Postgres + Redis) | The races called out below — these cannot be trusted against mocks |
| Web unit/component | Vitest + RTL | Form validation, masked-field rendering logic in Admin Web Console |
| Web E2E | Playwright | Full OTP login → profile → vehicle flow on Driver Web; Admin login → search → suspend flow |
| Mobile unit | Jest + RNTL | Same coverage as web unit, RN-specific |
| Mobile E2E | Maestro | OTP login → profile → vehicle flow on Driver Mobile App |

### Concurrency/idempotency cases (required, not optional — spec §24)

This ticket touches identity/session state, which the non-negotiable rules treat with the same seriousness as booking/payment for idempotency purposes:

1. **Duplicate account race:** two concurrent `otp/verify` calls for the same new phone number with a valid OTP — assert exactly one `users` row is created and both requests receive a valid session for that same user (Testcontainers, real Postgres unique constraint).
2. **OTP double-consumption:** two concurrent `otp/verify` calls with the same OTP code — assert only one succeeds cleanly and the second gets a clear "already used/invalid" response, not a silent duplicate success.
3. **Refresh-token replay:** call `/auth/refresh` with a valid token, then replay the *same* (now-rotated-away) token — assert the second call is rejected and the entire session chain is revoked (a subsequent legitimate refresh with the newest token also fails).
4. **Rate-limit boundary:** exactly 5 OTP requests succeed within the window, the 6th is rejected — test the boundary, not just "some requests get through."
5. **Vehicle default-swap race:** two concurrent `PATCH .../vehicles/:id { isDefault: true }` calls for two different vehicles on the same user — assert exactly one vehicle ends up default, never zero or two (Testcontainers, real row locking/transaction behavior).
6. **Suspend-mid-session:** suspend a user with an active access token — assert the access token still technically decodes but is rejected once the session-version cache reflects the suspension (bound the acceptable staleness window per Arjun's ~60s design and assert it's actually bounded, not indefinite).
7. **Session-version cache-miss after Redis restart:** suspend a user, flush/clear the `session_version` cache key (simulating a cold cache after Redis restart) *before* the ~60s TTL would naturally have expired it, then present the still-technically-valid access token — assert the middleware falls through to Postgres and rejects the request, not fail-open on the missing cache key (Testcontainers, real Redis).
8. **OTP rate-limiter fail-closed under Redis outage:** with the Redis rate-limit backend unavailable/unreachable, call `otp/request` — assert the request is rejected with a clear "temporarily unavailable" error and no SMS dispatch is attempted, rather than silently succeeding unrated.

### Fixtures/mocks needed

- Mock `OtpProvider` must support: normal send, forced-failure mode (simulate provider outage — was this ticket's "provider failure" case handled with a clear user-facing error and no half-created state?), and returning `DEV_OTP_BYPASS_CODE` for E2E runs so Playwright/Maestro don't need to intercept SMS content.
- **Gap flagged:** no existing mock exists yet for the admin password/MFA path (there's no `AdminAuthProvider` abstraction, nor does one need to be — password auth isn't a third-party integration). Confirm with Rohan there's a seeded test admin account (one `platform_admin`, one `support`) in the Testcontainers/E2E fixture set.

### What "done" means for this ticket (test terms)

Not sufficient: "a driver can log in with the happy-path OTP and Playwright confirms a token comes back." Required before this sprint is called done:
- All 8 concurrency/idempotency cases above pass against real Postgres+Redis (Testcontainers), not mocks.
- Suspended-account login is explicitly tested (not just "active account works").
- Masked-vs-unmasked PII rendering is tested for both admin roles, not just `platform_admin`.
- Phone-field-change rejection on profile PATCH is explicitly tested (easy to silently regress).
- Rate-limit rejection responses are asserted to *not* consume/count against the OTP-attempt limiter (a rejected request and a wrong-OTP attempt are different failure modes and must be distinguishable in tests).
- **Onboarding wizard skip path (E2E, mobile + web):** a new user can skip the profile step, skip the vehicle step, or skip both, and in every combination lands in the normal home/search-ready state with no error, no forced retry, and no residual "incomplete onboarding" state blocking anything. Also test the completed-wizard path and confirm the wizard never reappears on a subsequent login for that user.

---

## Step 5 — Nikhil (DevOps): Deployment Notes

Applicable this sprint — new secrets and one structural safety check are introduced.

- **New environment variables/secrets:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (or asymmetric keypair if Arjun prefers RS256 — either is fine, but pick one and document it), `SMS_PROVIDER` (=`mock` for now), `DEV_OTP_BYPASS_CODE`, `ADMIN_PASSWORD_HASH_COST` (argon2/bcrypt work factor), `SESSION_VERSION_CACHE_TTL_SECONDS`. All of these need to exist in the EC2 instance's env/secrets file, not committed to the repo.
- **Structural production guard (non-negotiable rule #5) needs a deployable check, not just app-level code:** confirm the EC2 deploy process actually sets `NODE_ENV=production` (or whatever flag the boot guard checks) — if the deploy script doesn't set it, the app-level guard has nothing to trigger on. This is worth a one-line smoke check in the deploy script itself: fail the deploy if the app fails to boot in the production config.
- **Migration rollout:** all tables this sprint are new (no existing data to migrate/backfill) — safe to apply directly, no downtime risk.
- **No new BullMQ worker/process** this sprint (see job/queue plan) — no scaling consideration yet.
- **Backup/retention implication:** `users`, `admin_users`, and `audit_log` now hold real PII (phone, email, admin credentials-as-hashes) for the first time. Confirm the `pg_dump`-to-S3 cron (per `tech-stack.md` §10) is actually running before this sprint's data is real, not synthetic — this is the first sprint where losing the DB means losing real user signups, not just test fixtures.
- **Redis outage now has a defined, checked failure mode, not just an assumed one:** per Arjun/Rohan's plan, both the OTP/admin-login rate limiter and the `session_version` suspension check fail closed (reject the request / re-check Postgres) rather than fail open when Redis is unreachable or a cache key is missing after a restart. Worth a one-line runbook note: a Redis outage on this single-instance setup means OTP login and admin login temporarily stop working (fail closed, not silently insecure) until Redis is back — this is the correct tradeoff for a marketplace where SMS-cost abuse and account-takeover risk outweigh short-window availability, but it should be a known, monitored failure mode (surface Redis connectivity on the health check endpoint) rather than a surprise the first time Redis restarts in production.
- **Bootstrap step for the first `platform_admin` account** (see Rohan's plan) needs to run once as part of this sprint's initial deploy — note it in the deploy runbook so it isn't a one-time tribal-knowledge step.
- **Does not yet push the single-EC2 setup toward its limits** — auth/profile/vehicle traffic is low-volume; no concern to flag here.
- **Reminder, not a Sprint 1 blocker:** the tracked pre-launch task (non-negotiable rule #11 — Postgres/Redis move off public internet exposure before production) is unaffected by this sprint but becomes more urgent the moment real user PII exists in the dev-exposed database. Worth scheduling that migration sooner rather than exactly "right before launch," given real phone numbers/emails will now sit behind a publicly reachable connection string.

---

## Step 6 — Arjun (Tech Lead): Final Checklist

- [x] API contract agreed between Kavya and Rohan (table in Step 2)
- [x] No unresolved architecture risks — session/device/admin-auth/RBAC-role decisions confirmed with user; remaining items (Support suspend permission) are flagged as low-risk, changeable later
- [x] Drizzle schema changes are clear; all-new tables this sprint, no migration-safety concern
- [x] Acceptance criteria are implementable and testable (Step 1 ACs map directly to Step 4 test cases)
- [x] Concurrency/idempotency verified for anything touching session/account state (OTP double-consumption, duplicate-account race, refresh-token reuse, vehicle default-swap) — this sprint doesn't touch inventory/payment, but identity-state races get the same rigor per the non-negotiable rules
- [x] Divya's test plan covers concurrency/idempotency cases, not just happy path (6 explicit cases in Step 4)
- [x] External integration (OTP/SMS) goes through the provider-adapter interface, mock-only this sprint, with the production-boot guard built now rather than deferred
- [x] Audit trail fields present for every status-changing action (suspend, restore, email change, login/logout events)
- [x] Feature confirmed in-scope for current phase — both ticket groups are P0/MVP, no P2/P3 exception needed
- [x] Nikhil's deployment notes don't reveal a blocker on the current EC2 setup — new secrets only, no scaling concern
- [ ] **Shared component package structure (`design-tokens`/`ui-web`/`ui-native`) is a proposal, not yet Arjun-sanctioned:** confirm the package shape and initial primitive inventory (Step 3) before Kavya scaffolds it — this becomes a project-wide convention every later sprint inherits, so it's worth a deliberate look now rather than accepting the default silently.
- [ ] **Design direction stated, not yet validated against real references:** Kavya's visual direction for Driver surfaces and Admin Web Console (Step 3) is a proposal grounded in the design philosophy but not yet checked against Mobbin research — the Mobbin MCP isn't connected yet. Validate the direction against real references as soon as the MCP is available, before screens are finalized, and treat the palette/type-scale proposal as Arjun's to sanction, not settled.
- [ ] **Open blocker to resolve before/during Sprint 1, not before starting:** confirm whether `support` role can suspend/restore or is read-only-plus-masked (Risk #1, Step 2) — doesn't block starting the schema/auth work, but must be resolved before the suspend/restore endpoint's RBAC check ships
- [ ] **Sprint 0 note:** the Engineering Gate (`02-kanban-board.md` "To Do (Sprint 0)") is not yet checked off in this repo. None of Sprint 1's gate items (`GATE-01`–`GATE-09`, which are booking/payment/access/dispute-specific) block this identity-focused sprint, but `GATE-10` (admin override permissions) and `GATE-11` (PII/KYC/payment data handling & retention) are directly relevant to what's being built here (admin suspend = an override; users/admin_users hold PII) and should be formally signed off in parallel, not skipped.
- [x] **Architecture review pass (post-planning, pre-implementation) applied the following fixes directly to this document:** DB-level `CHECK` constraints on every enum-like column; `refresh_tokens.family_id` for O(1) reuse-detection revoke instead of a `parent_id` walk; explicit fail-safe (not fail-open) behavior for the `session_version` cache on a miss/Redis-restart; explicit fail-closed behavior for the OTP/admin-login rate limiter on Redis unavailability; admin PII-search audit logging; a bootstrap/seed step for the first `platform_admin` account. Corresponding Divya test cases (#7, #8) and Nikhil deployment-runbook notes were added alongside each.
- [x] **RESOLVED (2026-09-21):** `vehicles.registration_no` uniqueness is **global**, not per-user — the user decided against the originally-shipped per-user scope. A plate can be active on only one account system-wide; a previous owner must deactivate their vehicle before a new owner can register the same plate (tested: `test/integration/concurrency.test.ts`, "Vehicle registration uniqueness" — cross-user rejection and post-deactivation transfer both verified against real Postgres, plus live end-to-end). Migration `0002_old_justin_hammer.sql` drops the old per-user partial index and replaces it with `vehicles_registration_no_active_idx` (registration_no only). **Also added while implementing this:** proper Indian registration-number format validation (`KA05HR1096`-style: 2-letter state code, 1-2 digit RTO code, 0-2 letter series, 4-digit number) replacing the old bare length check, in `lib/normalize.ts`'s `isValidIndianRegistrationNumber`.
- [x] **Real bug found and fixed while adding this feature's test:** `pgConstraintName()` in `lib/pgErrors.ts` had a latent bug (`messageOf(err) ?? messageOf(getCause(err))` never actually reached the cause, since the outer `DrizzleQueryError.message` is always a non-empty string) that made it silently always return `undefined`. This meant the constraint-specific recovery logic in both `addVehicle` (default-vehicle race retry) and `updateVehicle` (default-swap retry loop) never actually ran — the DB-level guarantees these describe (see the earlier sign-off) still held, but the *graceful, no-error-surfaced* retry behavior on top of them did not. Fixed by reading postgres.js's `constraint_name` field directly instead of regex-parsing `.message`. Caught by writing a precise test (assert the *converted* `ConflictError`, not just "something rejected") rather than a loose one.
- [ ] **OPEN ITEM — needs the user's product decision, not silently defaulted (added during architecture review):** phone-number-recycling / dormant-account-takeover risk, inherent to an OTP-only identity anchor. See Risk #7, Step 2. Does not block Sprint 1; flagged against `GATE-11` for a conscious accept-or-mitigate decision before real user volume grows.

---

## Step 6 (continued) — Arjun's post-implementation sign-off (2026-09-21)

The checklist above was written before a line of code existed. It's done now — backend, both web apps, the mobile app, the shared design system, tests, and lint are all built, verified, and pushed to `main`. This is my actual review of what shipped, not the plan.

**Shared component package structure (`design-tokens`/`ui-web`/`ui-native`) — signed off.** I looked at the actual shape, not just the proposal: one numeric scale in `design-tokens` (spacing/type/radius/motion) with two color themes derived from it, `ui-web` and `ui-native` each implementing the same primitive set against that scale with matching names and prop shapes wherever the platform allows it. It's appropriately minimal for what two-and-a-bit surfaces need right now — no premature abstraction for the Host/Security surfaces that don't exist yet (the native theme file says so explicitly rather than pre-building a generic multi-theme system nobody's using). This is now the project-wide convention; every later sprint's UI work extends these three packages rather than reaching for a new pattern.

One tradeoff I'm accepting knowingly rather than fixing now: `ui-web` and `ui-native` are two independent implementations of the same component contract (same `Button` props, different code), with nothing enforcing they stay behaviorally in sync beyond convention and code review. Fine at three components' worth of surfaces; worth a shared prop-contract test (or a docs page listing the contract explicitly) if a fourth native or web surface joins and drift starts actually happening. Not a blocker, just naming the risk so it doesn't get rediscovered cold later.

**Design direction — still not Mobbin-validated, and that's fine for now.** The Mobbin MCP was never connected this session. The visual direction (warm terracotta/cream for driver surfaces, cool neutral/deep teal for admin) is a reasoned proposal against the design philosophy, not a rubber stamp — I'm comfortable calling it good enough to ship Sprint 1 on. Validate it against real references the first time Kavya has Mobbin available, before the *next* new screen ships, not as a blocking retrofit of what already exists.

**Concurrency/idempotency — upgraded from "designed for it" to "verified by real tests," including two bugs the tests actually caught.** The original checklist entry above checked this off based on design intent before Testcontainers tests existed. They exist now (`apps/api/test/integration/concurrency.test.ts`, real Postgres + Redis, not mocks), and they did their job: the refresh-token rotation race and the vehicle default-swap race were both real bugs in the first implementation, not hypothetical ones, and both are now fixed at the layer that actually guarantees correctness (an atomic claim UPDATE, and a database partial unique index, respectively — not just "be more careful in the application code"). This is the concurrency discipline the non-negotiable rules ask for, actually exercised, not just asserted.

**Lint — new criterion, passed.** Wasn't in the original checklist because it didn't exist yet. One `eslint.config.js` for the whole monorepo, zero errors or warnings as of the last run, and the findings it did surface (missing error `cause` chains, a `set-state-in-effect` anti-pattern, dead eslint-disable comments) were fixed at the root cause, not suppressed. `npm run lint` after every development pass is now a standing expectation, documented in `CLAUDE.md` — not optional going forward.

**Mobile — signed off with the same bar as the web apps, verification gap noted honestly.** `apps/driver-mobile` typechecks clean and produces a working Metro bundle (897 modules). It has not been tapped through on an actual device or emulator, because none was available this session. I'm not calling that "done" — I'm calling it "built and structurally verified, functionally unverified." Whoever picks this up next should do a real device pass (Expo Go is the fastest path — no SDK/emulator install needed) before treating the mobile surface as equivalent-confidence to the web apps, which at least got component-level rendering tests.

### Verdict

**Sprint 1 is signed off as complete and shippable for what it claims to be: a P0/MVP identity foundation, not a finished product.** Nothing here blocks starting Sprint 2 (Property & Listing Foundation).

**Four items still need your call, not mine — I can't make these for you:**
1. Can the `support` admin role suspend/restore users, or should it be read-only-plus-masked? Currently shipped as "can suspend" by default. Low cost to change (a permission check, not a schema change) but should be a decision, not a default that quietly became permanent because nobody revisited it.
2. `vehicles.registration_no` uniqueness — per-user (current) or global-while-active? Gets harder to change the longer it's live; needs resolving before Sprint 5/6 (`ACC-03`/`TR-04`) build on this table.
3. Phone-number-recycling identity risk — accept at pilot scale, or mitigate now (e.g. a dormancy re-verification prompt)? Tie this to `GATE-11`.
4. The Sprint 0 Engineering Gate is still not formally checked off anywhere in this repo. Doesn't block Sprint 1 or 2, but `GATE-10` (admin overrides) and `GATE-11` (PII/KYC retention) are directly relevant to code that's now live with real PII in it — worth closing the loop rather than letting "we'll do it later" become "we never did it."
