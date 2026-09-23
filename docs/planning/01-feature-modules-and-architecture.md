# ParkAway — Feature Modules & High-Level Architecture

**Source documents:** `ParkAway_Business_Analysis_and_PRD.md`, `ParkAway_Functional_Business_Logic_Specification_v2_Prioritized.docx`
**Status:** Planning stage — pre-engineering
**Scope note:** Priorities below (P0/P1/P2/P3) are carried over from the prioritized functional spec. P0 = MVP-blocking, P1 = MVP-quality/fast-follow, P2 = validated extension (monthly/recurring, corporate, events), P3 = future/strategic (ANPR, IoT, dynamic pricing, full Parking OS).

---

## 1. How to read this document

Each module lists:
- **What it owns** — the business capability and the spec items it covers (spec codes in brackets, e.g. `BKG-01`)
- **Accessibility** — which client surfaces expose this module and to whom
- **Priority / phase** — when it should be built

Client surfaces referenced throughout:

| Surface | Used by | Notes |
|---|---|---|
| **Driver Mobile App** | Drivers | Primary demand-side app (iOS/Android) |
| **Driver Web** | Drivers | Lightweight web fallback for search/booking (esp. for concierge-MVP-style acquisition, WhatsApp/landing-page flows) |
| **Host/Owner persona** | Individual hosts, business hosts | **Not a separate app** (decided 2026-09-23). Owners log in through the same phone+OTP flow as drivers and pick a persona; the owner persona is a distinct mode inside the Driver Mobile App and Driver Web, with its own theme, navigation and screens. Listing + earnings management. See `05-sprint-2-detailed-plan.md` Ticket Group D. |
| **Property Manager Web Console** | Property managers, society admins, corporate admins | Desktop-oriented; inventory, permits, visitors, billing. **Folded into `apps/driver-web`'s codebase as its own route tree (`/manage/*`), not a separate `apps/property-web` app** (revised 2026-09-23, superseding locked decision O-10 in `05-sprint-2-detailed-plan.md` — the user's explicit direction during implementation). It keeps its own login entry point (`/manage/login`, same phone+OTP identity system, redirects straight to the property list rather than the driver/owner persona picker) and its own theme (reuses `admin`), so it still reads as a distinct surface to the person using it — the change is deployment/routing, not design. |
| **Security Guard App** | On-site security staff | Mobile/tablet, must tolerate poor connectivity |
| **Admin Web Console** | Platform admin/ops team | Internal only, RBAC-gated |
| **Public Web (marketing/landing)** | Prospective drivers/hosts | Acquisition surface, esp. for concierge MVP validation phase |

---

## 2. Feature Modules

### 2.1 Identity & Access Management (Auth) — P0, MVP

**What it owns**
- Mobile OTP registration/login, session/token issuance, logout/session invalidation (`DRV-01`)
- Admin authentication with RBAC, least-privilege roles, optional MFA (`ADM-01`)
- Role model spanning Driver, Individual Host, Business Host, Property Manager, Parking Operator, Security Staff, Platform Admin
- Rate limiting / abuse prevention for OTP and auth endpoints

**Accessibility**
- Driver Mobile App, Driver Web — OTP login
- Host/Owner App — OTP login (host role)
- Property Manager Web Console — OTP or credential login
- Security Guard App — staff login, property-scoped
- Admin Web Console — privileged login, RBAC + MFA

---

### 2.2 Driver Profile & Vehicle Management — P0, MVP

**What it owns**
- Profile fields: name, email, photo, communication preferences (`DRV-02`)
- Vehicle registration: multiple vehicles, default vehicle, type/dimensions/size category (`DRV-03`)
- Location permission handling — destination search must work without GPS (`DRV-04`)

**Accessibility**
- Driver Mobile App, Driver Web

---

### 2.3 Search & Discovery — P0 (core), P1 (ranking/filters polish), MVP

**What it owns**
- Destination search / geocoding with recent-search memory (`SRCH-01`)
- Date/time/duration selection, time-aware querying (`SRCH-02`)
- Inventory search against live availability (never shows held/confirmed slots as available) (`SRCH-03`)
- Map display with verified pin coordinates and clustering (`SRCH-04`)
- Filters: price, distance, covered, EV, CCTV, 24×7, vehicle type, instant booking, verified, hourly/daily/monthly (`SRCH-05`) — **P1**
- Ranking/sort: distance, availability certainty, price, reliability, verification, cancellation history (`SRCH-06`) — **P1**
- Parking detail page: location, space info, access, pricing breakdown, rules, photos, verification badges, cancellation policy (`SRCH-07`)
- Navigation handoff to external maps using verified entry coordinates (`SRCH-08`)

**Accessibility**
- Driver Mobile App (primary), Driver Web (search + detail page, booking handoff)

---

### 2.4 Listing & Inventory Management (Host-side) — P0, MVP

**What it owns**
- Parking space creation: address, exact location, space number, dimensions, vehicle compatibility, covered state, photos, access method, rules, pricing (`INV-01`)
- Listing verification levels: phone/basic → location/photos → property authorization → physical verification, with badges (`INV-02`)
- Availability schedule engine: recurring rules, date overrides, blackout periods, maintenance blocks, precedence resolution (`INV-03`)
- Capacity pool inventory for interchangeable spaces with atomic reservation (never oversell) (`INV-04`)
- Temporary block / maintenance windows with impact preview on existing bookings (`INV-05`)
- Listing lifecycle: draft → pending verification → published → paused/suspended → archived (`INV-06`)
- Host listing content management, material-change re-verification triggers (`HOST-02`)
- Host pricing management: hourly/daily/monthly + peak/weekend/event rules, versioned (`HOST-03`)
- Host availability management calendar (`HOST-04`)

**Accessibility**
- Host/Owner App — create/edit listings, pricing, availability, photos
- Property Manager Web Console — bulk/managed-property listing oversight
- Admin Web Console — moderation view into listing verification state

---

### 2.5 Property & Society Management — P0, MVP

**What it owns**
- Property creation: address, coordinates, access hours, outsider policy, security contacts (`PROP-01`)
- Society/property authorization: approvals, permitted parking types, outsider policy, expiry/revocation propagation (`PROP-02`)
- Resident parking allocation: exclusive slot-to-resident mapping, no double-allocation (`PROP-03`)
- Visitor parking: pass request, security validation at gate, auto-expiry (`PROP-04`)
- Property access policy: gate hours, access methods, escort rules, emergency overrides, versioning (`PROP-05`)

**Accessibility**
- Property Manager Web Console — full property/authorization/allocation management
- Security Guard App — visitor pass validation, access policy read
- Admin Web Console — authorization audit, revocation oversight

---

### 2.6 Host Onboarding & Earnings — P0, MVP

**What it owns**
- Host onboarding: identity, location, ownership/authorization evidence, bank/payout details, KYC, individual vs business flow (`HOST-01`)
- Host booking management dashboard: confirmed/pending/active/completed/cancelled/disputed, tenant-scoped (`HOST-05`)
- Host earnings & payouts: gross, fees, refunds, adjustments, net, payout status, ledger-backed (`HOST-06`)

**Accessibility**
- Host/Owner App — onboarding flow, bookings dashboard, earnings
- Admin Web Console — KYC review, payout exception handling

---

### 2.7 Booking & Reservation Engine — P0, MVP (core transaction module)

**What it owns**
- Inventory hold: short atomic hold (e.g. 5 min) tied to user/session, auto-expiry releases inventory (`BKG-01`)
- Price calculation: deterministic server-side computation, price snapshot stored on booking, no client-trusted totals (`BKG-02`)
- Booking state machine: `AVAILABLE → HELD → CONFIRMED → CHECKED_IN → COMPLETED`, plus `CANCELLED / EXPIRED / NO_SHOW / OWNER_CANCELLED / DISPUTED / REFUNDED` (`BKG-04`, PRD §22)
- Booking confirmation page as single source of truth post-payment (`BKG-05`)
- Booking history with authorization-scoped access (`BKG-06`)
- Guaranteed booking commitment definition and guarantee-failure classification (`BKG-07`)

**Accessibility**
- Driver Mobile App / Driver Web — hold → checkout → confirmation → history
- Host/Owner App, Property Manager Web Console — read-only booking visibility for their inventory
- Admin Web Console — full booking timeline and override tools

---

### 2.8 Payment & Settlement — P0, MVP

**What it owns**
- Payment initiation with provider idempotency key, server-trusted amount (`BKG-03`)
- Payment ledger: immutable, append-only line items per booking (parking, platform fee, customer fee, tax, discount, refund, adjustment, payout) (`PAY-01`)
- Webhook handling: signature validation, idempotent processing, out-of-order protection (`PAY-02`)
- Refund calculation from price snapshot + cancellation/dispute policy (`PAY-03`)
- Host settlement: post-completion payout batches, chargeback/dispute holdback (`PAY-04`)
- Failed payment recovery without duplicate charges (`PAY-05`)

**Accessibility**
- Driver Mobile App / Driver Web — payment initiation, receipts
- Host/Owner App — earnings/payout status (read)
- Admin Web Console — refund/adjustment console, ledger reconciliation

---

### 2.9 Access Control & Check-in/out — P0, MVP

**What it owns**
- QR/booking credential generation: tamper-resistant, booking-window-scoped (`ACC-01`)
- Security scan & validation: admit/reject with reason code, server-authoritative (`ACC-02`)
- Vehicle verification: plate matching, normalization, controlled mismatch exceptions (`ACC-03`)
- Check-in: `CONFIRMED → CHECKED_IN`, timestamp/actor/location capture (`ACC-04`)
- Check-out / session completion, grace-period handling, auto-complete safety job (`ACC-05`)
- Access instructions: gate/floor/lift/PIN, versioned, visible only to eligible confirmed drivers (`ACC-06`)
- Access hardware integration boundary — provider-neutral event interface for future ANPR/RFID/barriers (`OS-06`) — **P3**

**Accessibility**
- Driver Mobile App — display credential, access instructions, navigation handoff
- Security Guard App — scan, admit/reject, manual override, occupancy update
- Admin Web Console — override audit, access exception review

---

### 2.10 Cancellation, No-show, Overstay & Disputes — P0, MVP

**What it owns**
- Driver cancellation against policy snapshot at booking time (`EXC-01`)
- No-show detection: grace period, idempotent job, manual override (`EXC-02`)
- Overstay detection: grace + incremental charge/penalty, capped/escalated (`EXC-03`)
- Owner cancellation: customer-protection trigger, reliability-score impact, distinct from driver cancellation (`EXC-04`)
- Parking-unavailable-on-arrival incident flow with alternate-inventory attempt before refund (`EXC-05`)
- Wrong space/location classification and evidence comparison (`EXC-06`)
- Dispute case management: category, claimant/respondent, evidence, SLA, resolution, financial adjustment (`EXC-07`)

**Accessibility**
- Driver Mobile App — cancel, report issue, view dispute status
- Host/Owner App — owner cancellation flow, dispute response
- Security Guard App — incident escalation entry point
- Admin Web Console — dispute queue, resolution, financial adjustment authority

---

### 2.11 Ratings, Trust & Fraud — P0 (fraud controls), P1 (ratings, reliability score), MVP

**What it owns**
- Driver rating of location/access/safety/cleanliness/experience post-session (`TR-01`) — **P1**
- Host rating of driver behavior/compliance/no-show/overstay/damage (`TR-02`) — **P1**
- Trust/reliability score derived from operational history, confidence-sample-aware (`TR-03`) — **P1**
- Fraud/abuse controls: velocity limits, duplicate identity checks, suspicious-refund detection, explainable reason codes (`TR-04`) — **P0**
- Safety incident reporting: theft/damage/access/safety, evidence, SLA, append-only history (`TR-05`) — **P0**

**Accessibility**
- Driver Mobile App — rate host/space, report safety incident
- Host/Owner App — rate driver
- Security Guard App — safety incident capture
- Admin Web Console — fraud review queue, incident management, score administration

---

### 2.12 Security Staff Operations — P0, MVP

**What it owns**
- Security dashboard: today's bookings, expected arrivals, active sessions, visitor passes, plate/booking search (`SEC-01`)
- Manual admit override with reason, optional supervisor approval, full audit (`SEC-02`)
- Occupancy update: manual occupied/vacant marking, conflict alerts rather than silent cancellation (`SEC-03`)
- Incident escalation: gate issue, blocked space, unauthorized vehicle, safety issue, severity-based SLA (`SEC-04`)

**Accessibility**
- Security Guard App — property-scoped, offline-tolerant, minimal-tap workflow

---

### 2.13 Notifications & Communication — P0, MVP

**What it owns**
- Booking lifecycle notifications: confirmed, arrival reminder, arrival instructions, expiring, overstay (PRD §54)
- Channel abstraction: push, SMS, WhatsApp, email behind a common notification event model
- Deduplication of repeated provider callbacks/notification jobs
- Local-timezone, plain-language customer messaging

**Accessibility**
- Cross-cutting — delivers into Driver Mobile App, Host/Owner App, Security Guard App, and external channels (SMS/WhatsApp/email/push)

---

### 2.14 Admin Console & Platform Operations — P0, MVP

**What it owns**
- Admin authentication/RBAC (shared with 2.1)
- User management: search, status, suspend/restore with reason, PII masking for support roles (`ADM-02`)
- Listing moderation: verification queue, approve/reject/suspend with reason category (`ADM-03`)
- Booking operations: full timeline (payment/access/refunds/disputes/notes), append-only adjustments (`ADM-04`)
- Refund and adjustment console: partial refund/credit/fee waiver, ledger-consistent (`ADM-05`)
- Configuration management: hold duration, grace periods, cancellation windows, fees, ranking weights, verification requirements — versioned, future-effective, rollback-capable (`ADM-08`)

**Accessibility**
- Admin Web Console (internal only)

---

### 2.15 Analytics & Reporting — P0, MVP

**What it owns**
- Marketplace analytics dashboard: GMV, revenue, bookings, success rate, cancellation/no-show rate, repeat rate, utilization, search-to-book, distance-to-parking (`ADM-06`)
- Geographic density dashboard: searches vs. active spaces vs. bookings vs. supply gap, by zone — drives supply-acquisition decisions (`ADM-07`, PRD §45)
- North Star metric: **successful parking sessions**; secondary metric: **% of searches producing a reliable option within 300m** (PRD §44)
- No-result / failed-search capture — **P1**
- Property-level occupancy analytics (hour/day, peak windows, revenue) — shared with 2.16 (`OS-04`)

**Accessibility**
- Admin Web Console — marketplace/supply/demand dashboards, density map
- Property Manager Web Console — property-scoped occupancy/revenue view

---

### 2.16 Monthly, Recurring & Corporate Parking — P2, Phase 2 (deferred until hourly/daily proves repeatable success + density)

**What it owns**
- Monthly parking plan: independent contract lifecycle, proration, notice-period cancellation (`REC-01`)
- Recurring commuter schedule: weekday/time-window reservation with holiday-calendar exceptions (`REC-02`)
- Corporate employee parking: org-scoped permit allocation, quotas, consolidated billing (`REC-03`)
- Resident shared-time parking: time-sliced allocation across office/resident/marketplace windows (`REC-04`)

**Accessibility**
- Driver Mobile App / Driver Web — plan selection, subscription management
- Host/Owner App, Property Manager Web Console — plan/allocation configuration
- Property Manager Web Console — corporate admin sub-role for employee/permit management

---

### 2.17 Event Parking — P2, Phase 2

**What it owns**
- Event creation: venue, date/time, expected demand, arrival/exit windows, participating properties (`EVT-01`)
- Event inventory reservation: dedicated capacity pools, event pricing, oversell protection (`EVT-02`)
- Event parking pass: booking bundled with event context, offline-available (`EVT-03`)
- Event closure/rebooking: affected-booking identification, no silent relocation, idempotent bulk refunds (`EVT-04`)

**Accessibility**
- Driver Mobile App / Driver Web — event pass purchase
- Admin Web Console / Property Manager Web Console — event creation, inventory allocation
- Public Web — event landing pages for acquisition

---

### 2.18 Parking OS / B2B Capabilities — P2 (dashboard/permits/exposure), P3 (hardware, billing automation)

**What it owns**
- Property inventory dashboard: total/occupied/available/held/maintenance/visitor, by floor/zone (`OS-01`) — **P2**
- Tenant/employee permits: date-ranged, area-scoped, revocation-propagating (`OS-02`) — **P2**
- Visitor management end-to-end (`OS-03`) — **P2**
- Marketplace exposure toggle per property/time-window, with kill switch (`OS-05`) — **P2**
- Property-level billing: contracted-plan invoicing, immutable historical invoices (`OS-07`) — **P3**
- Access hardware integration boundary (shared with 2.9) — **P3**

**Accessibility**
- Property Manager Web Console — primary surface for all B2B capability
- Admin Web Console — cross-property oversight

---

## 3. Module Priority Summary

| # | Module | Priority | Phase |
|---|---|---|---|
| 2.1 | Identity & Access Management | P0 | MVP |
| 2.2 | Driver Profile & Vehicle Management | P0 | MVP |
| 2.3 | Search & Discovery | P0 core / P1 ranking-filters | MVP |
| 2.4 | Listing & Inventory Management | P0 | MVP |
| 2.5 | Property & Society Management | P0 | MVP |
| 2.6 | Host Onboarding & Earnings | P0 | MVP |
| 2.7 | Booking & Reservation Engine | P0 | MVP |
| 2.8 | Payment & Settlement | P0 | MVP |
| 2.9 | Access Control & Check-in/out | P0 | MVP |
| 2.10 | Cancellation/No-show/Overstay/Disputes | P0 | MVP |
| 2.11 | Ratings, Trust & Fraud | P0 fraud / P1 ratings | MVP |
| 2.12 | Security Staff Operations | P0 | MVP |
| 2.13 | Notifications & Communication | P0 | MVP |
| 2.14 | Admin Console & Platform Operations | P0 | MVP |
| 2.15 | Analytics & Reporting | P0 | MVP |
| 2.16 | Monthly, Recurring & Corporate Parking | P2 | Phase 2 |
| 2.17 | Event Parking | P2 | Phase 2 |
| 2.18 | Parking OS / B2B Capabilities | P2/P3 | Phase 2–3 |

Explicitly **out of scope** until core marketplace reliability is proven: custom IoT hardware, AI/dynamic pricing, nationwide launch, loyalty/wallet, social features, EV charging marketplace, full enterprise API marketplace, insurance product claims without real underwriting, ANPR/RFID automation, microservices-for-its-own-sake.

---

## 4. High-Level Architecture (technology-agnostic)

This describes the shape of the system, not the stack. For MVP, the spec explicitly recommends a **modular monolith** over microservices — module boundaries below should map to internal modules/packages, not necessarily separate deployable services, until scale requires the split.

```
┌──────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                              │
│                                                                        │
│   Driver Mobile   Driver Web    Host/Owner   Property Mgr   Security  │
│      App                          App        Web Console   Guard App │
│                                                                        │
│                          Admin Web Console                            │
└───────────────────────────────┬────────────────────────────────────-┘
                                 │
                         ┌───────▼────────┐
                         │   API GATEWAY   │
                         │  (auth, rate    │
                         │  limiting,      │
                         │   routing)      │
                         └───────┬────────┘
                                 │
┌────────────────────────────────▼───────────────────────────────────┐
│                     CORE DOMAIN MODULES                             │
│                 (modular monolith for MVP)                          │
│                                                                       │
│  Identity/Auth        User & Vehicle        Property & Listing       │
│  Availability &       Booking & Session      Pricing Engine          │
│    Inventory                                                         │
│  Payment & Ledger     Access & Credential     Notification           │
│  Ratings & Trust      Dispute & Support       Admin / Ops            │
│  Analytics/Reporting  Fraud/Risk Engine                              │
│                                                                       │
│  ── Cross-cutting: Policy/Rules Engine · Audit/Event Log            │
│     (append-only) · Idempotency layer · Config Management ──        │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                 │
        ┌───────▼──────┐ ┌──────▼───────┐  ┌───────▼────────┐
        │  Transactional │ │  Fast-state  │  │  Object Storage │
        │  Data Store    │ │  Cache       │  │ (photos, docs,  │
        │  (source of    │ │  (holds,     │  │  evidence)      │
        │   truth)       │ │  sessions)   │  │                 │
        └────────────────┘ └──────────────┘  └─────────────────┘
                                 │
                 ┌───────────────┴────────────────┐
                 │                                 │
        ┌────────▼─────────┐             ┌─────────▼──────────┐
        │ Analytics / Event │             │  External Integr.   │
        │   Warehouse        │             │  Maps/Geocoding ·    │
        │ (search, density,  │             │  Payments · SMS/     │
        │  KPI aggregation)  │             │  WhatsApp/Push ·     │
        │                    │             │  KYC providers ·     │
        │                    │             │  (future) ANPR/IoT   │
        └────────────────────┘             └──────────────────────┘
```

### 4.1 Architectural principles carried over from the spec

- **Single source of truth for inventory.** Only one authoritative availability capability decides bookability. Search results are advisory; checkout/hold must revalidate atomically. (`SRCH-03`, `BKG-01`, `INV-04`)
- **Idempotency everywhere it touches money or inventory.** Payment requests, webhooks, holds, payouts and hardware access events must all be safely retryable. (`PAY-02`, `PAY-05`, `OS-06`)
- **Fixed state machines, configurable policy.** Booking/payment/listing states stay structurally consistent; commercial policy (cancellation windows, grace periods, fees) is configuration, not hard-coded per screen. (Spec §7, `ADM-08`)
- **Append-only audit trail.** Every status-changing action stores actor, timestamp, source, reason; admin overrides never erase history. (Spec §4, §22)
- **Price/policy snapshotting.** The price and policy shown to a driver must be reproducible after payment and must not be retroactively altered by later pricing/policy changes. (`BKG-02`, `HOST-03`)
- **Server-authoritative access control.** Security devices/apps may cache signed data for poor connectivity, but the backend is the authority on admit/reject. (`ACC-02`)
- **Property access rules override marketplace availability.** If a property disallows outsiders, that inventory must never be exposed to the open marketplace. (Spec §4, `PROP-02`)
- **Hardware is an integration, not a dependency.** QR + manual verification is the MVP access method; ANPR/RFID/IoT sit behind a provider-neutral event boundary and are additive only. (`OS-06`, spec §7)
- **Tenant/property scoping.** Host, Property Manager and Security surfaces only ever see data for inventory they are authorized against. (`HOST-05`, `SEC-01`)

### 4.2 Notes on the "Core Domain Modules" layer

These map directly to the Feature Modules in Section 2:

| Architecture module | Feature modules it implements |
|---|---|
| Identity/Auth | 2.1 |
| User & Vehicle | 2.2 |
| Property & Listing | 2.4, 2.5 |
| Availability & Inventory | 2.4 (availability/capacity pool), 2.16/2.17 pool extensions |
| Booking & Session | 2.7, 2.9 (check-in/out) |
| Pricing Engine | 2.4 (host pricing), 2.7 (price calc) |
| Payment & Ledger | 2.8 |
| Access & Credential | 2.9 |
| Notification | 2.13 |
| Ratings & Trust | 2.11 |
| Dispute & Support | 2.10 |
| Admin / Ops | 2.14 |
| Analytics/Reporting | 2.15 |
| Fraud/Risk Engine | 2.11 (fraud controls) |
| Host/Property B2B extensions | 2.6, 2.16, 2.18 |
| Event extensions | 2.17 |

---

## 5. Engineering readiness gate (do not start build before these are signed off)

Carried directly from the functional spec — build should not start until:

- [ ] Exact booking state machine approved
- [ ] Exact payment state machine approved
- [ ] Inventory locking/concurrency strategy approved
- [ ] Cancellation/refund matrix approved
- [ ] Host payout/settlement policy approved
- [ ] Property authorization rules approved
- [ ] Access failure fallback approved
- [ ] No-show/overstay rules approved
- [ ] Dispute evidence and SLA rules approved
- [ ] Admin override permissions approved
- [ ] PII/KYC/payment-data handling and retention rules approved
- [ ] MVP geography and supply type fixed (one micro-market — see PRD §10)
- [ ] MVP parking types and vehicle categories fixed
- [ ] Success metrics fixed: successful parking sessions, failed sessions, repeat rate, utilization, GMV, contribution margin
