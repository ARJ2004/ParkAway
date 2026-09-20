# ParkAway — Sprint Plan

**Assumption:** 2-week sprints. Adjust cadence as the team is staffed; the sequencing/dependency order matters more than the exact calendar.
**Source of task IDs:** `02-kanban-board.md` (same codes trace back to the functional spec).
**Principle applied:** build the core booking loop (search → hold → pay → access → complete) before anything else. Ratings, richer notifications and reliability scoring follow once real sessions exist to score. Monthly/recurring, events and B2B stay out of scope until the MVP pilot proves density and reliability (PRD §12 kill/continue criteria).

---

## Sprint 0 — Foundation & Engineering Gate

**Goal:** Nothing is buildable correctly until these decisions exist in writing and the base project skeleton is up. This sprint produces documents/decisions and scaffolding, not customer-facing features.

- [ ] GATE-01 → GATE-14 — all Engineering Gate sign-offs (see `02-kanban-board.md`, "To Do" column)
- [ ] Project scaffolding for the four client surfaces (Driver app, Host app, Property/Admin web, Security app) and the core backend module structure (modular monolith)
- [ ] Environment setup: staging environment, CI skeleton, secrets/config management approach
- [ ] Define the audit/event log schema (actor, timestamp, source, reason, before/after) since almost every later module depends on it
- [ ] Define the idempotency approach for the API layer (used by booking hold, payments, webhooks, payouts)
- [ ] Confirm the single MVP micro-market and initial supply type (per PRD §10 — pick exactly one neighborhood)

**Exit criteria:** Engineering Gate fully checked off; a developer can create a user, hit a protected endpoint, and see an audit record.

---

## Sprint 1 — Identity, Profiles & Admin Foundation

**Goal:** Every later module needs a logged-in driver, host, property manager, security staff member, or admin. Get accounts and roles working end-to-end first.

- [ ] AUTH-01 — Mobile OTP registration/login
- [ ] AUTH-02 — Session/token issuance, logout/refresh invalidation
- [ ] AUTH-03 — Admin authentication + RBAC roles
- [ ] AUTH-04 — Rate limiting & abuse prevention for OTP endpoints
- [ ] DRV-02 — Driver profile management
- [ ] DRV-03 — Vehicle registration
- [ ] DRV-04 — Location permission handling
- [ ] ADM-02 — User management (search, suspend/restore, PII masking) — minimal version to support later moderation needs

**Exit criteria:** A driver can register via OTP, complete a profile, and add a vehicle. An admin can log in with RBAC and look up a user.

---

## Sprint 2 — Property & Listing Foundation

**Goal:** Get real, authorized, verifiable supply into the system. Nothing can be searched or booked until this exists.

- [ ] PROP-01 — Property creation
- [ ] PROP-02 — Society/property authorization + revocation propagation
- [ ] PROP-05 — Property access policy
- [ ] HOST-01 — Host onboarding (identity, ownership evidence, bank/KYC)
- [ ] INV-01 — Parking space creation
- [ ] INV-02 — Listing verification levels + badges
- [ ] INV-06 — Listing lifecycle (draft/pending/published/paused/suspended/archived)
- [ ] HOST-03 — Host pricing management (hourly/daily; peak/weekend rules)
- [ ] ADM-03 — Listing moderation queue

**Exit criteria:** A host can onboard, create a property-linked listing with photos/pricing, and an admin can verify/publish it.

---

## Sprint 3 — Availability, Search & Discovery

**Goal:** A driver can find real, currently-bookable inventory near a destination.

- [ ] INV-03 — Availability schedule engine (recurring rules, overrides, blackout, precedence)
- [ ] INV-04 — Capacity pool inventory (atomic reservation, no oversell)
- [ ] INV-05 — Temporary block / maintenance windows with booking-impact preview
- [ ] HOST-04 — Host availability management calendar
- [ ] SRCH-01 — Destination search / geocoding
- [ ] SRCH-02 — Date/time/duration selection
- [ ] SRCH-03 — Available inventory search (atomic, live)
- [ ] SRCH-04 — Map display
- [ ] SRCH-07 — Parking detail page
- [ ] SRCH-08 — Navigation handoff

**Exit criteria:** A driver can search a destination + time window and see real, currently-available, verified listings on a map and in detail.

---

## Sprint 4 — Booking, Pricing & Payment Core

**Goal:** This is the transaction spine of the whole marketplace — get it right before layering access/ops on top.

- [ ] BKG-01 — Inventory hold (atomic, short-lived, auto-expiry)
- [ ] BKG-02 — Server-side price calculation + snapshot
- [ ] BKG-03 — Payment initiation (idempotency key, server-trusted amount)
- [ ] PAY-01 — Payment ledger (immutable, append-only)
- [ ] PAY-02 — Webhook handling (signature validation, idempotent, out-of-order safe)
- [ ] BKG-04 — Payment confirmation → booking creation (transactional)
- [ ] BKG-05 — Booking confirmation page
- [ ] BKG-06 — Booking history
- [ ] PAY-05 — Failed payment recovery

**Exit criteria:** A driver can hold a space, pay exactly once (verified under concurrent/duplicate-attempt tests), and land on a confirmation page with a stable booking ID.

**Note:** this sprint should include the concurrency test named explicitly in the spec — two simultaneous users attempting to reserve the same exclusive inventory — before being called done.

---

## Sprint 5 — Access Control & On-Site Operations

**Goal:** Make the "guaranteed booking" promise real at the physical gate. This is what separates ParkAway from a listings site.

- [ ] ACC-01 — QR/booking credential generation
- [ ] ACC-02 — Security scan & validation (admit/reject + reason code)
- [ ] ACC-03 — Vehicle verification
- [ ] ACC-04 — Check-in (CONFIRMED → CHECKED_IN)
- [ ] ACC-05 — Check-out / session completion + auto-complete safety job
- [ ] ACC-06 — Access instructions (versioned, eligibility-gated)
- [ ] SEC-01 — Security dashboard
- [ ] SEC-02 — Manual admit override (reason + audit)
- [ ] SEC-03 — Occupancy update

**Exit criteria:** Security staff can scan a QR, admit/reject with a reason, check a driver in, and check them out — with every step audited.

---

## Sprint 6 — Exceptions, Disputes, Fraud & Settlement

**Goal:** Handle everything that goes wrong: no-shows, overstays, owner cancellations, disputes, fraud, and get hosts paid.

- [ ] EXC-01 — Driver cancellation against policy snapshot
- [ ] EXC-02 — No-show detection
- [ ] EXC-03 — Overstay detection + incremental charge/penalty
- [ ] EXC-04 — Owner cancellation + customer protection
- [ ] EXC-05 — Parking-unavailable-on-arrival incident flow
- [ ] EXC-06 — Wrong space/location classification
- [ ] EXC-07 — Dispute case management
- [ ] PAY-03 — Refund calculation from price snapshot + policy
- [ ] PAY-04 — Host settlement / payout batches
- [ ] TR-04 — Fraud/abuse controls
- [ ] TR-05 — Safety incident reporting
- [ ] HOST-05 — Host booking management dashboard
- [ ] HOST-06 — Host earnings & payouts view
- [ ] SEC-04 — Incident escalation

**Exit criteria:** Every failure mode in the booking lifecycle (cancel, no-show, overstay, owner cancel, wrong space, dispute) has a defined resolution path with a financial outcome, and hosts can see what they've earned and been paid.

---

## Sprint 7 — Admin Operations, Notifications & Analytics (MVP hardening)

**Goal:** Give the platform team the tools to run the marketplace day-to-day and measure whether it's working.

- [ ] NOTIF-01 — Booking lifecycle notifications
- [ ] NOTIF-02 — Channel abstraction (push/SMS/WhatsApp/email)
- [ ] NOTIF-03 — Notification/webhook deduplication
- [ ] ADM-04 — Booking operations console (full timeline)
- [ ] ADM-05 — Refund and adjustment console
- [ ] ADM-08 — Configuration management (versioned policy)
- [ ] ADM-06 — Marketplace analytics dashboard
- [ ] ADM-07 — Geographic density dashboard
- [ ] ANLY-01 — North Star + secondary metric instrumentation

**Exit criteria: MVP is feature-complete.** A driver can discover, book, pay, enter, park, exit; every exception path is handled; admin can operate and measure the marketplace. This is the point to run the PRD's "100 spaces / 500 searches / 30-day" pilot validation in the chosen micro-market.

---

## Sprint 8 — Post-MVP Polish (P1 fast-follow)

**Goal:** Only pull from here once Sprint 7's exit criteria are met and the pilot is live. These improve trust and conversion but don't block launch.

- [ ] SRCH-05 — Search filters
- [ ] SRCH-06 — Sort/ranking by reliability
- [ ] TR-01 — Driver rating of space/host
- [ ] TR-02 — Host rating of driver
- [ ] TR-03 — Trust/reliability score
- [ ] HOST-02 — Manage listing content + re-verification triggers
- [ ] ANLY-02 — No-result / failed-search capture

**Exit criteria:** Ranking reflects real reliability data; ratings are flowing; supply-gap data (from failed searches) is feeding the density dashboard.

---

## Sprint 9+ — Phase 2 (gated by pilot results)

**Do not schedule these sprints until the PRD §12 kill/continue criteria are met:** ~100 spaces, 500+ searches, 100+ bookings, 30%+ repeat rate, ₹50k–₹1L+ GMV, <5% owner cancellations, <5–10% failed sessions, in the chosen micro-market.

**Sprint 9 — Monthly & Recurring Parking**
- [ ] REC-01 — Monthly parking plan
- [ ] REC-02 — Recurring commuter schedule
- [ ] REC-04 — Resident shared-time parking

**Sprint 10 — Corporate & Event Parking**
- [ ] REC-03 — Corporate employee parking
- [ ] EVT-01 — Event creation
- [ ] EVT-02 — Event inventory reservation
- [ ] EVT-03 — Event parking pass
- [ ] EVT-04 — Event closure/rebooking workflow

**Sprint 11+ — Parking OS / B2B (Phase 3)**
- [ ] OS-01 — Property inventory dashboard
- [ ] OS-02 — Tenant/employee permits
- [ ] OS-03 — Visitor management (full B2B version)
- [ ] OS-04 — Occupancy analytics
- [ ] OS-05 — Marketplace exposure toggle + kill switch
- [ ] OS-06 — Access hardware integration boundary (ANPR/IoT — P3)
- [ ] OS-07 — Property-level billing (P3)

---

## Sprint-to-module dependency map

```
Sprint 0  Foundation/Gate
   │
Sprint 1  Identity & Profiles ───────────────┐
   │                                          │
Sprint 2  Property & Listing                  │
   │                                          │
Sprint 3  Availability & Search ◄─────────────┘
   │
Sprint 4  Booking & Payment core
   │
Sprint 5  Access control (gate reality)
   │
Sprint 6  Exceptions / Disputes / Fraud / Settlement
   │
Sprint 7  Admin ops / Notifications / Analytics  ──► MVP DONE, run pilot
   │
Sprint 8  P1 polish (ratings, ranking, filters)
   │
   ▼ (gated by pilot kill/continue decision)
Sprint 9+  Monthly/Recurring → Corporate/Events → Parking OS/B2B
```

## Assumptions & risks to revisit each sprint

- Team size/composition isn't fixed yet — sprint numbers assume roughly parallel work across 1 backend + 1-2 client surfaces per sprint; adjust scope down if staffing is thinner.
- Payment provider, maps provider and SMS/WhatsApp provider need to be selected before Sprint 4 and Sprint 7 respectively — not blocking Sprint 0-3 but should be decided in parallel.
- Sprint 7's exit gate (the pilot) is a business decision point, not just an engineering one — see PRD §12 and §79. Engineering should not silently continue into Phase 2 without that explicit go/kill call.
