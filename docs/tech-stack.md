# ParkAway — Tech Stack Decisions

**Status:** Living document — records decisions as they're made, not a final architecture spec.
**Related:** `planning/01-feature-modules-and-architecture.md` (technology-agnostic HLD these choices implement)

---

## 1. Decided

| Layer | Choice | Status |
|---|---|---|
| API server | Fastify (Node.js) | Decided |
| Web client | React | Decided |
| Mobile client | React Native | Decided |
| Database | PostgreSQL + PostGIS | Decided |
| ORM / query layer | Drizzle | Decided |
| Job queue | BullMQ + Redis | Decided |
| Object storage | Amazon S3 | Decided |
| External integration pattern | Provider-agnostic adapters + mock implementations for dev/test | Decided |
| Payment provider | — | Not yet decided (mock adapter unblocks dev meanwhile) |
| Maps / geocoding provider | Mapbox | Decided |
| SMS / WhatsApp provider | — | Not yet decided (mock adapter unblocks dev meanwhile) |
| Deployment / hosting | AWS EC2 — single instance, self-managed Postgres + Redis | Decided |
| Testing frameworks (backend/web/mobile) | Vitest, Testcontainers, Playwright, Jest, RNTL, Maestro — see §11 | Decided |
| CI/CD pipeline | — | Not yet decided |

---

## 2. API server: Fastify

Chosen over Express for built-in JSON schema validation, which matters directly for this spec's insistence on server-trusted input everywhere: booking price recalculation (`BKG-02`), payment webhook validation (`PAY-02`), and access-scan payloads (`ACC-02`) all depend on rejecting malformed/untrusted input at the boundary rather than trusting the client.

---

## 3. Web: React / Mobile: React Native

Standard choice, no major debate. Lets business logic, validation, and API types be shared between the web surfaces (Driver Web, Property Manager Web Console, Admin Web Console) and the mobile surfaces (Driver App, Host App, Security Guard App).

---

## 4. Database: PostgreSQL + PostGIS

Postgres was the easy call — this system needs real ACID transactions and row-level locking for its hardest correctness requirements: atomic inventory holds (`BKG-01`), capacity-pool decrements that must never oversell (`INV-04`), and idempotent webhook processing (`PAY-02`).

**PostGIS is added on top** because nearly every core driver-facing flow is geo-driven:
- Destination-proximity search (`SRCH-03`)
- Map pin queries (`SRCH-04`)
- Distance as a ranking factor (`SRCH-06`)
- The geographic density dashboard that's supposed to tell the supply team where to acquire next (`ADM-07`, PRD §45)

Without PostGIS, all of the above turns into hand-rolled haversine math in application code or raw SQL — PostGIS gives proper spatial indexing (`GIST`) and functions (`ST_DWithin`, `ST_Distance`) instead.

---

## 5. ORM: Drizzle (not Prisma)

Prisma was the default assumption but got dropped for two reasons specific to this system:

1. **No native PostGIS/geometry type support.** Every geo query (the entire search and density-dashboard path) would need to drop to raw SQL anyway, defeating much of the point of an ORM for exactly the queries that matter most.
2. **Row-level locking friction.** Atomic capacity-pool holds want `SELECT ... FOR UPDATE` / advisory locks, which Prisma only supports awkwardly through raw SQL inside `$transaction`.

Drizzle is closer to a typed SQL query builder than a full ORM — it doesn't fight raw SQL, PostGIS types, or explicit locking, at the cost of slightly less "magic" on simple CRUD paths (users, vehicles, listing metadata, admin). That tradeoff favors Drizzle here because the hard 40% (search, booking concurrency, payout aggregation) is also the highest-stakes 40%.

---

## 6. Job queue: BullMQ + Redis

### Why Redis, knowingly accepting the tradeoff

Postgres-native queueing (`pg-boss`) was the initial recommendation because it allows atomic "write the record + schedule the job" in a single DB transaction — no dual-write risk. **We're deliberately going with Redis + BullMQ instead**, partly to gain hands-on Redis experience, and partly because Redis ends up earning its place in the stack for more than just the queue:

1. **BullMQ** — job broker
2. **Rate limiting** (`AUTH-04` — OTP attempt limits) — natural fit for Redis atomic increment + TTL
3. **Read-through cache** for hot search results, if/when search latency needs it (not needed at MVP)

### The tradeoff we're accepting, and how we're handling it

Because Postgres (business truth) and Redis (queue) are now two separate systems, "write the booking + schedule its no-show check" is no longer atomic. If the process crashes between the DB commit and the BullMQ `.add()` call, a job can be silently lost.

**Decision for MVP: accept the small risk window, backstop it with recurring sweep jobs.** We already need sweep jobs for other reasons (abandoned-hold cleanup, unknown-payment-state reconciliation — see job table below); extending that pattern to catch "booking past grace period with no recorded no-show outcome" costs little and closes the gap without extra infrastructure.

**Upgrade path if this ever bites us in practice: transactional outbox.** Write an `outbox` row in the same Postgres transaction as the business write; a poller reads unprocessed outbox rows and performs the actual `queue.add()`, marking them processed. Guarantees at-least-once delivery into BullMQ. Not built now — noted here so it's a known, deliberate deferral rather than a gap nobody decided on.

### Division of responsibility

- **Postgres** — source of truth for everything that's money or inventory (bookings, holds, payments ledger, audit log). Nothing about correctness depends on Redis staying up.
- **Redis** — disposable in principle. If it died and came back empty, no booking/payment data is lost — only in-flight scheduled jobs, which the sweep crons re-derive.
- **Every delayed job worker re-checks state in Postgres before acting** — a job firing doesn't mean the underlying row is still in the state the job assumed (the spec calls this out explicitly for no-show detection, `EXC-02`, and the auto-complete safety net, `ACC-05`). This rule applies to all jobs below, not just those two.

### Job inventory

| Job | Trigger type | Owning module | Spec ref |
|---|---|---|---|
| Hold expiry release | Delayed, per-hold (fires 5 min after hold created) | Booking Engine | `BKG-01` |
| No-show detection | Delayed, per-booking (fires at start_time + grace) | Exceptions | `EXC-02` |
| Overstay detection | Delayed, per-booking (fires at end_time + grace) | Exceptions | `EXC-03` |
| Auto-complete safety net | Delayed, per-booking (fires at max allowed duration) | Access Control | `ACC-05` |
| Arrival reminder notification | Delayed, per-booking (fires 30 min before start) | Notifications | PRD §54 |
| "Expiring soon" notification | Delayed, per-booking (fires 15 min before end) | Notifications | PRD §54 |
| Dispute SLA escalation | Delayed, per-dispute (fires at SLA deadline) | Disputes | `EXC-07` |
| Webhook post-processing | Event-driven, immediate (enqueued from webhook handler so the provider gets a fast 200) | Payment | `PAY-02` |
| Booking-confirmed notification | Event-driven, immediate | Notifications | `NOTIF-01` |
| Host settlement / payout batch | Recurring cron (daily) | Payment | `PAY-04` |
| Verification/document expiry downgrade sweep | Recurring cron (daily) | Listing & Inventory | `INV-02` |
| Abandoned-hold safety sweep | Recurring cron (backstop for missed hold-expiry enqueues) | Booking Engine | `BKG-01` edge case |
| No-show outcome safety sweep | Recurring cron (backstop for missed no-show enqueues) | Exceptions | `EXC-02` edge case |
| Unknown-payment-state reconciliation | Recurring cron (polls provider for stuck/unknown transactions) | Payment | `PAY-05` |
| Analytics/KPI rollup | Recurring cron (nightly) | Analytics | `ADM-06`, `ADM-07` |

Deliberately **not** jobs (cheaper as query-time checks, no side effects needed): property-authorization expiry (`PROP-02`), visitor-pass expiry (`PROP-04`) — both just filter on `expires_at` at read time.

---

## 7. Object storage: Amazon S3

Needed for everything that's a photo or document rather than structured data: listing photos (`INV-01`), verification evidence (`INV-02`), host KYC and ownership/authorization documents (`HOST-01`), society/property authorization documents (`PROP-02`), driver profile photo (`DRV-02`), vehicle condition photos, and dispute/safety-incident evidence (`EXC-07`, `TR-05`). Keeping these out of Postgres avoids DB/backup/replication bloat and unblocks a CDN path for the photos that need to load fast in search results and the map view.

**Shape of the decision, not just the provider:**

1. **Split by sensitivity, not one bucket.** Listing/profile photos are public-read and CDN-fronted (CloudFront) for fast search/map loading. KYC documents, ownership/authorization evidence, and dispute/incident evidence are private — presigned `GET` URLs only, access scoped by role. This maps directly onto the spec's retention/access-control requirement for identity/KYC data (`GATE-11`, spec §22).
2. **Uploads go client → S3 directly via presigned URLs**, not proxied through Fastify. Routing large photo/document uploads through the API server ties up request threads/memory for no benefit; the client uploads straight to S3 and reports back the object key.
3. **Lifecycle rules handle retention** for KYC/evidence buckets (auto-expire or transition to cold storage after the retention period), rather than a custom cleanup job.

---

## 8. External integration abstraction pattern

**Applies to every third-party service the app talks to: payment, SMS/WhatsApp, maps/geocoding, and later ANPR/IoT (`OS-06` already calls for a provider-neutral boundary there). This is a general rule, not a one-off for the two undecided providers below.**

Each integration category is defined as an internal interface the rest of the codebase codes against — booking logic calls `PaymentProvider.charge(...)`, auth logic calls `OtpProvider.send(...)` — never a vendor SDK directly. Which concrete implementation is wired up is a config choice (env var), not a code change in the modules that use it. This is what makes "swap Razorpay for Stripe later" or "integrate MSG91 once we pick one" a small, contained change instead of a rewrite, and it's also what makes the modular monolith actually testable in isolation.

### Dev/test mode: mock adapters, not real providers

Each category gets a `mock` implementation, selected via env var (e.g. `SMS_PROVIDER=mock`, `PAYMENT_PROVIDER=mock`), for local development, automated tests, and any environment without real vendor credentials.

- **OTP bypass.** The mock `OtpProvider` doesn't send anything — it accepts a fixed code (default `1234`) for verification, configurable via `DEV_OTP_BYPASS_CODE`. It logs the "sent" code instead of hitting a real gateway. `DRV-01`'s normal validation (expiry, attempt limits) still runs against the mock code, so the flow being tested is realistic except for actual delivery.
- **Payment bypass.** The mock `PaymentProvider` doesn't call a real gateway — it immediately resolves the requested outcome (success by default; configurable to simulate failure/pending for testing those paths) and internally triggers the same webhook-handling code path (`PAY-02`) that a real provider callback would. This matters: it means the hold → payment → `BKG-04` confirmation → ledger (`PAY-01`) flow is exercised end-to-end in dev/test, including the idempotency logic, rather than being skipped.
- **Maps/geocoding**, once we get to it below, gets the same treatment — a mock that returns fixed/seeded coordinates for known test addresses, so search/booking flows can be tested without a live API key or network call.

### Non-negotiable safety rule

Bypass mode must be **structurally impossible to enable in production**, not just off by default. The app should hard-refuse to boot with any `*_PROVIDER=mock` (or `DEV_OTP_BYPASS_CODE` set) if the environment is flagged as production — this can't be a "someone forgot to change the .env" risk given it's an OTP/payment bypass.

---

## 9. Maps / geocoding: Mapbox

The candidates considered were Google Maps Platform, Mapbox, and Mappls (MapmyIndia). On pure geocoding quality for informal, landmark-driven Indian destinations (`SRCH-01` — "BKC", "Phoenix Palladium", "near XYZ hospital" rather than formal addresses), Mappls is the stronger fit — it's purpose-built for that.

**Decision: Mapbox anyway**, because integration reliability is weighted higher than geocoding precision right now. Development is happening in agentic mode, and Mapbox's mature SDK, large community, and well-trodden RN integration path materially reduce the risk of an AI-agent-driven build getting stuck on sparse docs or unusual edge cases — which is a real cost, not a hypothetical one, for a less-mature ecosystem like Mappls.

This is a low-risk call specifically because it sits behind the provider-abstraction pattern (§8) — geocoding/search/map-display all go through an internal interface, not direct SDK calls from business logic. If landmark-search quality proves inadequate in practice once real usage data exists, swapping the underlying adapter to Mappls (or adding it as a secondary geocoder just for India-specific landmark queries) is a contained change, not a rewrite.

---

## 10. Hosting & deployment: AWS EC2 (single instance, for now)

**Decision:** a single EC2 instance runs the Fastify API, Postgres (+PostGIS), and Redis together, for the pilot/MVP stage. No RDS, no ElastiCache, no managed HA — this is a deliberate "don't pay for infrastructure the pilot doesn't need yet" call, consistent with the same reasoning that shaped the job-queue and provider-abstraction decisions: the PRD's whole thesis is that a single-micro-market pilot should be cheap to run and easy to kill, not over-built for scale it hasn't earned.

**What this implies, and what has to be true for it to be safe:**

1. **Single point of failure, accepted knowingly.** If the instance goes down, the whole stack goes down together. Acceptable for a pilot serving one neighborhood; not acceptable once the PRD §12 kill/continue gate is passed and the product moves toward Phase 2 — at that point, Postgres → RDS (with PostGIS support) and Redis → ElastiCache is the expected split, decoupling data durability from app-instance uptime.
2. **A reverse proxy terminates TLS in front of Fastify** (Nginx or Caddy) rather than Fastify handling TLS directly.
3. **Backups are not optional because there's no managed durability underneath.** At minimum: scheduled `pg_dump` (or `pg_basebackup`) to S3 on a cron, plus periodic EBS snapshots of the volume. This is infrastructure work, not an afterthought — see Nikhil's role in `.claude/skills/run-team/devops.md`.
4. **This is a stated upgrade path, not a permanent architecture.** Documented here so "when do we split this out" is a conscious trigger (sustained load, the pilot passing its validation gate) rather than something nobody decided.

### Network exposure: public during development, locked down before production

**Current phase (development):** Postgres and Redis are reachable directly over the internet via connection string — deliberately, so local/agentic dev environments can connect without an SSH tunnel or VPN in the loop. This is a conscious, temporary tradeoff for development convenience, not an oversight.

Baseline hygiene even during this phase, since open DB/cache ports get scanned by bots within minutes of going live regardless of how "temporary" the setup is:
- Strong, random passwords/auth on both Postgres and Redis (`requirepass`/ACL on Redis — never run it with no auth) — non-negotiable even in dev
- Prefer restricting the EC2 security group to known IPs (home/office, CI runner, agentic dev environment egress) over `0.0.0.0/0` where practical
- Enable TLS on the Postgres connection string where the client supports it

**Before production launch, this must change:** Postgres and Redis get moved behind the private/security-group-restricted setup originally planned — bound to localhost or a private interface, reachable only by the Fastify process (plus an SSH bastion/tunnel for admin access if needed). **This is a tracked pre-launch task, not an assumption** — see Nikhil's role (`.claude/skills/run-team/devops.md`) and the Engineering Gate in `planning/01-feature-modules-and-architecture.md` §5, which already requires PII/payment-data handling and retention rules to be signed off before build — the same discipline applies here: dev-convenience exposure has an explicit expiry, not an implicit one.

---

## 11. Testing strategy (backend / web / mobile)

The functional spec is explicit that this isn't optional polish — spec §24 requires happy-path, validation, authorization, **concurrency/idempotency**, and recovery tests per feature, and calls out specific scenarios by name: two simultaneous bookings against the same exclusive inventory, duplicate/out-of-order payment webhooks, and financial ledger reconciliation against a mocked provider settlement. The framework choices below are picked to make those scenarios actually testable, not just unit-testable in isolation.

| Layer | Tool | Why |
|---|---|---|
| Backend unit/service tests | **Vitest** | Fast, native TypeScript/ESM, good fit for testing services/repositories in isolation |
| Backend API/integration tests | **Fastify's built-in `.inject()`** + Vitest | Tests real route/schema/hook behavior without a running server or network hop |
| Backend concurrency/integration tests | **Testcontainers** (ephemeral real Postgres + Redis) | Row-locking and hold-expiry behavior (`BKG-01`, `INV-04`) can only be trusted against a real Postgres instance, not a mock — this is exactly where the spec's "two simultaneous users" test case has to run |
| Web unit/component tests | **Vitest + React Testing Library** | Same runner as backend where possible; RTL tests behavior, not implementation detail |
| Web E2E tests | **Playwright** | Cross-browser, strong TypeScript support, can drive Driver Web / Property Manager Console / Admin Console flows, and can double as an API-level testing tool against the same running stack |
| Mobile unit/component tests | **Jest + React Native Testing Library** | The standard, officially-supported RN test runner — RN's Metro bundler tooling assumes Jest, unlike the web side |
| Mobile E2E tests | **Maestro** (primary) | Simple YAML-defined flows, no fragile native build configuration to maintain — same "minimize integration hiccups for agentic development" reasoning that drove the Mapbox call. **Detox** is the more powerful, deeper-native-control alternative, worth revisiting if Maestro's black-box approach proves insufficient, but it demands much more Xcode/Gradle wiring to keep working. |

### E2E environment shape

A full E2E run needs the real stack up, not mocks of the app itself — but it should still use the **mock payment/SMS/OTP adapters** from §8, so E2E tests don't depend on live vendor sandbox accounts. Concretely: Docker Compose spins up Postgres+PostGIS, Redis, and the Fastify API (configured with `PAYMENT_PROVIDER=mock`, `SMS_PROVIDER=mock`) as one environment; Playwright drives the web surfaces and Maestro drives the mobile surfaces against it. This is also the natural environment for the concurrency/idempotency test cases the spec calls out by name, since those need real Postgres locking and a real (if mocked) webhook round-trip, not a unit-test double.

CI/CD pipeline tooling (GitHub Actions, etc.) is still open — see below — but whichever tool is picked just needs to run this same Docker Compose environment, not a different one.

---

## 12. Open decisions (explicitly deferred, not forgotten)

- Payment provider (India-focused; affects `PAY-01`–`PAY-05` webhook contract)
- SMS/WhatsApp provider (affects `NOTIF-02`)
- CI/CD pipeline tool (needs to run the Docker Compose E2E environment from §11)

These are noted in `planning/03-sprint-plan.md` as needing resolution before Sprint 4 (payments) and Sprint 7 (notifications) respectively — not blocking earlier sprints.
