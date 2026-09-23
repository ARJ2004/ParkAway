# ParkAway — Sprint 2 Detailed Plan: Property & Listing Foundation

## Implementation status (2026-09-24) — 2A spine, Admin moderation UI, and 2B/2C frontend (web + mobile) all built and tested

**Update 2026-09-24: the mobile deferral below has been paid off.** `driver-mobile` now has the full owner persona — `PersonaScreen`, `PersonaSwitchPill`, a bottom-tab `OwnerStack`, property creation (GPS-based `LocationField`, no Mapbox key provisioned so this is coordinate capture, not a pin-drop map — same bounded scope as web's `MapPicker`), the 5-step listing wizard (fit/photos/access/price/review) with an `expo-image-picker`-based `PhotoPicker` doing a real presign→PUT→complete round trip, and host KYC/payout screens. `apps/admin-web` also gained a host KYC review screen (`/hosts/:id/kyc`) beyond the moderation queue described below. Also fixed this pass, once real device/browser testing (not just curl) surfaced them: bodyless-mutation requests 500ing (`Content-Type` sent with no body), mock storage URLs hardcoded to `localhost` (broke photo loads on a real phone — fixed via a per-request `AsyncLocalStorage` origin), and a systemic "current transaction is aborted" bug where a caught unique-violation mid-transaction poisoned every later query on that transaction (fixed in three places with nested-transaction SAVEPOINTs, two new regression tests added). A unified design system refresh (one `parkAwayTheme`, Marcellus/Manrope type) was also applied across mobile and the shared packages, sourced from the user's own Claude-Artifact mockup. Full detail in `docs/PROGRESS.md`'s "Sprint 2" section — this header is left otherwise unchanged as the record of the original 2A/2B/2C web-first pass.

## Original implementation status (2026-09-23) — 2A spine + Admin moderation UI built and tested; 2B/2C frontend built for web; mobile deferred

**Backend (`apps/api`) 2A spine is implemented and both unit- and Testcontainers-tested.** All six migrations (PostGIS extension isolated first, then `user_roles`+`last_persona`, then the property/host/listing/pricing tables) are applied. Built: `StorageProvider` (mock + S3) with presign routes and the mock-storage dev routes exercising a real presign→PUT→complete round trip; `MapsProvider` (mock + Mapbox) plus `/v1/geocode`/`/v1/reverse-geocode`; the persona endpoints + `requireRole`/`requirePropertyScope`; properties + authorizations (with the R1 `FOR UPDATE` lock on both the grant and revoke paths) + versioned access policies; host profiles + documents + AES-256-GCM payout encryption (`lib/fieldCrypto.ts`); listings + photos + the lifecycle state machine + `resolvePrice()`; admin moderation (approve/reject/suspend, KYC review, audited document downloads, audited payout reveal); the BullMQ verification-expiry sweep job (`npm run worker`). 59 backend tests pass (up from Sprint 1's 38): the existing suite plus new pricing-precedence and payout-encryption unit tests, plus six new Testcontainers concurrency tests covering R1 (the flagship authorization-revoke-vs-publish race), R2 (two admins approving one listing), R3 (concurrent pricing edits), R4 (concurrent cover-photo sets), and two DB-constraint races (concurrent host-profile creation, concurrent owner-persona selection).

**Two real bugs were found and fixed by tests, not by review, same discipline as Sprint 1:**
1. **The pricing resolver used the server process's local system timezone** for day-of-week/time-of-day math (`Date.getHours()`/`getDay()`/`setHours()`), caught by a manual curl smoke test producing a wrong segment split. Peak/weekend windows are wall-clock concepts for this single India micro-market and must resolve identically regardless of the deployment host's configured timezone — fixed by computing everything through a fixed UTC+5:30 offset (`resolve.ts`'s `toIstWallClock`/`istDayOfWeek`/`istMinutesOfDay`) rather than any local-time API.
2. **`user_roles`'s "one live grant" partial unique index provided no protection at all for unscoped roles** (`host`, where `scope_id` is `NULL`) — Postgres unique indexes treat every `NULL` as distinct from every other `NULL`, so two concurrent owner-persona selections could both insert a live `host` grant. Caught by the concurrent-persona-selection Testcontainers test (2 live rows instead of 1). Fixed with a `coalesce(scope_id, '00000000-...'::uuid)` expression in the index, and the local dev Postgres volume was reset and re-migrated to pick it up.

**A design gap was caught and fixed while wiring the frontend:** the listing-photos endpoint originally returned only the raw `storageKey`, which would have forced the client to construct a storage URL itself (breaking the provider-abstraction boundary — mock vs. S3 URL shapes differ). Fixed by having `listListingPhotos` attach a `url` computed via `StorageProvider.publicUrl()`, so the client only ever consumes URLs the server hands it.

**Property insert/update responses were leaking raw PostGIS EWKB hex** for `location`/`entryLocation` on first smoke test (`.returning()` on a geography column is the wire format, not usable by a client) — fixed across `property.service.ts` and `listing.service.ts` by stripping the raw geography columns from every response and substituting parsed `lat`/`lng` (or the already-known input coordinates on create, avoiding an extra round-trip).

**Deviation from the locked plan, made on the user's explicit direction during implementation:** the Property Manager Console (§3's Group E) is **folded into `apps/driver-web`'s route tree** (`/manage/*`, its own `/manage/login` entry point) rather than shipped as a separate `apps/property-web` app — superseding locked decision O-10. It keeps its own theme (reuses `admin`, per the original design direction) and its own login entry so it still reads as a distinct surface; only the deployment/repo-layout choice changed. `01-feature-modules-and-architecture.md`'s surface table is updated to match.

**Frontend — `packages/ui-web` gained ten new primitives** (`Select`, `Toggle`, `Tabs`, `Badge`, `MoneyField`, `TimeRangeField`, `FileUpload`, `PhotoManager`, `MapPicker`, `DetailPanel`) and `packages/design-tokens` gained a third theme (`host` — cool slate ground, deep-green accent reserved for money/verification states) plus `multiThemeToCss()` for the persona-fork runtime theme swap (a `data-theme` attribute flip, no style-tag replacement). **`MapPicker` is coordinate entry + geocode lookup, not a visual pin-drop map** — no `MAPBOX_TOKEN` is provisioned yet (`tech-stack.md` §12), so this is a deliberately bounded stand-in behind the same `onChange(LatLng)` contract a real map component would use. **Photo reorder is left/right buttons, not pointer drag** — another deliberate scope bound; the `position` field is fully drag-order-capable server-side whenever that interaction is added.

**`apps/driver-web` now implements the full persona fork**: the persona card (first-login-only, both themes shown side by side), the root-level theme swap, the owner persona (host checklist → property → listing wizard with 5 steps [what fits, photos, access, price, review] → KYC → payout), and the Property Manager Console (`/manage/*`: property list → detail with Overview/Authorization/Access-policy tabs, including the revoke-with-consequence-preview confirmation modal). `ProfileScreen` is the single shared screen across personas (the persona switcher lives there), per the plan's explicit rule that the fork happens once, at the navigator/shell level.

**`apps/admin-web` gained the moderation queue** (`/listings`, list+detail panel via the new `DetailPanel` primitive, status tabs, approve/reject/suspend actions gated to `platform_admin` with `support` seeing the queue read-only) alongside the existing user-search screen, now sharing an extracted `AdminShell` nav.

**Verified the same way as Sprint 1:** all three touched apps (`api`, `driver-web`, `admin-web`) typecheck clean, lint clean (monorepo-wide `npm run lint`), and build clean for production. The full Sprint 2 backend flow was manually verified live via curl end-to-end: OTP login → persona select (idempotent) → property create (self-authorized) → listing create → photo upload/complete via the mock storage adapter (including a deliberately-failing PUT) → pricing set/preview → submit → admin login → moderation queue → approve → published. **No browser was available this session to click through the new frontend screens** — same gap Sprint 1 had; typecheck/lint/tests/build are real signal but not a substitute for an actual click-through, which should happen before calling this sprint fully done.

**Deferred, and why:** `driver-mobile`'s owner persona (§2.9's 2B mobile half) and the matching `ui-native` primitives were not built this pass. The plan's own risk 6 says the device-run debt from Sprint 1 (mobile has never run on a real device or emulator) should be paid down *before* building the owner persona on mobile, not after — that debt is still unpaid, so building on top of it now would only make it more expensive to discover later. Also not built: the Playwright E2E harness (§4's one-flow-end-to-end spec), the mobile Jest/RNTL tests, a `verification.expire`/R6 sweep-idempotency Testcontainers test, and a full lifecycle-transition-matrix unit test — real gaps in Divya's test plan, not silently skipped. `GATE-06`/`GATE-11` are implemented (see the code) but not yet checked off in `02-kanban-board.md`.

**Status:** Detailed breakdown of Sprint 2 as scoped in `03-sprint-plan.md`. Produced via the `/run-team` workflow (Meera → Arjun → Kavya/Rohan → Divya → Nikhil → sign-off).
**Scope:** `PROP-01`, `PROP-02`, `PROP-05`, `HOST-01`, `INV-01`, `INV-02`, `INV-06`, `HOST-03`, `ADM-03`.
**Not in scope:** `INV-03`/`INV-04`/`INV-05` (availability + capacity pools — Sprint 3), `SRCH-*` (Sprint 3), `PROP-03`/`PROP-04` (resident allocation, visitor passes — not in Sprint 2's line-up), `HOST-02` (P1, Sprint 8), `HOST-05`/`HOST-06` (Sprint 6), everything from Sprint 4 onward.
**Predecessor:** `04-sprint-1-detailed-plan.md` (identity/auth/profile/vehicles/admin RBAC — built, audited, tested).

---

## Decisions locked for this sprint (confirmed with the user 2026-09-23)

Not to be silently re-decided later. These resolve four of the open decisions this plan originally tabled.

1. **One login, two personas.** A parking owner logs in through the **same phone + OTP flow as a driver** — there is no separate host app and no separate host account. After OTP verification a **persona selection card** offers "Park a vehicle" and "Rent out my space", each with a one-line explanation of what it means, and routes to that persona's dashboard. (Resolves **O-6** and **O-8**.)
2. **The picker appears on first login only.** Afterwards the app lands directly on the last-used persona, with a persona switcher permanently available in-app. A daily driver never pays a tap for a persona they don't use; the switch is never more than one tap away.
3. **Persona is navigation, never authorization.** The server authorizes every request against `user_roles` in Postgres. A "currently selected persona" sent by a client is a UI hint and is **never** trusted as a permission — see Arjun §2.2a. This is the single most dangerous way this feature could be built wrong.
4. **Property first, then spaces — explicitly, for every owner.** An owner creates a property, then adds parking spaces inside it. No implicit/auto-created property. For an individual owner (`independent_home` / `standalone`), the **self-authorization is created automatically** inside the property-creation transaction — the owner never sees the word "authorization" for their own driveway, but the authorization row exists so non-negotiable rule 9 stays structurally enforceable.
5. **Nothing is publicly visible until an admin approves it.** A space goes `draft → pending_verification → published`, and **only `published` is ever exposed to a driver**. This is enforced in two places, not one: the publication guard in Sprint 2 and the search query filter in Sprint 3.
6. **The Property Manager Web Console stays in Sprint 2.** Society and commercial property managers self-serve their own authorization and access policy from day one, rather than a platform admin doing it concierge-style on their behalf.

**Confirmed 2026-09-23, closing every remaining open decision (O-1 through O-10):**

7. **Moderation and private documents are `platform_admin`-only** (O-1). `support` may view the moderation queue with PII masked, but cannot approve, reject or suspend a listing, and cannot open a KYC document or reveal payout details. This also settles the question Sprint 1 left open about what `support` can do — for *user* suspend/restore it keeps the permission it already shipped with; everything new this sprint is `platform_admin`-only.
8. **Minimum verification level to publish: level 2** (location + photos verified) in general; **level 3** (property authorization) is mandatory for any listing inside a `society` or `commercial` property (O-2).
9. **KYC gates payout, not publication** (O-3). A host can create, submit and have a listing published with KYC incomplete; money is what's blocked.
10. **Money is integer paise everywhere** (O-4) — no floats, no `numeric`, no rupee strings, in the database, the API and the client. And the **platform fee model**: the host sets the driver-facing price, the platform fee is a percentage deducted from host earnings, and the percentage lives in one `pricing.config.ts` constant with a TODO pointing at `ADM-08` (Sprint 7), not scattered across call sites (O-5).
11. **Full bank account numbers are stored in Postgres** (O-7 — user's decision, overriding the plan's original recommendation to hold only a reference). They are stored **AES-256-GCM encrypted with a key held outside the database**, returned by no API in full, and decryptable only in the payout path and an audited `platform_admin` reveal. Details and rationale in §2.3's payout note.
12. **KYC and payout retention: while the host is active, plus 8 years after their last payout** (O-9). The 8-year figure matches the Companies Act 2013's books-of-account retention and comfortably covers PMLA's 5-year record requirement — a defensible default to build the S3 lifecycle rule and any future purge job against. **Have this confirmed by whoever gives ParkAway legal/tax advice before launch**; it is a sound engineering default, not legal advice, and `GATE-11` should record whatever they say.
13. **The Property Manager Console stays a separate web app with its own login**, not a third persona (O-10). A property manager is an organisational role with a desktop, document-heavy job, and that console may later need credentials or SSO the OTP flow doesn't cover.

**Nothing in this plan is now blocked on a product decision.** The remaining gate work (§ "Blockers") is recording these in `02-kanban-board.md`, not deciding them.

---

## Sprint 2 in one paragraph

Sprint 1 produced people. Sprint 2 produces **supply**: a real parking space, attached to a real property, authorized by whoever controls that property, priced by its owner, submitted for approval, and visible to drivers only once an admin has approved it. Nothing in Sprint 3 (search) or Sprint 4 (booking) has anything to operate on until this exists. It is also the sprint where the app stops being single-audience — the same phone number and the same OTP now lead to either a driver's app or an owner's, chosen once and switchable thereafter — and where four pieces of foundational plumbing that Sprint 1 never needed all arrive at once: PostGIS, S3/object storage, the maps provider adapter, and the first BullMQ job. That is why the sequencing section below matters more here than it did last sprint.

---

## Pre-flight: what the code actually has today

Audited against the repo rather than trusting `PROGRESS.md`, because Sprint 1's own audit found four "documented done, not actually built" gaps. Findings that change this plan:

| Claim / assumption | Reality in code | Consequence for Sprint 2 |
|---|---|---|
| "S3-ready photo upload path (presigned URLs, not proxied)" (`PROGRESS.md`) | **No S3 code exists.** No `aws-sdk` dependency, no storage adapter, no presign route. `users.photo_url` is a bare text column with a comment. | Object storage is a **Sprint 2 deliverable built from zero**, and it is a hard prerequisite for `HOST-01` (KYC docs), `INV-01` (photos) and `PROP-02` (authorization letters). Not a carry-over. |
| PostGIS is in the stack | The `postgis/postgis:16-3.4-alpine` image is used, but **no migration runs `CREATE EXTENSION postgis`** and no table has a geo column. | First geo migration + GIST index lands this sprint. Deployment implication for the self-managed EC2 Postgres (see Nikhil). |
| Mapbox is the locked maps provider | **No maps adapter, no Mapbox dependency, nothing.** | `MapsProvider` adapter + mock must exist before a property can get trustworthy coordinates. |
| Jobs run on BullMQ | **BullMQ is not installed.** Redis is used only for rate-limiting and the `session_version` cache. | `INV-02`'s verification-expiry sweep is this codebase's first job. Standing the queue up here — on a low-stakes daily sweep — is deliberately cheaper than standing it up in Sprint 4 next to money. |
| Non-driver actors can log in | Only two identity paths exist: driver OTP (`users`) and admin email+password (`admin_users`). **A host or property manager has no way to authenticate.** | Resolved by the persona decision: owners log in through the *same* OTP flow and are routed by persona (Group D). `user_roles` + `users.last_persona` is the whole of it — no third identity table. |
| Shared UI covers the new surfaces | `ui-web`: Button, TextField, OtpInput, Modal, EmptyState, WizardProgress, InlineBanner, Card, Table, StatusBadge. `ui-native`: same minus Table/StatusBadge, plus Badge. **No `Select`, no file/photo upload, no map, no date/time, no tabs, no toggle, no money field anywhere.** | Kavya's primitive-gap list (§3.1) is a real, budgeted deliverable, not incidental. |

---

## Step 1 — Meera (BA): Requirements Refinement

Sprint 2 is five tickets, not nine, because several kanban cards only make sense delivered together (a listing's lifecycle and its verification level are the same state conversation; a property and its authorization are worthless apart).

### Scope check — all five ticket groups

Every item in this sprint maps to **P0 / MVP** modules: Property & Society Management (§2.5), Host Onboarding & Earnings (§2.6), Listing & Inventory Management (§2.4), Admin Console (§2.14). **No P2/P3 module is touched, so no build-ahead-of-gate exception is needed.**

One boundary worth naming explicitly, because it is easy to drift across: `PROP-01`/`PROP-02`/`PROP-05` are the P0 *property* subset. `OS-01`–`OS-05` (property inventory dashboard, tenant permits, visitor management, marketplace exposure toggle) are the **P2 Parking OS** versions of adjacent ideas and are **not** in this sprint. If a Property Manager Console screen starts growing an occupancy dashboard or a permit table, that is scope creep into Phase 2 and should be stopped.

---

### Ticket Group D — Persona Selection & Switching (`NEW-01`, extends `AUTH-02`)

No spec code exists for this — it's a `NEW-##` card per the board convention in `02-kanban-board.md`, tagged to the Identity & Access Management module (§2.1). It was added after the original five ticket groups, on the user's direction, and it is listed first because it is the entry point to everything else in this sprint.

**Title:** One phone number, two personas — driver and owner — chosen after OTP and switchable thereafter

**User Story:** As someone who both parks and rents out a space, I want to log in once with my phone number and choose whether I'm here to park or to host, so that I get the right dashboard without maintaining two accounts.

**Acceptance Criteria:**

1. Given a user completes OTP verification for the **first time**, when verification succeeds, then a persona selection card is shown offering **"Park a vehicle"** and **"Rent out my space"**, each with a one-line plain-language description of what that persona does.
2. Given a user picks a persona, when they confirm, then the corresponding role is granted (`driver` is implicit; `host` is granted on first selection of the owner persona), their choice is stored as `users.last_persona`, and they land on that persona's dashboard.
3. Given a returning user logs in, when OTP verification succeeds, then they land **directly** on their last-used persona's dashboard with **no picker** — the picker is a first-login moment, not a per-login toll.
4. Given a user is in either persona, when they open the persona switcher, then they can move to the other persona without logging out, without re-entering an OTP, and without losing their session; the new persona is persisted as `last_persona`.
5. Given a user switches to the owner persona for the first time, when they arrive, then they land on the host onboarding checklist (Group F), not an empty dashboard.
6. Given the app is in the owner persona, when any screen renders, then the surface is **visibly, unmistakably a different mode** — different theme, different navigation set, persistent mode indicator — so a user is never uncertain which persona's data they're looking at.
7. **Security:** given a client sends any persona indicator with a request, when the server authorizes that request, then the persona value is **ignored entirely** — authorization is decided from `user_roles` in Postgres. A driver-only user calling a host endpoint receives 403 regardless of what persona their client claims.
8. Given a user's `host` role is revoked, when they next load the app, then the owner persona disappears from the switcher and any attempt to reach it routes back to the driver persona — no orphaned dashboard.
9. Audit: `persona.role_granted` and `persona.switched` are recorded with actor, timestamp and source. Role grants are status-changing and audited by rule; switches are recorded because they're the cheapest possible signal when investigating "who did this and in what capacity".

**Out of Scope:** a property-manager persona in the mobile/driver-web apps (property managers use the web console, which is its own surface with its own login — see Group E), a security-guard persona (Sprint 5), switching personas mid-transaction, per-persona notification preferences.

**User Experience Flow:**

1. Phone entry → OTP entry (both unchanged from Sprint 1).
2. **First-time only → Persona card.** Two cards stacked, equal visual weight, each with an icon, a title and one line of explanation: *"Park a vehicle — find and book guaranteed parking near you"* / *"Rent out my space — list a parking spot, set your price, earn from it."* No pre-selected default and no "recommended" badge on either — a nudge here would misroute people for the sake of a funnel metric.
3. Picking **driver** → the existing skippable onboarding wizard (profile + vehicle) → driver home. Unchanged from Sprint 1.
4. Picking **owner** → host onboarding checklist → add property → add space. See Groups E, F and G.
5. **Switching**, available always: on mobile, from the Profile tab as a distinct mode-switch row (not buried in settings, not a tab); on web, from the account menu. The switch is instant — no reload, no re-auth.
6. Forks: a user who picks owner and abandons before finishing onboarding (the `host` role is still granted, the checklist is still there next time, nothing is lost); a user whose host role was revoked by an admin (switcher hides the persona and states why rather than failing silently); a driver-only user who has never seen the owner side (a single "Have a parking space? Rent it out" entry point in Profile — one, not scattered).

**Design note:** the persona card is the **first branded screen a user sees after proving who they are**, and it is doing a genuinely rare job — asking someone to declare an intent rather than to enter data. It should not look like a settings toggle or a plan-picker. Two full-width cards, generous vertical space, the driver card in the warm `driver` palette and the owner card in the cool/green `host` palette, so the colour difference *teaches the mode difference* before the user has experienced either. This is the one screen in Sprint 2 where both themes appear together, and that's deliberate.

**Routing:** Arjun (role model, the persona-is-not-authorization boundary), Rohan (roles, `last_persona`, role-grant endpoint), Kavya (persona card, root navigator split, theme switching, switcher UI on both driver surfaces), Divya (QA — especially AC-7's negative tests).

---

### Ticket Group E — Property Registration & Authorization (`PROP-01`, `PROP-02`, `PROP-05`)

**Title:** Property creation, society/property authorization with revocation propagation, and versioned access policy

**User Story:** As a property manager or society admin, I want to register the property I control, state who may park there and under what access rules, and grant or revoke ParkAway's authorization to list spaces inside it, so that no space in my property is ever bookable by an outsider without my standing consent.

**Acceptance Criteria:**

1. Given an authenticated property manager, when they create a property with name, address, coordinates, property type and outsider policy, then the property is stored with a PostGIS point for both its centre and its **verified entry point**, and an audit record is written.
2. Given a property is created without a pinned location, when submitted, then it is rejected — a property with no trustworthy coordinates cannot exist, because `SRCH-04`/`SRCH-08` depend on entry coordinates being real rather than geocoded approximations.
3. Given a property manager grants an authorization (permitted parking types, outsider policy, effective-from, optional expiry, supporting document), when submitted, then the authorization becomes the property's live authorization and every subsequent listing publication under that property is evaluated against it.
4. Given an authorization has an `expires_at` in the past, when any listing under that property is evaluated for publication or search exposure, then the property is treated as unauthorized **at query time** — expiry is never dependent on a job having run.
5. Given an authorization is revoked with a reason, when the revocation commits, then **in the same transaction** every `published` listing under that property moves to `suspended` with `status_reason = 'authorization_revoked'`, each transition writes its own audit row, and the host sees the reason on their listing.
6. Given a listing publication is attempted concurrently with a revocation of its property's authorization, when both commit, then the outcome is never "published listing under a revoked authorization" — one of the two loses deterministically (see Arjun's concurrency plan).
7. Given a property has `outsider_policy = 'disallowed'`, when any listing under it is submitted for publication, then publication is refused with an explicit reason — this inventory must never reach the marketplace (non-negotiable rule 9).
8. Given a property manager edits the access policy (gate hours, access methods, escort rules, emergency override contact), when saved, then a **new version row** is appended and the previous version remains readable; policy rows are never updated in place.
9. State change: grant, revoke, and each access-policy version carry actor, timestamp, source and reason.
10. Invalid flow: a property manager acting on a property they are not scoped to receives 403, not an empty result set that looks like "no such property".

**Out of Scope:** resident slot allocation (`PROP-03`), visitor passes (`PROP-04`), property-level occupancy dashboards or billing (`OS-01`/`OS-07`, P2/P3), multi-manager delegation workflows beyond a single grant of the property-manager role.

**Two entry points, one backend.** An individual owner creates their property **inside the driver app's owner persona** (property → then spaces, per locked decision 4), and never sees the authorization step because it's created for them. A society or commercial manager creates and authorizes properties in the **Property Manager Web Console**, on a desktop, with supporting documents. The flow below describes the console; the owner-persona version is the same three sections with the *Policy* section reduced to gate hours (an individual's outsider policy is implicitly `allowed` for their own space) and no authorization tab at all.

**User Experience Flow** (Property Manager Web Console — new surface):

1. Login → **Property list** (empty state on first use: "No properties yet — add the property you manage"). A manager at pilot scale has one to three properties; this is a list, not a dashboard.
2. **Add property** — a three-section single page, not a wizard: *Identity* (name, type, address) → *Location* (map pin drop, with the address reverse-geocoded in as a starting suggestion, and a **separate, explicitly-placed entry-gate pin**) → *Policy* (outsider policy, gate hours, access methods). Not a wizard because this is a desktop form filled once by someone who has all the information in front of them — a wizard would add clicks without reducing cognitive load.
3. **Property detail** — three tabs: *Overview*, *Authorization*, *Access policy*. Authorization tab shows the current authorization's state as the loudest element on the page (active / expiring in N days / expired / revoked), with the grant or revoke action beside it and the full history beneath.
4. **Revoke** — a confirmation modal that names the consequence before it happens: "This will immediately suspend N published listings in this property." Required reason. This is the one destructive action on this surface and it should feel like one.
5. Forks: not-scoped-to-this-property (403 screen, not a blank list), authorization expiring soon (persistent banner on the property list, not a dismissible toast), no listings yet under an authorized property (explicit empty state).

**Design research** (Mobbin, pulled this session): web admin/ops patterns — Reddit's mod **Queue** ([screen](https://mobbin.com/screens/c20fd251-fbfe-471b-b3a4-c0175cf1ada4)), Plain's list-plus-right-detail-panel ([screen](https://mobbin.com/screens/9ff39f43-bdf9-4ae4-8c9f-b736cfacdcde)), Lightfield's records/detail split ([screen](https://mobbin.com/screens/c1322cfa-763a-4f21-8b49-0062d3c40ed1)). The transferable pattern is *left rail of scopes → middle list → right detail with the actions inline in the detail, never in a separate page*. What we take: the persistent left scope rail and inline actions. What we deliberately don't take: their toolbar density — a property manager runs perhaps five actions a week, not five hundred, so the actions get room and labels rather than icon-only compression.

**Routing:** Arjun (role model, authorization/revocation concurrency, geo schema), Rohan (backend), Kavya (Property Manager Web Console — new surface), Divya (QA), Nikhil (PostGIS extension on EC2).

---

### Ticket Group F — Host Onboarding & KYC (`HOST-01`)

**Title:** Host onboarding with identity, ownership evidence and payout details

**User Story:** As someone with a parking space to rent out, I want to register as a host and submit my identity, proof that the space is mine to let, and my payout details, so that I can list a space and eventually get paid for it.

**Acceptance Criteria:**

1. Given an authenticated user (existing driver account or fresh OTP signup), when they start host onboarding and choose individual or business, then a host profile is created in `not_started` KYC state and the `host` role is granted to their user.
2. Given a host uploads an identity document, ownership/authorization evidence, or a business registration document, when they do so, then the file goes **client → S3 directly via a presigned URL** and only the resulting object key reaches the API — the file never passes through Fastify.
3. Given a host submits their KYC package, when submitted, then the profile moves to `submitted`, is queued for admin review, and the host can see that state with an honest expectation of what happens next.
4. Given an admin approves or rejects a KYC submission with a reason, when actioned, then the state moves to `verified` or `rejected`, the host is shown the specific rejection reason (not "there was a problem"), and a rejected host can resubmit.
5. Given a host has not completed KYC, when they create and submit a listing, then listing work is **not blocked** — KYC gates *payout*, not *publication* (see open decision O-3; this is the recommended default and needs confirmation).
6. Given bank/payout details are entered, when stored, then the IFSC and account-holder name are stored in plaintext, the **full account number is stored AES-256-GCM encrypted** with a key held outside the database, and `payout_account_last4` is stored separately for display.
7. Given any API returns a host profile — to the host themselves, to an admin, or in any list — then the account number appears **only** as `last4`. No endpoint returns the full number as part of a normal read.
8. Given a `platform_admin` explicitly reveals a host's payout account, when they do, then an audit row is written **before** decryption, and the full number is returned once, to that one request. A `support` admin attempting the same receives 403.
9. Given an admin opens a KYC document, when the presigned download URL is issued, then a `document.download` audit row is written naming the admin, the document, and the host — admin access to identity documents is itself auditable (`GATE-11`).
10. Given a payout account number or IFSC fails format validation (9–18 digits; 4 letters + `0` + 6 alphanumerics), when submitted, then it is rejected with a field-level error rather than stored — an unusable account number discovered at payout time in Sprint 6 is a support ticket and a delayed host payment.
11. Invalid flow: a host requesting an upload URL for another host's profile, or an admin with the `support` role requesting a KYC document download or a payout reveal, is rejected with 403.

**Out of Scope:** real KYC-provider integration (Aadhaar/PAN verification APIs — mock/manual admin review only this sprint), payout execution (`PAY-04`, Sprint 6), earnings views (`HOST-06`, Sprint 6), host ratings (P1).

**User Experience Flow** (Host surface):

1. Entry from the driver app/web account menu — **"List your parking space"**. A ParkAway host is usually already a ParkAway driver; a separate signup would be a second account for the same human, which the role model explicitly avoids.
2. **Host home** — before onboarding is complete this is a checklist, not a dashboard: "Add your space" / "Verify your identity" / "Add payout details", each with its own state. Explicitly modelled on the Airbnb host "Welcome — Account info is needed, *required to get paid*" pattern from the [Creating a listing](https://mobbin.com/flows/ac0a721e-274d-4b18-97eb-403b4c59b394) flow: it separates *what blocks publishing* from *what blocks money*, which is exactly the distinction AC-5 makes.
3. **KYC step** — document type picker → capture/upload → a **"Is the image clear?" confirm step** before submit (lifted from the [Careem bank-verification flow](https://mobbin.com/flows/e09186aa-7a8e-437b-af6c-a19191726c25) and Binance's [identity flow](https://mobbin.com/flows/cdc52574-dd6c-4203-8cc6-4a246dea0a8f)). This one extra tap is worth it: an unreadable PAN card costs a full admin-review round trip and a day of host confusion.
4. **Payout details** — deliberately last and deliberately skippable, per the Turo/Stripe ordering ([Adding payout information](https://mobbin.com/flows/4e57f24c-b599-48c8-a75a-0e0920ab4df1)), where payout comes *after* verification and is framed as "required so you can receive payments" rather than as a gate on everything before it.
5. Forks: rejected KYC (specific reason + resubmit CTA, never a dead end), upload failure mid-flow (the draft survives; retry the single failed file, don't restart the flow), business host (adds GSTIN/registration fields — same screens, extra fields, not a parallel flow).

**Minimum path to value vs. deferrable:** minimum is *account → property → one listing submitted*. KYC and payout can lag by days without blocking anything a pilot host cares about (their space appearing). Deferring them is the whole point of AC-5.

**Routing:** Arjun (document sensitivity classes, role model), Rohan (backend + storage adapter), Kavya (host surface), Divya (QA), Nikhil (S3 buckets, lifecycle/retention).

---

### Ticket Group G — Parking Space Listing, Photos & Lifecycle (`INV-01`, `INV-06`)

**Title:** Parking space creation with photos, and the draft → published → archived lifecycle

**User Story:** As a host, I want to describe my parking space accurately — where it is, what fits in it, how to get into it, what it looks like — and control whether it's live, so that drivers who book it actually find what they were promised.

**Acceptance Criteria:**

1. Given a host creates a listing, when they save, then it is created as `draft`, belongs to exactly one property, and is editable without any validation beyond "it has a name".
2. Given a listing is submitted for publication, when submitted, then full validation runs (coordinates present, at least N photos, dimensions present, vehicle types selected, at least one pricing rule, property authorized) and the listing moves to `pending_verification` — or is rejected with **every** failing field named at once, not the first one.
3. Given a listing declares its space type, when created, then it is either `exclusive` (capacity 1) or `pool` (capacity > 1) — the pool *behaviour* is `INV-04` in Sprint 3, but the shape must be declared now so Sprint 3 isn't a data migration.
4. Given a host uploads photos, when uploaded, then they go client → S3 presigned, at most one is the cover photo (database-enforced, not application-enforced), and order is stable and editable.
5. Given a listing moves between states, when the transition is attempted, then only these transitions are legal: `draft → pending_verification → published`, `published ⇄ paused`, `{pending_verification, published, paused} → suspended`, `{draft, paused, suspended} → archived`. Anything else is a 409 with the current state named.
6. Given two actors attempt conflicting transitions on the same listing simultaneously, when both commit, then exactly one succeeds and the other receives a 409 stating the state it actually found — never a silent last-write-wins overwrite.
7. Given a listing is archived, when archived, then it is excluded from every future query but the row and its history are retained.
8. State change / audit: every transition records actor, timestamp, source, reason, and the from/to states.
9. Invalid flow: a host acting on a listing belonging to another host receives 403.

**Out of Scope:** availability schedules and blackout rules (`INV-03`, Sprint 3), capacity-pool reservation semantics (`INV-04`, Sprint 3), maintenance blocks (`INV-05`, Sprint 3), material-change re-verification triggers (`HOST-02`, P1), access instructions with PIN/gate detail (`ACC-06`, Sprint 5 — the column is *not* being added speculatively).

**User Experience Flow** (Host surface):

1. **Your spaces** list → **Add a space**.
2. A **short stepped flow, explicitly not Airbnb's 29-screen one**. The [Airbnb listing flow](https://mobbin.com/flows/ac0a721e-274d-4b18-97eb-403b4c59b394) earns its length because a home has genuinely many dimensions; a parking space has about eight. The patterns we do take from it: **"Save & exit" present on every step** (a host photographing a basement with bad signal will drop out), a **progress bar that is informative rather than pressuring**, and the **price step showing "you earn" alongside the driver-facing price** — parking hosts are price-anxious and hiding the fee split invites churn. Steps: *Property & space* → *What fits* (vehicle types, dimensions, covered) → *Photos* → *Access* (how a driver gets in) → *Price* → *Review & submit*.
3. **Photos** step — grid with drag-order and a per-photo menu (make cover, move, delete), taken from Airbnb's photo-manager sheet. Minimum photo count is stated up front, not discovered at submit.
4. **Review & submit** — a full read-only render of what the driver will see, with every incomplete item linked back to its step. Submit → "In review" state with an honest turnaround expectation.
5. Forks: property not yet authorized (the listing can still be drafted and submitted; it simply cannot be *published* until authorization exists — the host sees this as a property-level task, not a listing error), rejected by moderation (specific reason category + note + edit-and-resubmit), paused by host (one tap, reversible, clearly distinguished from suspended-by-platform).

**Routing:** Rohan (backend), Kavya (host surface), Arjun (state machine + geo + concurrency), Divya (QA).

---

### Ticket Group H — Host Pricing (`HOST-03`)

**Title:** Versioned host pricing with hourly/daily rates and peak/weekend rules

**User Story:** As a host, I want to set what my space costs by the hour and by the day, with different rates at peak times, so that I earn appropriately — and as the platform, we need every price we ever quote to be reproducible later.

**Acceptance Criteria:**

1. Given a host sets a base hourly and/or base daily rate, when saved, then a new immutable pricing **version** is appended; the previous version is retained and remains the effective version for any time window before the new one takes effect.
2. Given a host adds a peak or weekend rule (day-of-week and time-of-day window, rate), when saved, then it belongs to that same version — a version is a complete, self-consistent price sheet, not a pile of independently-edited rules.
3. Given a price is resolved for a time window, when computed, then precedence is deterministic and documented: **most specific rule wins** (event > peak > weekend > base), and a window spanning several rules is computed per-segment, server-side, never client-side.
4. Given a host previews their pricing for a sample window, when requested, then the API returns the same breakdown structure Sprint 4's checkout will use (base, per-segment detail, platform fee, host earnings) — one calculator, not two.
5. Given a pricing version is superseded, when any later system reads a historical quote, then it reads the version that was effective at quote time — pricing changes are never retroactive (non-negotiable rule 10, `HOST-03`).
6. Given two concurrent pricing edits on the same listing, when both commit, then two distinct versions exist in a defined order — no interleaved half-version is possible.
7. All money is stored and computed in **integer paise**, never floats.
8. Audit: every pricing version records actor, timestamp and source.

**Out of Scope:** monthly plans (`REC-01`, P2), event pricing (`EVT-*`, P2), dynamic/surge pricing (explicitly out of scope until reliability is proven), the platform fee *value* being admin-configurable (`ADM-08`, Sprint 7 — this sprint uses one centralized config constant, see open decision O-5), actual charging (Sprint 4).

**Routing:** Arjun (versioning model, precedence rules), Rohan (backend + resolver), Kavya (price step + earnings preview), Divya (QA — precedence table tests).

---

### Ticket Group I — Listing Verification & Moderation Queue (`INV-02`, `ADM-03`)

**Title:** Verification levels with badges, and the admin moderation queue that assigns them

**User Story:** As a platform admin, I want a queue of listings awaiting verification with everything I need to judge them on one screen, so that only inventory we have actually checked reaches drivers — and as a driver (later), I want a badge that means something specific.

**Acceptance Criteria:**

1. Given the four verification levels (`0` self-declared → `1` phone/basic → `2` location + photos → `3` property authorization → `4` physically verified), when a listing is approved at a level, then an append-only verification record is written with level, method, evidence, verifying admin and an optional expiry.
2. Given a listing's badge is displayed, when computed, then it is **derived** from the highest currently-valid (unexpired, unrevoked) verification record — never a mutable column someone can set directly.
3. Given a listing sits inside a property of type `society` or `commercial`, when publication is attempted, then level 3 (property authorization) is **required** — a gated property's space cannot be published on the host's word alone (see open decision O-2 for the minimum level elsewhere).
4. Given a verification record expires, when the daily sweep runs, then the listing's effective level drops, and if it falls below its property's required minimum the listing moves to `suspended` with reason `verification_expired`, with a `system`-actor audit row.
5. Given the sweep re-runs over an already-processed listing, when it runs, then nothing changes — the job re-checks live state and is idempotent by construction (non-negotiable rule 2).
6. Given an admin opens the moderation queue, when loaded, then each item shows photos, map location, property + authorization state, host KYC state and declared attributes **on one screen** — a moderator should not need to open four tabs to make one decision.
7. Given an admin approves, rejects or suspends, when actioned, then a **reason category** (from a fixed list) plus an optional free-text note is required, and the host sees a message derived from it.
8. Given two admins action the same queue item simultaneously, when both submit, then one succeeds and the other is told the item was already actioned and by whom — no double-approval, no silent overwrite.
9. RBAC: moderation actions are `platform_admin` only (see open decision O-1); `support` may view the queue with PII masked.

**Out of Scope:** automated/photo-ML verification, physical-inspection scheduling workflow (level 4 is recorded manually this sprint), bulk moderation actions, re-verification triggers on material edits (`HOST-02`, P1).

**User Experience Flow** (Admin Web Console — extending the existing app):

1. New **Listings** nav item beside the existing Users section. Queue defaults to `pending_verification`, with tabs for `published` / `suspended` / `rejected`, following the Reddit-mod-queue tab pattern ([screen](https://mobbin.com/screens/c20fd251-fbfe-471b-b3a4-c0175cf1ada4)).
2. **Queue row → right-hand detail panel** (no page navigation — a moderator processes items in sequence and losing list position is the single most annoying thing this screen could do). Panel: photo strip, map thumbnail, property + authorization status chip, host KYC chip, declared attributes, pricing summary.
3. **Approve** → level selector + optional expiry + reason category. **Reject** → required reason category + note. **Suspend** → same. All inline in the panel, with the actions pinned at the panel's bottom edge so they don't move as content length varies.
4. Keyboard: `j`/`k` to move through the queue, `a`/`r` to open approve/reject. This surface is used repeatedly by the same few people — the density brief in `frontend.md` is a licence to optimise for the hundredth use, not the first.
5. Forks: item already actioned by another admin (panel refreshes and says who and when), property authorization missing (approve at level 3 is disabled with the reason stated, not silently absent), `support` role (queue visible, action buttons absent — not present-but-erroring).

**Routing:** Rohan (backend + sweep job), Kavya (admin-web extension), Arjun (level model, expiry semantics), Divya (QA), Nikhil (BullMQ worker process).

---

## Step 2 — Arjun (Tech Lead): Architecture & Technical Plan

### 2.1 Technical approach

Three core domain modules (`01-feature-modules-and-architecture.md` §4.2) gain real implementations this sprint:

- **Property & Listing** — owns `properties`, `property_authorizations`, `property_access_policies`, `listings`, `listing_photos`, `listing_verifications`. This is the sprint's centre of gravity.
- **Pricing Engine** — owns `pricing_versions` + `pricing_rules` and, critically, the **single `resolvePrice()` function** that Sprint 4's `BKG-02` will call. Building the calculator here and the checkout there, from one implementation, is what prevents the classic two-calculators-that-disagree bug.
- **Host/Property B2B extensions** — `host_profiles`, `host_documents`.

Plus three pieces of cross-cutting infrastructure that do not belong to any feature module and should be built as such: the **storage provider adapter**, the **maps provider adapter**, and the **BullMQ bootstrap**.

Everything stays inside the modular monolith. No service split.

### 2.2 The role model — **decided** (was O-6)

Today there are two identity tables: `users` (phone-OTP drivers) and `admin_users` (password admins). A host and a property manager are neither.

**Decided with the user 2026-09-23:** do **not** add a third identity table. A host is a person with a phone; a property manager is a person with a phone; in a pilot micro-market, the same human may well be both, and a resident host in a society is *definitely* also a driver. The persona model in Group D is the product expression of exactly this. Add:

```
user_roles
  id            uuid pk
  user_id       uuid not null references users(id)
  role          text not null          -- 'host' | 'property_manager'  CHECK
  scope_type    text                   -- null for 'host'; 'property' for 'property_manager'
  scope_id      uuid                   -- the property id when scoped
  granted_by    text/uuid              -- admin or self-service
  granted_at    timestamptz not null default now()
  revoked_at    timestamptz
  unique (user_id, role, scope_id) where revoked_at is null   -- partial unique
```

`admin_users` stays entirely separate — password auth and a structurally different attribute set, exactly the reasoning Sprint 1 used. Authorization becomes `requireRole('host')` / `requirePropertyScope(propertyId)` middleware, mirroring Sprint 1's existing `requireAdminRole`.

**Why this matters beyond convenience:** if hosts get their own identity table, the same human ends up with two accounts, two phone numbers of record, and — once Sprint 5's `ACC-03` matches plates — two vehicle namespaces. That is a much worse problem later than a `user_roles` join is now.

Also added to `users`: `last_persona text` (`'driver' | 'owner'`, nullable, CHECK-constrained). Nullable is meaningful — **null is what makes a user "first login" and triggers the picker.** Storing it server-side rather than in device storage means the choice survives a reinstall and holds across a user's phone and the web app, which is the behaviour anyone would expect and the reason not to put it in `localStorage`/`SecureStore`.

### 2.2a Persona is navigation. `user_roles` is authorization. They are never the same check.

This is the part of Group D most likely to be built wrong, so it is stated as a rule rather than left to implementation taste:

- The access JWT **does not carry a persona claim.** Adding one would make a client-chosen value look authoritative to every downstream `request.user` read, which is exactly the trap.
- No route handler, service or query ever branches on a persona value from the request. Host endpoints are guarded by `requireRole('host')`, property endpoints by `requirePropertyScope(propertyId)`, both reading `user_roles` from Postgres (cached alongside the existing `session_version` lookup, on the same fail-safe-on-cache-miss terms Sprint 1 established — a cache miss re-queries Postgres, it never assumes).
- `users.last_persona` is **a UI routing preference and nothing else.** It is written by an explicit "I switched persona" call, it is read to decide which dashboard to open, and it is never consulted in an authorization decision. Naming it `last_persona` rather than `active_persona` or `current_role` is deliberate: the name should make it obvious to the next reader that it is not a permission.
- Divya's AC-7 test exists specifically to hold this line: a driver-only user's client asserting the owner persona must still receive 403 from every host endpoint.

### 2.3 Database schema (Drizzle)

Additive only. No existing Sprint 1 table changes shape, so there is no backfill and no downtime risk.

**Migration 0: PostGIS.** `CREATE EXTENSION IF NOT EXISTS postgis;` as its own migration, first, alone. It is the only migration this sprint that can fail for environmental reasons rather than logical ones (see Nikhil §5).

```
properties
  id                  uuid pk
  name                text not null
  property_type       text not null            -- 'society' | 'commercial' | 'standalone' | 'independent_home'  CHECK
  address_line1       text not null
  address_line2       text
  locality            text not null            -- the micro-market unit; indexed
  city                text not null
  state               text not null
  pincode             text not null
  location            geography(Point, 4326) not null       -- property centre
  entry_location      geography(Point, 4326) not null       -- the verified gate a driver navigates to (SRCH-08)
  outsider_policy     text not null            -- 'allowed' | 'authorized_only' | 'disallowed'  CHECK
  security_contacts   jsonb                    -- [{ name, phone, role }]
  status              text not null default 'active'        -- 'active' | 'archived'  CHECK
  created_by_user_id  uuid not null references users(id)
  created_at/updated_at timestamptz
  GIST index on location
  GIST index on entry_location
  index (locality)

property_authorizations
  id                     uuid pk
  property_id            uuid not null references properties(id)
  authorized_by_user_id  uuid not null references users(id)
  authorization_type     text not null         -- 'owner_self' | 'society_resolution' | 'management_contract'  CHECK
  permitted_parking_types jsonb not null       -- ['hourly','daily'] — monthly stays P2
  outsider_policy        text not null         -- CHECK, same domain as properties.outsider_policy
  document_id            uuid references host_documents(id)
  effective_from         timestamptz not null
  expires_at             timestamptz           -- null = no expiry
  revoked_at             timestamptz
  revoked_by_user_id     uuid
  revoke_reason          text
  created_at             timestamptz
  unique (property_id) where revoked_at is null and (expires_at is null or expires_at > now())  -- ❌ see note

property_access_policies            -- append-only, versioned (PROP-05)
  id                  uuid pk
  property_id         uuid not null references properties(id)
  version             int not null
  gate_hours          jsonb not null           -- [{ dow, opens, closes }] or { always: true }
  access_methods      jsonb not null           -- ['qr','guard_manual','boom_barrier']
  escort_required     boolean not null default false
  emergency_override_contact jsonb
  effective_from      timestamptz not null
  created_by_user_id  uuid not null
  created_at          timestamptz
  unique (property_id, version)
```

> **Note on self-authorization (locked decision 4):** when a property of type `independent_home` or `standalone` is created, a `property_authorizations` row with `authorization_type = 'owner_self'`, no expiry, and the creator as `authorized_by_user_id` is inserted **in the same transaction as the property**. The owner is never asked to "authorize" their own driveway — but the row exists, so the publication guard, the revocation cascade and the query-time expiry check in rule 9 all work identically for an individual owner and a 400-flat society. One code path, not two. For `society` and `commercial` properties, authorization stays an explicit, separately-evidenced step in the Property Manager Console (Group E).

> **Note on payout storage (locked decision 11, resolving O-7):** full bank account numbers **are** stored in Postgres, per the user's decision — not a vault reference. Because that puts them inside the `pg_dump` / EBS-snapshot blast radius while Postgres is still internet-reachable under non-negotiable rule 11, the number is stored **encrypted at the application layer**, never as plaintext:
>
> - **AES-256-GCM**, via Node's built-in `crypto` — no new dependency, an authenticated cipher so tampering is detected rather than silently decrypted into garbage.
> - **The key lives in `PAYOUT_ENCRYPTION_KEY` (env/secrets manager), never in the database and never in a backup.** This is the entire point: a stolen dump is inert without it. Nikhil §9 covers key handling; the key must not be checked in, must differ per environment, and must not be recoverable from anything `pg_dump` produces.
> - `payout_key_version` records which key encrypted each row, so a future key rotation is a background re-encrypt rather than a flag day.
> - **Decryption happens in exactly two places, both narrow:** the payout execution path (Sprint 6, `PAY-04`) and a `platform_admin`-only reveal endpoint that writes its audit row *before* decrypting. Nothing else in the codebase calls the decrypt function, and no list, search, profile or moderation response can reach it.
> - Every API that returns a host profile returns `payout_account_last4` and never the full number — including to the host themselves, matching how every bank and payment app behaves.
> - Validation on write: IFSC against the standard Indian format (4 letters, `0`, 6 alphanumeric), account number 9–18 digits, both server-side.
>
> Stated once and then built as decided: this is a larger footprint than handing the number straight to a payment provider's vault would have been, and `GATE-11`'s retention rules now have to cover payout data as well as KYC documents. The encryption is what makes it a reasonable trade rather than an open one.

> **Note on the `property_authorizations` partial unique index:** `now()` is not immutable, so Postgres will reject it in an index predicate. The "one live authorization per property" rule is therefore enforced as `unique (property_id) where revoked_at is null` (immutable predicate) plus an **expiry check evaluated at query time**, which is also what AC-4 requires — expiry must never depend on a job having run. Flagging it here because it is exactly the kind of thing that looks fine in a design doc and fails at migration time.

```
host_profiles
  id                  uuid pk
  user_id             uuid not null unique references users(id)
  host_type           text not null            -- 'individual' | 'business'  CHECK
  legal_name          text not null
  business_name       text
  gstin               text
  kyc_status          text not null default 'not_started'   -- 'not_started'|'submitted'|'verified'|'rejected'  CHECK
  kyc_reviewed_by     uuid
  kyc_reviewed_at     timestamptz
  kyc_rejection_reason text
  payout_account_name text
  payout_bank_name    text
  payout_ifsc         text                     -- plaintext; not secret on its own (it identifies a branch, not an account)
  payout_account_last4 text                    -- plaintext, display only — this is what every API returns
  payout_account_enc  text                     -- FULL account number, AES-256-GCM, base64(iv ‖ tag ‖ ciphertext)
  payout_key_version  int                      -- which key encrypted it; enables rotation without a flag day
  payout_added_at     timestamptz
  status              text not null default 'active'  CHECK
  created_at/updated_at

host_documents
  id                  uuid pk
  owner_type          text not null            -- 'host_profile' | 'property'  CHECK
  owner_id            uuid not null
  doc_type            text not null            -- 'pan'|'aadhaar'|'ownership_proof'|'authorization_letter'|'utility_bill'|'business_reg'  CHECK
  storage_key         text not null unique     -- object key; bucket class is private, always
  content_type        text not null
  byte_size           int not null
  review_status       text not null default 'pending'   -- 'pending'|'accepted'|'rejected'  CHECK
  reviewed_by         uuid
  rejection_reason    text
  expires_at          timestamptz              -- document validity, drives the INV-02 sweep
  created_at          timestamptz
  index (owner_type, owner_id)

listings
  id                  uuid pk
  property_id         uuid not null references properties(id)
  host_user_id        uuid not null references users(id)
  space_label         text not null            -- "B2-14", "Gate 2, slot 3"
  space_type          text not null            -- 'exclusive' | 'pool'  CHECK
  capacity            int not null default 1   -- CHECK (space_type='exclusive' AND capacity=1) OR (space_type='pool' AND capacity>1)
  vehicle_types       jsonb not null           -- ['hatchback','sedan','suv'] — same domain as vehicles.type
  length_cm/width_cm/height_cm  int
  covered             boolean not null default false
  amenities           jsonb                    -- { ev_charging, cctv, guarded, open_24x7 }
  access_method       text not null            -- 'qr'|'guard_manual'|'open'  CHECK
  rules               text
  location            geography(Point, 4326) not null
  status              text not null default 'draft'   -- CHECK over the 6 lifecycle states
  status_reason       text
  published_at        timestamptz
  created_at/updated_at
  GIST index on location
  index (property_id)
  index (host_user_id)
  index (status) where status = 'published'    -- the hot path Sprint 3 will hit

listing_photos
  id                  uuid pk
  listing_id          uuid not null references listings(id)
  storage_key         text not null unique     -- public-read bucket class
  position            int not null
  is_cover            boolean not null default false
  created_at          timestamptz
  unique (listing_id) where is_cover = true     -- DB-enforced single cover, same lesson as vehicles.is_default
  index (listing_id)

listing_verifications                 -- append-only
  id                  uuid pk
  listing_id          uuid not null references listings(id)
  level               int not null              -- CHECK (level between 0 and 4)
  method              text not null             -- 'self_declared'|'phone'|'photo_review'|'property_authorization'|'physical'  CHECK
  evidence_document_id uuid references host_documents(id)
  verified_by         uuid                      -- admin_users.id; null when system-derived
  verified_at         timestamptz not null default now()
  expires_at          timestamptz
  revoked_at          timestamptz
  index (listing_id)

pricing_versions                      -- append-only price sheets
  id                  uuid pk
  listing_id          uuid not null references listings(id)
  version             int not null
  effective_from      timestamptz not null
  created_by_user_id  uuid not null
  created_at          timestamptz
  unique (listing_id, version)          -- concurrent double-edit fails loudly, then retries

pricing_rules                          -- children of a version; never edited
  id                  uuid pk
  pricing_version_id  uuid not null references pricing_versions(id)
  rule_type           text not null     -- 'base_hourly'|'base_daily'|'peak'|'weekend'  CHECK
  amount_paise        int not null      -- CHECK (amount_paise >= 0)
  days_of_week        int[]             -- null = all
  window_start_min    int               -- minutes from midnight, null = all day
  window_end_min      int
  min_duration_min    int
  index (pricing_version_id)
```

**Money is `int` paise everywhere.** No `numeric`, no floats, no rupee strings. Locking this now (open decision O-4, recommended default) is far cheaper than discovering it in Sprint 4 next to a ledger.

**Every enum-like text column gets a `CHECK` constraint**, same discipline as Sprint 1 — the reasoning there (an invalid status string that later RBAC/lifecycle code silently mishandles) applies with more force now that lifecycle states drive marketplace exposure.

### 2.4 API contract

Agreed between Kavya and Rohan. All errors use the existing `{ error: { code, message, details? } }` envelope; all bodies are Fastify JSON-schema validated.

**Persona (Group D)**

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/me/personas` | Returns `{ available: ['driver','owner'], granted: [...], lastPersona: 'driver' \| 'owner' \| null }`. `lastPersona: null` is what tells the client to show the picker. |
| `POST` | `/v1/me/personas/select` | Body: `{ persona }`. Grants the `host` role on first selection of `owner` (idempotent — re-selecting an already-granted persona is a 200 no-op, not a duplicate grant). Persists `last_persona`. Audited. |

Note what is *not* here: no endpoint returns or accepts a persona that affects authorization, and no other endpoint in this table takes a persona parameter. See §2.2a.

**Property (Property Manager Console, and the owner persona in the driver apps)**

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/properties` | Requires both `location` and `entryLocation`. Grants `property_manager` role scoped to the new property to the creator. For `independent_home`/`standalone`, also inserts the `owner_self` authorization in the same transaction. |
| `GET` | `/v1/properties` | Scoped to the caller's `user_roles` grants. |
| `GET`/`PATCH` | `/v1/properties/:id` | 403 (not 404) when out of scope. |
| `POST` | `/v1/properties/:id/authorizations` | Body: type, permitted types, outsider policy, effectiveFrom, expiresAt?, documentId?. |
| `POST` | `/v1/properties/:id/authorizations/:aid/revoke` | Required reason. Returns `{ suspendedListingCount }` so the UI can confirm what it did. |
| `GET` | `/v1/properties/:id/access-policy` | Latest version (+ `?all=true` for history). |
| `POST` | `/v1/properties/:id/access-policy` | Appends a new version. Never a PUT — versions are immutable. |

**Host**

| Method | Path | Notes |
|---|---|---|
| `POST`/`GET`/`PATCH` | `/v1/host/profile` | Creating grants the `host` role. |
| `POST` | `/v1/host/documents/upload-url` | Body: docType, contentType, byteSize. Returns `{ documentId, uploadUrl, storageKey, expiresIn }`. Server generates the key; client never chooses it. |
| `POST` | `/v1/host/documents/:id/complete` | Idempotent — a repeated call on an already-completed document is a 200 no-op. |
| `POST` | `/v1/host/profile/kyc/submit` | `not_started`/`rejected` → `submitted`. |
| `PUT` | `/v1/host/profile/payout` | Full account number in, encrypted at rest, `{ last4, ifsc, bankName }` back. The full number is never echoed, not even to the host who just typed it. |
| `GET`/`POST` | `/v1/host/listings` | POST creates a `draft`. |
| `GET`/`PATCH` | `/v1/host/listings/:id` | PATCH refused on `pending_verification` and `suspended`. |
| `POST` | `/v1/host/listings/:id/photos/upload-url` | Same presign shape as documents; public-read bucket class. |
| `POST` | `/v1/host/listings/:id/photos/:photoId/complete` | Idempotent. |
| `PATCH`/`DELETE` | `/v1/host/listings/:id/photos/:photoId` | Reorder / set cover / delete. |
| `PUT` | `/v1/host/listings/:id/pricing` | Body is a **complete price sheet**; appends a new version. |
| `GET` | `/v1/host/listings/:id/pricing/preview?start=&end=` | Returns the Sprint-4 breakdown shape. |
| `POST` | `/v1/host/listings/:id/submit` | `draft → pending_verification`. Returns **all** validation failures at once. |
| `POST` | `/v1/host/listings/:id/pause`, `/resume`, `/archive` | Guarded transitions. |

**Admin** (extends the existing `/v1/admin/*` tree and its `requireAdminRole`)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/admin/listings?status=&propertyId=&page=` | Both roles; `support` gets host PII masked. |
| `GET` | `/v1/admin/listings/:id` | Everything the moderator needs in one response. |
| `POST` | `/v1/admin/listings/:id/approve` | `platform_admin` only. Body: level, expiresAt?, reasonCategory, note?. |
| `POST` | `/v1/admin/listings/:id/reject`, `/suspend` | `platform_admin` only. Required reason category. |
| `GET` | `/v1/admin/hosts/:id/kyc` | `platform_admin` only. |
| `POST` | `/v1/admin/hosts/:id/kyc/approve`, `/reject` | `platform_admin` only. |
| `GET` | `/v1/admin/documents/:id/download-url` | `platform_admin` only. **Writes a `document.download` audit row before returning the URL.** Short TTL (≤5 min). |
| `POST` | `/v1/admin/hosts/:id/payout/reveal` | `platform_admin` only. Returns the decrypted account number **once**. `POST`, not `GET`, deliberately — it has a side effect (the audit row), and it must never be cacheable, bookmarkable, loggable as a URL, or reachable by a prefetch. Requires a reason string, same as a suspend. |

### 2.5 Concurrency / idempotency plan

No money and no holds this sprint, so the spec's payment-webhook cases don't apply — but three genuine races do, and one of them is a correctness rule, not a nicety.

**R1 — Authorization revoke vs. listing publish (the flagship case).** Non-negotiable rule 9 says property access rules override marketplace availability. Under READ COMMITTED, an admin approving a listing and a manager revoking the property's authorization can interleave such that the approve reads "authorized", the revoke's cascade doesn't see the not-yet-committed `published` row, and the listing ends up **published under a revoked authorization** — precisely the state the rule forbids.

Fix, both halves inside one transaction:
- **Publish path:** `SELECT ... FROM property_authorizations WHERE property_id = $1 AND revoked_at IS NULL FOR UPDATE`, re-check expiry and outsider policy *inside* the transaction, then transition the listing.
- **Revoke path:** take the same row lock `FOR UPDATE` first, then revoke, then cascade `UPDATE listings SET status='suspended', status_reason='authorization_revoked' WHERE property_id=$1 AND status='published'`, then write audit rows.

Whichever transaction gets the lock first wins; the second sees committed state and does the right thing. This is the same class of bug as Sprint 1's refresh-token race and deserves the same treatment: **a Testcontainers test against real Postgres, not a mock.**

**R2 — Concurrent lifecycle transitions.** Every transition is a conditional update: `UPDATE listings SET status = $new WHERE id = $id AND status = $expected RETURNING *`. Zero rows returned → 409 naming the state actually found. No SELECT-then-UPDATE anywhere. This covers two admins approving one item and host-pause racing admin-suspend.

**R3 — Concurrent pricing edits.** `unique (listing_id, version)` means the losing writer gets a unique violation rather than silently interleaving rules into another version; the service catches it via the existing `pgConstraintName()` helper and retries with the recomputed next version (same retry shape `updateVehicle` already uses). No interleaved half-version is representable.

**R4 — Cover-photo uniqueness.** `unique (listing_id) where is_cover = true`. Deliberately the *same* mechanism as `vehicles_user_id_default_unique_idx`, because Sprint 1 proved the application-level unset-then-set transaction has a real race under READ COMMITTED. Unset-then-set plus a retry on the constraint violation; the database is the guarantee.

**R5 — Upload idempotency.** The server generates every `storage_key`, so a retried presign issues a *new* key (harmless, orphan sweep can reap it later) and a retried `/complete` on an existing key is a 200 no-op. `storage_key` is unique. A double-tapped "Done" on a flaky connection cannot create duplicate photo rows.

**R6 — The sweep job's re-check.** Detailed in §2.6.

### 2.6 Job/queue plan — BullMQ's first appearance

Per the job inventory in `tech-stack.md` §6, exactly one job belongs to this sprint:

| Job | Trigger | Module | Spec |
|---|---|---|---|
| Verification/document expiry downgrade sweep | Recurring cron, daily | Listing & Inventory | `INV-02` |

Its idempotent re-check, spelled out because rule 2 requires it and because this is the template every later job copies: for each listing whose highest valid verification level has fallen below its property's required minimum **as recomputed now** (not as the job was scheduled), and whose status is *still* `published`, transition to `suspended` with reason `verification_expired` and a `system`-actor audit row. Listings already suspended, already re-verified, or archived since scheduling are skipped. Re-running the sweep any number of times produces the same end state.

**Deliberately not a job:** property-authorization expiry. `tech-stack.md` §6 already names this as a query-time check, and AC-4 depends on that — a job-based expiry means a window where a revoked property's listings are still exposed because the job hasn't fired.

Standing BullMQ up here is a conscious choice: a daily sweep whose worst failure is a badge being stale for a day is a far better first job than Sprint 4's hold-expiry, whose worst failure is overselling a parking space.

### 2.7 External integration touchpoints

Two new provider adapters, both per `tech-stack.md` §8 — interface first, mock implementation, config-selected, **never a vendor SDK call from business logic**.

**`StorageProvider`** — `getUploadUrl(class, key, contentType, byteSize)`, `getDownloadUrl(class, key, ttl)`, `delete(class, key)`. Two sensitivity classes per §7: `public` (listing photos, CDN-frontable) and `private` (KYC, ownership evidence, authorization letters — presigned GET only, `platform_admin` only, every issuance audited). Implementations: `s3` and `mock` (local directory + a dev-only static route). `STORAGE_PROVIDER=mock` **must be covered by the existing production-boot guard** — extend it rather than writing a second one.

**`MapsProvider`** — `geocode(address)`, `reverseGeocode(lat,lng)`, `staticMapUrl(...)`. Implementations: `mapbox` and `mock` (fixed coordinates for seeded pilot addresses). Sprint 2 needs only reverse-geocode-on-pin-drop and a forward-geocode hint on the address field; `SRCH-01`'s real destination search is Sprint 3. Building the boundary now means Sprint 3 adds a method to an existing adapter instead of retrofitting one.

Both new `*_PROVIDER=mock` values join the production-boot refusal list. That is rule 5's whole point: structurally impossible, not "off by default".

### 2.8 Risks & concerns

1. **Sprint 2 is still the largest sprint so far, though the persona decision helped.** Six new table clusters, two new provider adapters, the first geo work, the first job queue, a new role model, **one new client surface** (the PM console), and substantial extensions to three existing apps. The persona decision removed an entire new application from the plan — the owner surface is now a mode inside `driver-mobile` and `driver-web`, reusing their navigation shell, auth, API client and token storage. That is the single biggest scope reduction available and it has been taken. What remains is real, and §2.9's sequencing is how it stays survivable.
2. **The Host surface is a persona, not an app — decided** (was O-8). `01-feature-modules-and-architecture.md` lists Host/Owner App as a separate React Native surface; the user's direction supersedes that, and the doc should be updated to match rather than left contradicting the build. The upside beyond scope: a host who is also a driver has one account, one session, one push-token registration, and one place to look. The thing to watch: `driver-mobile` and `driver-web` now serve two audiences, so the root navigator split (§3.1) has to be a genuine fork rather than conditional rendering sprinkled through shared screens — otherwise both personas slowly degrade into a compromise that serves neither.
3. **`GATE-06` and `GATE-11` are answered but not yet recorded.** Both Engineering Gate items are implemented and decided by this sprint (authorization rules in Group E; PII/KYC/payout handling and the 8-year retention in locked decisions 7, 11 and 12) — but they are still unchecked in `02-kanban-board.md`. What was a genuine blocker in the first draft of this plan is now clerical. The substantive risk that remains is narrower and concrete: **`PAYOUT_ENCRYPTION_KEY` must be backed up outside the database before the first host enters an account number**, or those numbers become unrecoverable. See Nikhil §9.
4. **The `support` role's permissions — resolved** (O-1, carried open from Sprint 1). `platform_admin` only for moderation actions, KYC document downloads and payout reveals; `support` sees the queue, masked, and can act on nothing new. The Sprint 1 question about `support` suspending *users* is answered by leaving that permission exactly as it shipped.
5. **PostGIS on the production EC2 Postgres is an environmental prerequisite, not a code change.** The local Docker image bundles it; a self-managed Postgres on EC2 needs the `postgis` package installed before `CREATE EXTENSION` will succeed. See Nikhil §5.
6. **Mobile has still never run on a device** (carried from Sprint 1) — and this sprint **doubles what's unverified inside that same app**: a persona picker, a second root navigator, a runtime theme switch, a camera/photo upload flow and a map pin picker, none of which have ever been seen on hardware. Theme switching and the navigator fork in particular are the kind of thing that typechecks, bundles cleanly, and then looks wrong on a real screen. **A device run should happen before the owner persona is built, not after it** — the debt is cheaper to pay now than to discover across two personas at once.
7. **Listing ↔ availability boundary creep.** `INV-01` describes a space; `INV-03` describes *when* it is available. Sprint 2 must not grow an availability calendar. If a host asks "when is this bookable?", the Sprint 2 answer is "that's next sprint" — the listing being `published` is not yet a promise of availability.

### 2.9 Recommended sequencing (scope realism)

Deliver as two halves inside the sprint, in this order, so that a slip lands somewhere survivable:

**2A — Supply spine (everything that blocks Sprint 3).** PostGIS + geo helpers, `StorageProvider` + presign, `MapsProvider`, `user_roles` + `last_persona` + the persona endpoints, properties + authorizations + access policy, host profile + documents, listings + photos + lifecycle, pricing + resolver, admin moderation backend + the sweep job. **Plus the Admin Web Console moderation UI**, since that app already exists and an admin who can't approve anything makes the whole sprint undemonstrable — and approval is the gate the whole product hinges on (locked decision 5).

**2B — Owner persona**, in `driver-web` first, then `driver-mobile`. Web first is deliberate: it's the faster feedback loop, it proves the persona split and the upload flow against a real browser, and `driver-mobile` then ports a design that's already been seen working rather than being the place it's debugged. **The outstanding device run happens before the mobile half starts** (risk 6).

**2C — Property Manager Web Console.** Last, because it serves societies and commercial managers — which at pilot scale is the supply type acquired through a conversation rather than a signup form, and therefore the one where a platform admin can bridge a slip for a week without the pilot noticing.

If time runs out, it runs out in 2C. If instead the surfaces come first and the spine slips, Sprint 3 starts with nothing to search. **Sequencing, not a scope cut** — the full list still ships.

### 2.10 Task breakdown

**Rohan (backend)** — infra: PostGIS migration + geo helpers; `StorageProvider` interface + `s3` + `mock` + presign routes + prod-boot guard extension; `MapsProvider` interface + `mapbox` + `mock`; BullMQ bootstrap + worker entrypoint + the expiry sweep. Domain: `user_roles` + `requireRole`/`requirePropertyScope` + `users.last_persona` + the two persona endpoints; property CRUD with transactional self-authorization for individual owners + authorization grant/revoke with the `FOR UPDATE` cascade; versioned access policy; host profile + documents + KYC transitions; listing CRUD + photos + guarded lifecycle transitions; pricing versions + `resolvePrice()` + preview; admin moderation endpoints + audited document downloads. Every status-changing action goes through the existing `recordAudit()`.

**Kavya (frontend)** — shared primitives first (§3.1); the persona card + root navigator fork + runtime theme switch in `driver-web` and `driver-mobile`; the owner persona's screens (property, spaces, photos, pricing, submission status); Property Manager Web Console (`apps/property-web`); Admin Web Console moderation extension.

**Divya** — see §4. **Nikhil** — see §5.

---

## Step 3 — Kavya & Rohan: Implementation Plan

### 3.1 Kavya — Frontend/Mobile Plan

**Surfaces:** `driver-mobile` and `driver-web` (**extended** — each gains a persona picker, a second root navigator and the owner persona's screens), Property Manager Web Console (**new**, `apps/property-web`), Admin Web Console (**extended** — moderation). **No new host app.**

**The persona split, structurally** — this is the part that decides whether these two apps stay maintainable:

```
App root
 └─ session? ──no──► Phone → OTP  (Sprint 1, unchanged)
       │yes
       ▼
   lastPersona === null ──yes──► PersonaCard  ─┐
       │no                                      │
       ▼                                        ▼
   ┌───────────────────────────────────────────────────┐
   │  PersonaProvider  (theme + navigator, one fork)    │
   ├──────────────────────┬────────────────────────────┤
   │ DriverNavigator      │ OwnerNavigator             │
   │  Home / Vehicles /   │  Spaces / Properties /     │
   │  Profile             │  Profile                   │
   │  theme: driver       │  theme: host               │
   └──────────────────────┴────────────────────────────┘
```

Two rules for this fork, both aimed at the failure mode in Arjun's risk 2 — an app that slowly becomes a compromise serving neither audience:

1. **The fork happens once, at the navigator.** No screen below it takes an `isOwner` prop or renders conditionally on persona. If a screen would need to, it's two screens.
2. **`ProfileScreen` is the single deliberate exception** and is shared, because a person's name and phone don't change with their hat. It gains one new row: the persona switcher. On mobile that row sits in the same visually-separated group as sign-out — a mode change and a session change are the two things on that screen that alter what happens next, and grouping them makes both findable.

`ui-native` already exposes its theme through a React Context (`packages/ui-native/src/theme.tsx`), so a runtime theme swap needs no new architecture — the provider just moves above the navigator. `ui-web` themes via CSS custom properties, so the swap is a data attribute on the root element. Both are cheap; neither has been done at runtime before, so both get exercised on a device/browser before the owner screens are built on top of them.

**Design research (Mobbin, pulled this session — not deferred):**

- Host listing creation — Airbnb's [Creating a listing](https://mobbin.com/flows/ac0a721e-274d-4b18-97eb-403b4c59b394) and [Listing a place](https://mobbin.com/flows/99ae5c0a-c4e8-4bac-98d5-f00587611ead), Turo's [Adding car location](https://mobbin.com/flows/c703930c-b4d4-42b9-ab45-cf00cb4ee602).
- Host KYC/payout — Binance's [Verifying identity](https://mobbin.com/flows/cdc52574-dd6c-4203-8cc6-4a246dea0a8f), Careem's [Verifying a bank account](https://mobbin.com/flows/e09186aa-7a8e-437b-af6c-a19191726c25), Turo's [Adding payout information](https://mobbin.com/flows/4e57f24c-b599-48c8-a75a-0e0920ab4df1), BlaBlaCar's [Add payout methods](https://mobbin.com/flows/9253e5a8-2033-4bc8-9deb-7f858ce79d17).
- Ops consoles — Reddit's mod [Queue](https://mobbin.com/screens/c20fd251-fbfe-471b-b3a4-c0175cf1ada4), [Plain](https://mobbin.com/screens/9ff39f43-bdf9-4ae4-8c9f-b736cfacdcde), [Lightfield](https://mobbin.com/screens/c1322cfa-763a-4f21-8b49-0062d3c40ed1).

**What we take and what we deliberately don't** — the part that keeps this from being a trace:

| Reference | Taken | Rejected, and why |
|---|---|---|
| Airbnb listing flow | "Save & exit" on every step; informative progress bar; "you earn" shown beside the driver price | The 29-screen length and the conversational one-question-per-screen voice. A parking space has ~8 attributes; stretching them over 29 screens would be theatre. Ours is 6 steps. |
| Binance/Careem KYC | The "is this image clear?" confirmation before submit | The full-bleed black camera chrome and biometric-selfie step. We're reviewing documents manually at pilot scale; a selfie we don't verify is theatre plus a privacy liability under `GATE-11`. |
| Turo payout ordering | Payout last, framed as "so you can get paid", never blocking earlier steps | Stripe-branded sub-flow chrome. Our payout provider isn't chosen yet (`tech-stack.md` §12) — the screen must not imply one. |
| Reddit mod queue | Tabbed status queue; inline row actions; keyboard-first | Its icon-dense action toolbar. Our moderators handle tens of items, not thousands; labelled actions beat compressed ones. |
| Plain / Lightfield | Left scope rail → list → right detail panel, actions inside the panel | Their multi-pane density at PM scale. A manager with two properties doesn't need a three-pane IDE. |

**Visual direction per surface — what makes each ParkAway's rather than interchangeable:**

- **Owner persona — "calm and numbers-confident"** (`frontend.md`). A **third theme** in `design-tokens`, alongside `driver` (warm terracotta/cream) and `admin` (cool neutral/deep teal): cool slate ground with a single deep-green accent reserved **exclusively for money and positive verification states** — earnings, "you earn ₹X", verified badges — and nothing else. The specific decision that keeps it from generic-SaaS: **money is set in tabular figures at a display size on a plain ground, with no card, no gradient, no chart** until there's real earnings history to chart in Sprint 6. A host's first question is "what will I make?", and the answer should be the largest thing on the screen, unornamented. Shared spacing/type scale with the other themes — themed, not forked.

  Because this theme now lives **inside the same app as the driver theme**, it carries a second job it wouldn't have had as a separate app: making the mode unmistakable at a glance. The temperature flip (warm terracotta → cool slate) does most of that work, and it's why the persona card shows both palettes side by side — the colours teach the modes before either has been used. Concretely, the mode must be legible from a screenshot with no text read: ground temperature, accent hue, and the tab bar's icon set all differ.

- **Persona card** — the only screen in this sprint that is neither warm nor cool but holds both. Neutral ground, two full-width cards each carrying its own persona's palette, equal weight, no default selection, no "recommended" badge. It is asking for an intent, not a preference, and it should not borrow the visual grammar of a pricing-plan picker.
- **Property Manager Web Console — reuses the `admin` theme deliberately, with one difference.** A PM console and the internal admin console are the *same design family* per `frontend.md` ("dense, scannable, unglamorous"); a fourth theme would be decoration, not differentiation. The one difference that matters: a **persistent property-scope chrome** (the property's name and authorization state pinned in the top bar, always) so an external manager is never confused about which property they're acting on, and so nobody mistakes this surface for the internal console. Authorization state gets a dedicated, unmissable treatment — it is the single fact this surface exists to convey.
- **Admin moderation — extends the existing admin theme unchanged.** New screens, no new visual language.

**Shared-primitive gaps — genuinely new, and a budgeted deliverable, not incidental work:**

| Primitive | Package | Needed by | Status |
|---|---|---|---|
| `Select` | ui-web + ui-native | property type, vehicle types, doc type, reason category | **Missing from both packages today.** Blocks nearly every Sprint 2 form. |
| `FileUpload` / `DocumentUpload` | ui-web **+ ui-native** | KYC, authorization letters | New. Owns presign → PUT → complete, progress, retry-the-one-failed-file. Screens never touch S3 directly. Native now needed too, since KYC lives in the owner persona on mobile. |
| `PhotoManager` | ui-web + ui-native | listing photos | New. Grid, drag-order, per-photo menu, cover selection. The native version is the one that matters most — photographing a parking space is a phone activity. |
| `MapPicker` | ui-web + ui-native | property centre + entry pin, listing pin | New. **Wraps the `MapsProvider` adapter — no screen imports `mapbox-gl` or `@rnmapbox/maps`.** |
| `MoneyField` | ui-web + ui-native | pricing step | New. Paise-integer in, rupee display out, in one place. |
| `TimeRangeField` | ui-web **+ ui-native** | gate hours (PM console **and** owner persona), peak windows | New. Native needed because owners now create properties in-app. |
| `Tabs` | ui-web | property detail, moderation queue | New. Web only — the native side uses the tab bar it already has. |
| `Toggle` | ui-web + ui-native | covered, amenities, escort required | New. |
| `DetailPanel` | ui-web | moderation queue, property detail | New — the list+panel layout shell, built once and used by both consoles. |
| `Badge` | **ui-web** | verification/authorization chips | Exists in `ui-native` only. This sprint is the moment to close the inventory gap `PROGRESS.md` flagged. |
| `Table`, `StatusBadge`, `Card`, `Modal`, `EmptyState`, `InlineBanner`, `Button`, `TextField`, `WizardProgress` | existing | everywhere | Reused as-is or with a new variant. `WizardProgress` covers the listing stepper with no changes, and the **persona card is `Card` + `Button` composed** — it is a screen, not a new primitive. |

That is ten new primitives, most now needed on both platforms rather than web-first — the direct cost of the owner surface being a persona inside the mobile app rather than a web app. It is a large number and it is the honest one: Sprint 1 built the login-and-form primitives; Sprint 2 is the first sprint with uploads, maps, money and data-dense consoles. Every one is used by at least two screens, most by two surfaces. **Flagging the `host` theme addition and the ten primitives to Arjun**, per the standing rule that shared-package additions are project-wide conventions.

**API integration:** matches §2.4 exactly. TanStack Query throughout (the Sprint 1 proposal, now de facto convention — worth Arjun formally locking it in `tech-stack.md` rather than leaving it a per-sprint proposal for a third time). Uploads always go presign → direct PUT → complete; a failed PUT retries that file alone and never restarts the flow.

**Validation:** client-side mirrors server rules for feedback only; the server is authoritative. The submit-for-publication call returns **all** failures at once and the review screen renders each as a link back to the step that owns it.

**Map/geo:** `MapPicker` only, through the adapter. No route drawing, no clustering, no search-as-you-type — those are `SRCH-04`, Sprint 3.

### 3.2 Rohan — Backend Plan

**Module layout**, following the existing `src/modules/<module>/{routes,*.service}.ts` convention:

```
src/modules/identity/     + persona.service.ts, + role.service.ts        (existing module)
src/plugins/              + requireRole.ts, + requirePropertyScope.ts   (mirrors requireAdminRole)
src/modules/property/     property.service.ts, authorization.service.ts, access-policy.service.ts, routes.ts
src/modules/host/         host-profile.service.ts, document.service.ts, routes.ts
src/modules/listing/      listing.service.ts, photo.service.ts, lifecycle.service.ts, verification.service.ts, routes.ts
src/modules/pricing/      pricing.service.ts, resolve.ts        ← resolve.ts is pure; Sprint 4 imports it
src/modules/admin/        + moderation.service.ts, + kyc-review.service.ts   (existing module)
src/lib/fieldCrypto.ts    AES-256-GCM encrypt/decrypt for at-rest column values (payout account number)
src/providers/storage/    types.ts, s3StorageProvider.ts, mockStorageProvider.ts, index.ts
src/providers/maps/       types.ts, mapboxMapsProvider.ts, mockMapsProvider.ts, index.ts
src/jobs/                 queue.ts, worker.ts, verificationExpirySweep.ts
src/lib/geo.ts            ST_MakePoint / ST_DWithin helpers — PostGIS SQL lives here, never inline in services
```

Backend files keep `.js` import extensions (`apps/api` only). Everything else stays extensionless — the lint rule enforces it.

**Migrations**, in order, each independently applyable:
1. `CREATE EXTENSION IF NOT EXISTS postgis` — alone.
2. `user_roles`, plus `users.last_persona` (nullable, CHECK `in ('driver','owner')`). The only change to a Sprint 1 table this sprint, and it's an additive nullable column — existing rows read as null, which correctly means "has never chosen", which correctly shows them the picker once.
3. `properties`, `property_authorizations`, `property_access_policies`.
4. `host_profiles`, `host_documents`.
5. `listings`, `listing_photos`, `listing_verifications`.
6. `pricing_versions`, `pricing_rules`.

All additive apart from one nullable column on `users`. Rollback is `DROP` and nothing Sprint 1 built is at risk.

**Drizzle + PostGIS note:** Drizzle has no native `geography` type. Define it via `customType` in `schema.ts` and keep all spatial predicates in `lib/geo.ts` using `sql` templates — never hand-rolled haversine (non-negotiable rule 7). `schema.ts` stays a single file with no internal cross-imports, for the drizzle-kit reason its existing header comment documents.

**`lib/fieldCrypto.ts`** is deliberately tiny and deliberately the only place `PAYOUT_ENCRYPTION_KEY` is read: `encryptField(plaintext) → { ciphertext, keyVersion }` and `decryptField(ciphertext, keyVersion)`, AES-256-GCM over Node's `crypto`, random 12-byte IV per value, auth tag stored alongside. Two rules enforced by review and by grep: **`decryptField` has exactly two call sites** (the Sprint 6 payout path and the admin reveal service), and **no service returns its result upward into a serialized response object** — the reveal endpoint returns it directly and nothing stores it. Boot fails loudly if `PAYOUT_ENCRYPTION_KEY` is absent or not 32 bytes, alongside the existing production-boot guards, rather than silently falling back to storing plaintext.

**Storage adapter:** presign endpoints validate resource ownership *before* issuing a URL, pick the bucket class from the document type (never from client input), generate the key server-side, and cap `byteSize`/`contentType` at issue time. Private-class downloads are `platform_admin`-only, short-TTL, and audited before the URL is returned — if the audit write fails, no URL is issued.

**Audit actions this sprint** (all via the existing `recordAudit()`): `persona.role_granted`, `persona.switched`, `property.create`, `property.update`, `property.authorization.grant`, `property.authorization.revoke`, `property.access_policy.version`, `host.profile.create`, `host.kyc.submit`, `host.kyc.approve`, `host.kyc.reject`, `document.upload`, `document.download`, `listing.create`, `listing.submit`, `listing.approve`, `listing.reject`, `listing.suspend`, `listing.pause`, `listing.resume`, `listing.archive`, `listing.verification.expire` (actor_type `system`), `listing.pricing.version`, `host.payout.set`, `host.payout.revealed`. New `target_type` values: `property`, `listing`, `host_profile`, `document`.

**Error handling:** lifecycle conflicts are `409 LISTING_STATE_CONFLICT` with the actual current state in `details`. Publication refused for authorization reasons is `409 PROPERTY_NOT_AUTHORIZED` with the specific cause (`revoked` / `expired` / `outsiders_disallowed`) — a host must be able to tell "your property's authorization lapsed" from "your photos were rejected".

---

## Step 4 — Divya (QA): Test Plan

Sprint 1 ended at 38 tests (30 unit + 8 Testcontainers). Sprint 2 should land in the 75–90 range; the exact number matters less than the four cases in §4.2, which are non-negotiable.

### 4.1 By layer (`tech-stack.md` §11)

**Vitest unit** — pricing precedence (the full table: base-only, peak overlapping partially, weekend + peak collision, window spanning midnight, sub-hour minimum duration, a window crossing two versions' effective boundary); lifecycle transition matrix (every legal transition passes, every illegal one 409s); verification-level derivation (highest *valid* record wins; expired ignored; revoked ignored); document sensitivity-class routing; the production-boot guard refusing `STORAGE_PROVIDER=mock` and `MAPS_PROVIDER=mock`, and refusing to boot at all without a valid 32-byte `PAYOUT_ENCRYPTION_KEY`.

**Payout encryption gets its own small suite**, because "encrypted at rest" is a claim that is trivial to believe and easy to have silently broken: round-trip encrypt → decrypt returns the original; the stored ciphertext **does not contain the plaintext account number as a substring** (the test that actually catches a mis-wired write path); a tampered ciphertext or auth tag throws rather than returning garbage; a value encrypted under key version 1 still decrypts after a version-2 key is introduced; IFSC and account-number format validation accept real formats and reject malformed ones.

**Fastify `.inject()` integration** — **authorization is a first-class test target here, not an afterthought**: host A cannot read/modify host B's listing, document, or presign URL; a property manager scoped to property X gets 403 (not 404, not an empty list) on property Y; `support` can list the moderation queue but receives 403 on approve/reject/suspend and on any KYC document download; an unauthenticated caller gets 401 everywhere. Plus: submit-for-publication returns *all* validation failures at once; presign rejects an oversized/wrong-content-type request.

**Payout leak tests, stated as a negative across the whole API surface:** set a payout account, then assert that the full number appears in **no** response body from any endpoint — the host's own profile read, the admin host detail, the admin listing detail, the moderation queue, and the search-users endpoint Sprint 1 built. Written as a sweep over responses rather than one assertion per endpoint, so an endpoint added in Sprint 3 or 6 that naively spreads the host row inherits the test rather than escaping it. Plus: `support` gets 403 on the reveal endpoint; `platform_admin` gets the number *and* an audit row exists with their id and reason; the audit row is written even if the response is never delivered.

**The persona-is-not-authorization tests (Group D AC-7) are the sharpest of these** and are called out separately because they're the ones a reasonable implementation can pass by accident and then lose in a later refactor: a driver-only user's token, sent to every `/v1/host/*` and `/v1/properties/*` endpoint, must get 403 — including when the request carries a persona header, a persona body field, or a hand-forged JWT with a `persona: "owner"` claim added. The last case matters most: it asserts the server ignores a claim the client can write. Conversely, a user holding the `host` role must succeed on host endpoints **regardless of what `last_persona` says**, proving the UI preference has no authorization effect in either direction.

**Testcontainers (real Postgres + PostGIS + Redis)** — the four cases in §4.2, plus: the PostGIS migration actually applies and a GIST-indexed `ST_DWithin` query returns the expected rows (proving the extension and index are real, not assumed — this codebase has been burned once by a "documented but not implemented" feature); audit rows are genuinely written for each status-changing action, asserted by action name and target, in the same style as Sprint 1's logout-audit tests.

**Playwright (web E2E)** — first use in this repo, so the harness itself is a deliverable. **One flow end to end, which is the whole sprint in a single test:** a user logs in with OTP → picks the owner persona → creates a property → adds a space with photos (mock storage adapter) → sets a price → submits for approval; **the space is verified absent from any public listing while `pending_verification`**; an admin finds it in the moderation queue and approves it; the space becomes `published` and the owner sees it. That negative assertion in the middle is the important one — it is the executable form of locked decision 5, and it's the kind of thing that's easy to assume and never actually check.

Plus a second, shorter flow: persona switch — a user in the driver persona switches to owner and back without re-authenticating, and the theme and navigation change with them.

**Mobile (Jest + RNTL)** — the persona picker's branching (null `lastPersona` shows it, a set one doesn't), the navigator fork rendering the right tab set per persona, and the photo-upload step's presign → PUT → complete path with a deliberately failing PUT. **The device-run debt from Sprint 1 must be paid before the owner persona is built on mobile** — see Arjun's risk 6. Running a persona picker, a theme swap, a camera flow and a map picker on hardware for the first time simultaneously is how a week disappears.

### 4.2 Concurrency / idempotency cases — required, not optional

Spec §24 names simultaneous-action races and job-refire-after-state-change explicitly. No payments or holds this sprint, but these four are the equivalents and each is a real bug class, not a formality:

1. **Authorization revoke ∥ listing publish (R1).** Two concurrent transactions. Assert: never a `published` listing under a revoked authorization, in either interleaving. **This is the one test that proves non-negotiable rule 9 is structurally enforced rather than documented.**
2. **Two admins approving the same queue item (R2).** Assert: exactly one 200, one 409 naming the current state, exactly one verification record, exactly one audit row.
3. **Two concurrent pricing edits (R3).** Assert: two versions with distinct ordered numbers, no version containing rules from both edits, no lost update.
4. **Sweep job re-fire after state already changed (R6).** Schedule a downgrade, re-verify the listing first, run the sweep. Assert: no change, no spurious audit row. Then run the sweep twice over a genuinely expired listing. Assert: one suspension, one audit row, second run is a no-op.

Plus the three DB-constraint races, mirroring Sprint 1's vehicle-default test: **two concurrent set-cover-photo** calls leave exactly one cover; **two concurrent host-profile creations** for one user leave exactly one profile; **two concurrent owner-persona selections** (a double-tapped card on a slow connection) leave exactly one `host` role grant and one audit row, not two.

### 4.3 Fixtures & mocks

The mock `OtpProvider` carries over. **Two gaps, both of which are Rohan's deliverables and not test-only scaffolding:** `StorageProvider` mock (must exercise presign → PUT → complete for real against a local directory, including a *failing* PUT, or the upload retry path is untested) and `MapsProvider` mock (fixed coordinates for seeded pilot addresses, so nothing in CI needs a Mapbox key). A seed script producing an authorized property + a verified host + one published listing is needed by Playwright and is the natural starting fixture for Sprint 3's search work.

### 4.4 What "done" means

Not "the happy path passes." Specifically: every acceptance criterion in §1 has a test or a stated reason it can't have one; all four §4.2 races are covered by Testcontainers tests against real Postgres; every authorization boundary in §4.1 has an explicit negative test; the audit row for every status-changing action is asserted by name; `npm run lint` is clean monorepo-wide (standing repo expectation); and **the "documented done but not actually built" failure mode from Sprint 1's audit is checked for directly** — for each ticket, grep the code for the thing, don't trust this document.

---

## Step 5 — Nikhil (DevOps): Deployment Notes

This sprint has real infrastructure implications — the first since the initial setup.

**1. PostGIS on the production EC2 Postgres is a prerequisite, not a migration.** The local Docker image (`postgis/postgis:16-3.4-alpine`) bundles the extension; a self-managed Postgres on EC2 (`tech-stack.md` §10) does not until the `postgis` package is installed at the OS level, and `CREATE EXTENSION` additionally needs superuser. **Verify this on the EC2 instance before the migration ships**, or deploy fails on migration 1 of 6. Also a note for the Phase-2 RDS path: RDS supports PostGIS, but the extension must be created explicitly there too.

**2. New environment variables** — `STORAGE_PROVIDER` (`s3`|`mock`), `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_REGION`, AWS credentials (**prefer an EC2 instance role over long-lived keys**), `PRESIGNED_UPLOAD_TTL_SECONDS`, `PRESIGNED_DOWNLOAD_TTL_SECONDS`, `MAPS_PROVIDER` (`mapbox`|`mock`), `MAPBOX_TOKEN` (plus a separate public token for the browser — never ship the secret token to a client bundle), `REDIS_URL` reused for BullMQ, `BULLMQ_PREFIX`, and **`PAYOUT_ENCRYPTION_KEY` / `PAYOUT_KEY_VERSION`**. Both new `*_PROVIDER` values must be wired into the existing production-boot guard. `.env.example` updated in the same PR — Sprint 1's discipline, kept — with a placeholder for the payout key and a comment saying how to generate one (`openssl rand -hex 32`), never a real value.

**3. Two S3 buckets, split by sensitivity** (§7), not one with prefixes. Public: listing photos, CloudFront-fronted, public-read, no listing enumeration. Private: KYC/ownership/authorization documents, **block all public access**, presigned GET only, server-side encryption, versioning on. CORS on both buckets must permit direct browser PUT from the host/PM origins — this is the single most common way a presigned-upload implementation fails in staging after working locally.

**4. Lifecycle/retention rules are blocked on `GATE-11`.** The private bucket needs an expiry or cold-transition rule matching the approved KYC retention period. That period is not decided (O-9). **We should not accumulate identity documents under an undecided retention policy** — this is the infrastructure half of Arjun's risk 3.

**5. First BullMQ worker process.** A separate process from the API (`npm run worker`), managed under systemd or pm2 alongside Fastify on the single EC2 instance. One daily cron consumes negligible resources, so this doesn't strain the box — but it is now a **second process that can die silently**, and nothing currently notices. Minimum: a restart policy plus a log line per sweep run. Real job observability is a tracked follow-up, not Sprint 2 scope, and it should be in place before Sprint 4 puts hold-expiry on this queue.

**6. Single-EC2 pressure check.** Postgres + Redis + Fastify + now a worker on one box is still comfortable at pilot scale. The thing that will actually push it is listing photos — which is exactly why they go to S3 + CloudFront rather than the instance's EBS volume. No change to the §10 upgrade trigger.

**7. Backups.** `pg_dump` now covers materially more valuable data (properties, authorizations, listings, pricing history). S3 is versioned and separately durable, but a restore is only coherent if both are restored to a consistent point — worth documenting the restore runbook now, while the data volume makes it easy to test.

**8. Still open from Sprint 1:** Postgres and Redis remain internet-reachable by design during development (rule 11), with an explicit expiry. This sprint puts **identity documents and full bank account numbers** behind that exposure. Application-level encryption (§2.3) is what keeps that from being a live exposure rather than a theoretical one — an attacker who reaches Postgres gets ciphertext and no key. That is a mitigation, not a reason to relax: **the pre-launch lockdown moves from "tracked task" to the top of the pre-launch list**, and it should now be done before the pilot takes on real hosts rather than before launch in the abstract.

**9. Payout key management — new, and the one piece of this sprint's infrastructure with no second chance.**
- The key lives in the environment/secrets manager, **never in Postgres, never in the repo, never in `.env.example`, and never in anything `pg_dump` emits.** A backup and the key must not be recoverable from the same place, or the encryption buys nothing.
- **Losing the key means losing every stored account number** — irreversibly, with no recovery path. Back it up separately from the database backups, to somewhere a database restore cannot reach, before the first host enters an account number. This is the step that gets skipped and then discovered in Sprint 6.
- Distinct keys per environment. A dev key must never decrypt production data, which also means a production dump restored into dev is inert — a useful property, not an inconvenience.
- `PAYOUT_KEY_VERSION` exists so rotation is a background re-encrypt over `payout_key_version < current`, not a flag day. No rotation is needed this sprint; the column is what makes it cheap later.
- Both the private S3 bucket's lifecycle rule and any future payout purge follow locked decision 12: **active host + 8 years after last payout.**

---

## Step 6 — Arjun (Tech Lead): Final Checklist

- [x] **API contract agreed between Kavya and Rohan** — §2.4, integrated against 1:1 in §3.1.
- [x] **No unresolved architecture risks** — **all ten open decisions (O-1…O-10) are now closed** (see "Decisions locked", items 1–13). Two new architectural rules came out of them and both are specified with their own tests: §2.2a (persona is navigation, never authorization) and §2.3's payout note (encrypted at rest, key outside the database, two decrypt call sites).
- [x] **Drizzle schema changes clear, migration plan safe** — six migrations, all additive apart from one nullable column on `users`, PostGIS isolated as migration 1. The `now()`-in-index-predicate trap is called out before it bites.
- [x] **Acceptance criteria implementable and testable** — each maps to a test in §4.
- [x] **Concurrency/idempotency verified** — no holds or payments this sprint; the four real races (R1–R3, R6) are specified with their locking/constraint mechanism *and* their tests. R1 is the one that enforces non-negotiable rule 9.
- [x] **Divya's plan covers concurrency, not just happy paths** — §4.2, plus explicit authorization-boundary negatives, which spec §24 requires by name.
- [x] **External integrations go through provider adapters** — `StorageProvider` and `MapsProvider`, mock-first, both added to the production-boot guard. No screen imports `mapbox-gl`; no service imports the AWS SDK outside the adapter.
- [x] **Audit fields present on every status-changing action** — §3.2's action list, all via the existing `recordAudit()`. Including `document.download`, which is access rather than status change, for the same `GATE-11` reasoning Sprint 1 used for admin searches.
- [x] **New screens have a stated design direction grounded in real research** — Mobbin pulled this session; §3.1 states what was taken *and what was rejected and why*, which is the part that keeps it from being a trace.
- [x] **New UI built from shared packages** — ten new primitives, each used by ≥2 screens, all added to `ui-web`/`ui-native` rather than inline. The `host` theme is a third theme on the existing token scale, not a fork. Both flagged for sign-off.
- [x] **In-scope for the current phase** — all P0/MVP. No P2/P3 exception needed. The `OS-*` boundary is named explicitly so the PM console doesn't drift into Phase 2.
- [ ] **Nikhil's notes reveal no blocker on EC2** — ⚠️ **one prerequisite**: PostGIS must be installed on the EC2 Postgres before migration 1 ships. Not a blocker, but it fails loudly if skipped.
- [ ] **Blockers and dependencies called out** — see below.

### Blockers — now clerical, not decisional

Both remaining gate items have their answers; what's left is recording them.

1. **`GATE-06` — property authorization rules.** Implemented by this sprint (Group E). Check the item off in `02-kanban-board.md` with the rules as built: one live authorization per property, query-time expiry, transactional revocation cascade, `owner_self` for individual owners, level 3 mandatory inside society/commercial properties.
2. **`GATE-11` — PII/KYC/payment data handling and retention.** Answered by locked decisions 7, 11 and 12: `platform_admin`-only access to identity documents and payout reveals, both audited; payout numbers encrypted at rest with the key outside the database; retention of active + 8 years after last payout. **Record it, and get the 8-year figure confirmed by whoever advises ParkAway on legal/tax before launch** — it's a defensible engineering default, not legal advice.

### The one prerequisite with no second chance

**Back up `PAYOUT_ENCRYPTION_KEY` somewhere a database restore cannot reach, before the first host enters an account number.** Lose it and every stored account number is unrecoverable. Nikhil §9.

### Dependencies (internal ordering)

```
  ┌─ PostGIS ────┐
  ├─ Storage ────┤
  ├─ Maps ───────┼──► properties ──► authorizations ──┬──► listings ──► pricing
  ├─ BullMQ ─────┤         │              │           │       │
  └─ user_roles ─┘         │              │           │    photos
        │            access policy        │           │
        │                                 │           └──► verification ──┐
        │                                 │                               ▼
        │                                 └──────────────────────► moderation (admin-web)
        │                                                                 ▲
        ▼                                                                 │
   persona endpoints ──► PersonaCard + navigator fork ──┐                 │
                                                        ▼                 │
   2B  owner persona (driver-web, then driver-mobile) ◄──┴─ listings/pricing/host profile
   2C  PM console ◄── properties/authorizations/access policy

   BullMQ ──────────────────────────────────────────► expiry sweep
```

Two ordering facts worth stating plainly:

- **`user_roles` and the persona endpoints gate every client screen in the sprint.** Nothing in the owner persona or the PM console is reachable until a user can hold a role and be routed by it. It is small work, and it is first.
- **Nothing in Sprint 3 (`INV-03`, `SRCH-*`) can start before `listings` + `properties` + PostGIS exist**, which is the whole reason §2.9 sequences the spine ahead of the surfaces.

---

## Decision record — all closed

Every open decision this plan raised was resolved on **2026-09-23**. Kept here in full rather than deleted, because the reasoning is what a future reader will want when one of these is questioned. The short form is in "Decisions locked" at the top.

| # | Decision | Outcome |
|---|---|---|
| **O-1** | Can `support` moderate listings / view KYC documents? | ✅ **No to both.** `platform_admin` only for moderation actions, private-document downloads and payout reveals; `support` gets read-only, masked queue access. Sprint 1's existing `support` permission for user suspend/restore is unchanged. |
| **O-2** | Minimum verification level to publish? | ✅ **Level 2** (location + photos) in general; **level 3** (property authorization) mandatory inside `society`/`commercial` properties. |
| **O-3** | Does incomplete KYC block publishing, or only payout? | ✅ **Payout only.** Maximises pilot supply; matches the Airbnb/Turo pattern the flow research surfaced. |
| **O-4** | Money representation. | ✅ **Integer paise everywhere** — database, API and client. No floats, no `numeric`, no rupee strings. |
| **O-5** | Platform fee model + value. | ✅ Host sets the driver-facing price; the platform fee is a percentage deducted from host earnings; the value lives in **one `pricing.config.ts` constant** with a TODO pointing at `ADM-08` (Sprint 7). |
| **O-6** | Role model. | ✅ **`user_roles` on the existing `users` table** (§2.2). One phone = one human, expressed in the product as the persona picker (Group D). |
| **O-7** | Where do full bank details live? | ✅ **In Postgres — user's decision, overriding this plan's original recommendation** to hold only a vault reference. Built with application-level **AES-256-GCM encryption, key outside the database**, no API returning the full number, and decryption confined to the payout path plus an audited `platform_admin` reveal (§2.3's payout note, Nikhil §9). The residual risk — full account numbers inside the `pg_dump`/snapshot blast radius — is stated there and mitigated by the key never living alongside the data. |
| **O-8** | Host surface platform. | ✅ **Neither a React Native host app nor `apps/host-web`.** The owner surface is a **persona inside the existing `driver-mobile` and `driver-web`**. `01-feature-modules-and-architecture.md`'s surface table has been updated to match. |
| **O-9** | KYC/payout retention period (`GATE-11`). | ✅ **Active host + 8 years after last payout** — matches the Companies Act 2013 books-of-account retention and covers PMLA's 5-year requirement. Drives the private bucket's lifecycle rule and any future purge job. **Confirm with legal/tax advice before launch**; it is an engineering default, not legal advice. |
| **O-10** | Should the PM Console be a third persona? | ✅ **No — it stays a separate web app** with its own login. An organisational, desktop, document-heavy role, and the console may later need credentials or SSO the OTP flow doesn't cover. Revisit if pilot societies turn out to be run from a phone. |

## Carried-forward items from Sprint 1 (not resolved by this plan)

1. **Mobile has never run on a real device or emulator.** Still outstanding, and now on the critical path: the owner persona adds a theme swap, a navigator fork, a camera/upload flow and a map picker to the *same* unverified app. **Pay this down before 2B's mobile half starts** (Arjun's risk 6).
2. **Phone-number recycling / dormant-account takeover** — deferred by the user, still open, still tied to `GATE-11`. **Sprint 2 raises the stakes materially, more than first written:** one phone number now unlocks both personas, so a recycled number inherits not just a driver profile but a host profile, its KYC state, its properties and its listings. The mitigation options are unchanged; the cost of not choosing one has gone up.
3. **Sprint 0 Engineering Gate is still unchecked** in `02-kanban-board.md`. Two of its items (`GATE-06`, `GATE-11`) are direct blockers for this sprint.
4. **`ui-web` ↔ `ui-native` inventory drift** — `Badge` exists only in native, `Table`/`StatusBadge` only in web. Sprint 2 closes the `Badge` gap since it needs one on web anyway.
