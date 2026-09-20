# ParkAway — Kanban Board

**Status:** Planning stage — this is the initial board load. Nothing has started.
**How to use this board:** treat each `[MODULE-##]` line as a card. Move cards left→right as work progresses. Task IDs match the spec codes used in `01-feature-modules-and-architecture.md` and the functional spec, so a card can always be traced back to its original requirement (e.g. `BKG-01` = spec section 8, "Inventory hold").

Columns: **Backlog → To Do (sprint-ready) → In Progress → In Review → Done**

---

## To Do (Sprint 0 — Engineering Gate)

Nothing else should move to "In Progress" until these are signed off (see `01-feature-modules-and-architecture.md`, §5).

- [ ] GATE-01 — Approve exact booking state machine
- [ ] GATE-02 — Approve exact payment state machine
- [ ] GATE-03 — Approve inventory locking/concurrency strategy
- [ ] GATE-04 — Approve cancellation/refund matrix
- [ ] GATE-05 — Approve host payout/settlement policy
- [ ] GATE-06 — Approve property authorization rules
- [ ] GATE-07 — Approve access failure fallback procedure
- [ ] GATE-08 — Approve no-show/overstay rules
- [ ] GATE-09 — Approve dispute evidence & SLA rules
- [ ] GATE-10 — Approve admin override permission model
- [ ] GATE-11 — Approve PII/KYC/payment data handling & retention policy
- [ ] GATE-12 — Fix MVP geography and supply type (single micro-market)
- [ ] GATE-13 — Fix MVP parking types and vehicle categories
- [ ] GATE-14 — Fix success metrics (successful sessions, failed sessions, repeat rate, utilization, GMV, contribution margin)

---

## Backlog — In Progress — In Review — Done

These columns are currently empty (no engineering work has started). The cards below are the **full MVP + fast-follow backlog**, grouped by module, ready to be pulled into sprints per `03-sprint-plan.md`.

---

### Module: Identity & Access Management (P0)
- [ ] AUTH-01 — Mobile OTP registration/login (`DRV-01`)
- [ ] AUTH-02 — Session/token issuance, logout/refresh invalidation
- [ ] AUTH-03 — Admin authentication + RBAC roles (`ADM-01`)
- [ ] AUTH-04 — Rate limiting & abuse prevention for OTP endpoints

### Module: Driver Profile & Vehicle Management (P0)
- [ ] DRV-02 — Driver profile management (name, email, photo, preferences)
- [ ] DRV-03 — Vehicle registration (multi-vehicle, default vehicle, type/dimensions)
- [ ] DRV-04 — Location permission handling (GPS-optional search)

### Module: Search & Discovery (P0 core / P1 ranking)
- [ ] SRCH-01 — Destination search / geocoding + recent searches
- [ ] SRCH-02 — Date/time/duration selection with time-aware query
- [ ] SRCH-03 — Available inventory search (atomic, never shows held/confirmed as free)
- [ ] SRCH-04 — Map display with verified pins + clustering
- [ ] SRCH-07 — Parking detail page (location, space info, access, price breakdown, badges)
- [ ] SRCH-08 — Navigation handoff to external maps
- [ ] SRCH-05 — Search filters (price, distance, covered, EV, CCTV, 24×7, vehicle type) — P1
- [ ] SRCH-06 — Sort/ranking by reliability + distance + price — P1

### Module: Listing & Inventory Management (P0)
- [ ] INV-01 — Parking space creation (location, dimensions, photos, access, pricing)
- [ ] INV-02 — Listing verification levels + badges
- [ ] INV-03 — Availability schedule engine (recurring rules, overrides, blackout, precedence)
- [ ] INV-04 — Capacity pool inventory (atomic reservation, no oversell)
- [ ] INV-05 — Temporary block / maintenance windows with booking-impact preview
- [ ] INV-06 — Listing lifecycle (draft/pending/published/paused/suspended/archived)
- [ ] HOST-02 — Manage listing content + material-change re-verification
- [ ] HOST-03 — Host pricing management (hourly/daily/monthly, peak/weekend, versioned)
- [ ] HOST-04 — Host availability management calendar

### Module: Property & Society Management (P0)
- [ ] PROP-01 — Property creation (address, coords, access hours, outsider policy)
- [ ] PROP-02 — Society/property authorization + revocation propagation
- [ ] PROP-03 — Resident parking allocation (exclusive slot mapping)
- [ ] PROP-04 — Visitor parking (request, security validation, auto-expiry)
- [ ] PROP-05 — Property access policy (gate hours, access methods, emergency override)

### Module: Host Onboarding & Earnings (P0)
- [ ] HOST-01 — Host onboarding (identity, ownership evidence, bank/KYC)
- [ ] HOST-05 — Host booking management dashboard (tenant-scoped)
- [ ] HOST-06 — Host earnings & payouts view (ledger-backed)

### Module: Booking & Reservation Engine (P0)
- [ ] BKG-01 — Inventory hold (atomic, short-lived, auto-expiry)
- [ ] BKG-02 — Server-side price calculation + snapshot
- [ ] BKG-04 — Payment confirmation → booking creation (transactional)
- [ ] BKG-05 — Booking confirmation page (single source of truth)
- [ ] BKG-06 — Booking history (auth-scoped, paginated)
- [ ] BKG-07 — Guaranteed booking commitment + failure classification

### Module: Payment & Settlement (P0)
- [ ] BKG-03 — Payment initiation (idempotency key, server-trusted amount)
- [ ] PAY-01 — Payment ledger (immutable, append-only)
- [ ] PAY-02 — Webhook handling (signature validation, idempotent, out-of-order safe)
- [ ] PAY-03 — Refund calculation from price snapshot + policy
- [ ] PAY-04 — Host settlement / payout batches
- [ ] PAY-05 — Failed payment recovery (no duplicate charges)

### Module: Access Control & Check-in/out (P0)
- [ ] ACC-01 — QR/booking credential generation (tamper-resistant)
- [ ] ACC-02 — Security scan & validation (admit/reject + reason code)
- [ ] ACC-03 — Vehicle verification (plate matching, normalization)
- [ ] ACC-04 — Check-in (CONFIRMED → CHECKED_IN)
- [ ] ACC-05 — Check-out / session completion + auto-complete safety job
- [ ] ACC-06 — Access instructions (versioned, eligibility-gated)

### Module: Cancellation, No-show, Overstay & Disputes (P0)
- [ ] EXC-01 — Driver cancellation against policy snapshot
- [ ] EXC-02 — No-show detection (grace period, idempotent job)
- [ ] EXC-03 — Overstay detection + incremental charge/penalty
- [ ] EXC-04 — Owner cancellation + customer protection + reliability impact
- [ ] EXC-05 — Parking-unavailable-on-arrival incident flow
- [ ] EXC-06 — Wrong space/location classification
- [ ] EXC-07 — Dispute case management (SLA, resolution, financial adjustment)

### Module: Ratings, Trust & Fraud (P0 fraud / P1 ratings)
- [ ] TR-04 — Fraud/abuse controls (velocity limits, duplicate identity, explainable blocks)
- [ ] TR-05 — Safety incident reporting (evidence, SLA, append-only)
- [ ] TR-01 — Driver rating of space/host — P1
- [ ] TR-02 — Host rating of driver — P1
- [ ] TR-03 — Trust/reliability score (confidence-sample-aware) — P1

### Module: Security Staff Operations (P0)
- [ ] SEC-01 — Security dashboard (arrivals, active sessions, plate/booking search)
- [ ] SEC-02 — Manual admit override (reason + audit)
- [ ] SEC-03 — Occupancy update (manual, conflict-alerting)
- [ ] SEC-04 — Incident escalation (severity-based SLA)

### Module: Notifications & Communication (P0)
- [ ] NOTIF-01 — Booking lifecycle notifications (confirmed/reminder/arrival/expiring/overstay)
- [ ] NOTIF-02 — Channel abstraction (push/SMS/WhatsApp/email)
- [ ] NOTIF-03 — Notification/webhook deduplication

### Module: Admin Console & Platform Operations (P0)
- [ ] ADM-02 — User management (search, suspend/restore, PII masking)
- [ ] ADM-03 — Listing moderation queue
- [ ] ADM-04 — Booking operations (full timeline, append-only adjustments)
- [ ] ADM-05 — Refund and adjustment console
- [ ] ADM-08 — Configuration management (versioned, future-effective, rollback)

### Module: Analytics & Reporting (P0)
- [ ] ADM-06 — Marketplace analytics dashboard (GMV, success rate, cancellations, repeat rate)
- [ ] ADM-07 — Geographic density dashboard (search vs. supply vs. bookings by zone)
- [ ] ANLY-01 — North Star + secondary metric instrumentation (successful sessions, 300m reliability rate)
- [ ] ANLY-02 — No-result / failed-search capture — P1

---

### Phase 2 backlog (do not pull into sprints until MVP density/reliability targets are hit)

**Module: Monthly, Recurring & Corporate Parking (P2)**
- [ ] REC-01 — Monthly parking plan (independent contract lifecycle)
- [ ] REC-02 — Recurring commuter schedule (weekday/time-window)
- [ ] REC-03 — Corporate employee parking (permits, quotas, billing)
- [ ] REC-04 — Resident shared-time parking (time-sliced allocation)

**Module: Event Parking (P2)**
- [ ] EVT-01 — Event creation
- [ ] EVT-02 — Event inventory reservation
- [ ] EVT-03 — Event parking pass
- [ ] EVT-04 — Event closure/rebooking workflow

**Module: Parking OS / B2B (P2/P3)**
- [ ] OS-01 — Property inventory dashboard
- [ ] OS-02 — Tenant/employee permits
- [ ] OS-03 — Visitor management (full B2B version)
- [ ] OS-04 — Occupancy analytics
- [ ] OS-05 — Marketplace exposure toggle + kill switch
- [ ] OS-06 — Access hardware integration boundary (P3)
- [ ] OS-07 — Property-level billing (P3)

---

## Board maintenance notes

- New cards should always carry a module tag and a spec code (or `NEW-##` if it has no spec precedent) so traceability is never lost.
- A card only moves to **Done** when its acceptance criteria from the functional spec are met, not just when code merges — see spec §24 (QA/acceptance/observability) for the test types expected per module (concurrency, idempotency, authorization, recovery).
- Phase 2/3 cards stay in Backlog and are explicitly excluded from sprint planning until the kill/continue criteria in the PRD (§12) are met in the pilot micro-market.
