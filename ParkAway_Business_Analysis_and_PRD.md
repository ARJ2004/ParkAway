# ParkAway — Parking Marketplace & Parking OS
## Brutal Business Analysis + Detailed PRD

**Date:** September 2026  
**Status:** Concept / Pre-MVP  
**Verdict:** **Do not build the full marketplace yet. Validate a dense micro-market manually first.**

---

# 1. Executive Summary

The idea is to create a marketplace that connects people who need parking with underutilized private parking capacity:

- Apartment/society parking
- Office parking after hours
- Hotel parking
- Restaurant parking
- Commercial buildings
- Private driveways
- Other managed parking inventory

A driver could search for a destination, discover a nearby parking space, book it for a fixed period, navigate to it, check in, park, and pay.

The original framing is:

> **"Airbnb for parking."**

The stronger business framing is:

> **"A parking operating system and marketplace that turns fragmented, underutilized private parking capacity into reliable, bookable inventory."**

## Brutal verdict

### Pure peer-to-peer hourly marketplace: **4/10**

The problem is real, but the economics are weak at low ticket sizes.

If the typical transaction is ₹150 for three hours and the platform takes 15%, the platform gets only ₹22.50 before payment processing, refunds, support, fraud, and operations.

This means the business requires very high transaction volume.

More importantly, there is evidence that an Indian startup already attempted a similar private-parking marketplace and later pivoted toward B2B because the consumer model was not profitable.

### Parking marketplace + recurring parking + B2B parking software: **7/10**

This is substantially more interesting.

The company can monetize:

1. Hourly parking
2. Daily parking
3. Monthly/commuter parking
4. Event parking
5. Property-level parking management
6. Parking software
7. Access-control integrations
8. Parking analytics

The likely economic engine is **recurring parking + B2B software**, while hourly parking can be the acquisition/use-case layer.

---

# 2. The Core Insight

India does not necessarily need another company that physically builds parking.

A large amount of parking capacity already exists but is:

- Fragmented
- Private
- Underutilized at particular times
- Difficult to discover
- Not digitally reservable
- Not consistently priced
- Poorly managed
- Sometimes inaccessible to outsiders

The opportunity is to make that capacity:

> **Visible → bookable → accessible → trusted → monetizable**

The challenge is that parking is fundamentally a **physical marketplace**, not merely a software marketplace.

A digital listing is worthless if the driver arrives and:

- The space is occupied
- The guard does not know about the booking
- The owner is unavailable
- The society refuses entry
- The spot is too small
- Another car is parked there
- The location pin is wrong

Therefore the product must solve **physical reliability**, not just discovery.

---

# 3. Market Problem

Mumbai illustrates the severity of the problem.

Research cited in the analysis found that Mumbai had approximately 23 lakh cars and 34 lakh two-wheelers in 2024, with roughly one-third of vehicles parked on roads/non-designated spaces.

A separate estimate cited in the research put Mumbai's parking demand at approximately 2.85 lakh equivalent car spaces versus substantially lower available formal capacity.

Other Indian metros face similar problems.

The underlying demand is therefore credible.

The important question is not:

> "Does India have a parking problem?"

It clearly does.

The important question is:

> **"Can a private marketplace reliably monetize fragmented parking at a sufficiently high margin?"**

That is the real startup question.

---

# 4. Competitive Evidence

## Park 24x7

Park 24x7 launched in India with a model very similar to the original idea: connecting drivers with unused private garages/parking from homes, shops, malls, hotels, hospitals, etc.

It reportedly charged relatively low parking prices and claimed thousands of cars served.

The important lesson is that the company later moved toward a B2B model because the consumer marketplace did not make enough profit.

**Lesson:**

> Demand alone is not enough. Transaction economics and operational density matter.

---

## Parkobot

Parkobot is closer to the modern version of the concept.

It uses:

- Private parking spaces
- Mobile booking
- IoT-enabled barriers
- Automated access
- Dynamic pricing
- Navigation

Its model demonstrates that the technology can work.

But it also highlights the need for:

- Property permissions
- Reliable access
- Security
- Liability controls
- Hardware
- Local density

---

## SimplyGuest

SimplyGuest focuses more on long-term vehicle parking.

Its model shows an alternative:

- Free parking-space listing
- Owners control price and availability
- Drivers can find spaces
- Monetization can happen through an unlock/contact mechanism

This suggests that **monthly parking may have better economics than very small hourly transactions.**

---

## RentParkings

RentParkings positions itself as a parking marketplace offering hourly/daily/monthly options.

It also markets the potential for parking owners to generate meaningful monthly income from unused spaces.

This validates the supply-side proposition:

> Owners may have an economic incentive to monetize unused parking.

---

# 5. Unit Economics

## Base example

Driver pays:

**₹150**

Parking duration:

**3 hours**

Platform take rate:

**15%**

Platform gross revenue:

**₹22.50**

Approximate costs:

- Payment processing: ₹3–₹5
- Refund/cancellation allowance: ₹1–₹3
- Customer support/operations: ₹2–₹5
- Fraud/chargeback/other leakage: ₹1–₹3

Potential contribution:

**~₹6–₹15 per booking**

Even if the business gets contribution to ₹25 per booking, the volume requirement is substantial.

---

# 6. Volume Scenarios

Assume ₹150 average booking value and 15% take rate.

| Bookings/day | Bookings/month | Platform GMV/month | Gross platform revenue |
|---:|---:|---:|---:|
| 100 | 3,000 | ₹4.5L | ₹67,500 |
| 500 | 15,000 | ₹22.5L | ₹3.38L |
| 1,000 | 30,000 | ₹45L | ₹6.75L |
| 5,000 | 1,50,000 | ₹2.25Cr | ₹33.75L |
| 10,000 | 3,00,000 | ₹4.5Cr | ₹67.5L |

This is the central problem.

A business that makes ₹20–₹25 per successful booking needs **massive volume**.

---

# 7. Better Economics: Monthly Parking

Suppose average monthly parking price:

**₹3,000**

Platform commission:

**15%**

Platform revenue:

**₹450/month/customer**

| Active monthly customers | Monthly platform revenue |
|---:|---:|
| 1,000 | ₹4.5L |
| 5,000 | ₹22.5L |
| 10,000 | ₹45L |
| 25,000 | ₹1.125Cr |
| 50,000 | ₹2.25Cr |

The recurring model is much more attractive because:

- Higher LTV
- Lower booking frequency requirement
- Lower support burden per rupee of revenue
- Easier demand forecasting
- Better supply planning
- Better retention
- Lower effective CAC after organic/referral growth

---

# 8. B2B Economics

Imagine a commercial building has:

**400 parking spaces**

but:

- 100 are used during business hours
- 250 become available after 6 PM
- 350 are available on weekends

Instead of selling individual parking transactions, ParkAway can provide:

- Parking management
- Digital reservations
- Occupancy management
- QR access
- Monthly passes
- Visitor parking
- Dynamic pricing
- Payment reconciliation
- Reports
- Enforcement
- APIs

Potential software revenue:

**₹5,000–₹50,000+ per property/month**

depending on property size and service level.

This is potentially much more attractive than relying entirely on transaction commissions.

---

# 9. The Biggest Risk: Density

This is the single most important marketplace problem.

Having 10,000 parking spaces across an entire city is not necessarily useful.

Having:

**300 spaces within a 1 km radius of BKC**

could be extremely valuable.

The driver doesn't care that ParkAway has:

> 10,000 spaces across Mumbai.

They care:

> "Can I park within 200–300 metres of where I am going?"

Therefore:

## Geographic density > total inventory

The business should launch neighborhood-by-neighborhood.

---

# 10. Recommended Market Entry

Do NOT launch:

> "Mumbai parking marketplace"

Instead launch:

> **"Guaranteed parking around BKC."**

Potential initial markets:

- BKC
- Bandra West
- Lower Parel
- Andheri
- Powai
- Indiranagar
- Koramangala
- HSR
- Whitefield
- Gurgaon business districts

Pick exactly **one**.

---

# 11. Validation Before Building

Do not spend six months building the app.

Run a concierge MVP.

## Target

Acquire:

**50–100 parking spaces**

in one micro-market.

Then acquire:

**100–500 potential drivers.**

Use:

- Landing page
- WhatsApp
- Google Maps
- Razorpay/payment links
- Spreadsheet/database
- Manual operations

Driver sends:

> "I need parking near BKC today 6–10 PM."

Operator manually finds a space.

Driver pays.

Operator confirms.

Driver receives directions.

Measure everything.

---

# 12. Kill / Continue Criteria

After approximately 30 days:

## Strong signal

Example:

- 100 spaces
- 500+ searches
- 100+ bookings
- 30%+ repeat users
- ₹50k–₹1L+ GMV
- Drivers ask for more locations
- Owners want more bookings

Then build the product.

## Weak signal

Example:

- 100 spaces
- 500 searches
- <25 bookings
- Very low repeat
- Drivers compare with free roadside parking
- Owners don't reliably honor availability

Then **kill or radically change the model.**

Do not rationalize bad demand.

---

# 13. Product Vision

## Vision

> Make every underutilized parking space in a city discoverable, reservable, accessible and economically productive.

## Mission

> Reduce parking search time while helping property owners monetize unused parking capacity.

---

# 14. User Types

### Driver

Needs parking.

### Individual Host

Owns an unused parking space.

### Business Host

Owns/manages parking capacity.

### Property Manager

Manages building/society parking.

### Parking Operator

Professionally manages a parking facility.

### Security Staff

Controls physical entry and exit.

### Platform Admin

Manages users, listings, payments, disputes and marketplace operations.

---

# 15. Driver Product

## 15.1 Registration

- Mobile OTP
- Name
- Email (optional initially)
- Vehicle details
- Vehicle registration number
- Vehicle type
- Preferred payment method

---

# 16. Search

Driver enters:

> Destination

Examples:

- BKC
- Phoenix Palladium
- Koramangala
- Indiranagar
- Hospital
- Restaurant
- Event venue

Then:

- Date
- Start time
- Duration

Default:

**Now**

---

# 17. Map

Display nearby spaces.

Each result should show:

- Price
- Distance
- Walking distance
- Availability
- Covered/uncovered
- Security
- Rating
- Vehicle compatibility
- Verification
- Access type

Example:

> ₹150 / 3 hours  
> 180m away  
> Covered  
> CCTV  
> Verified  
> 4.7★  

---

# 18. Filters

Driver can filter:

- Price
- Distance
- Covered
- Uncovered
- EV charging
- CCTV
- Security guard
- 24×7 access
- Large vehicle
- SUV compatible
- Instant booking
- Monthly
- Daily
- Hourly

---

# 19. Parking Detail Page

Show:

### Location

Exact address after booking if required by security/privacy policy.

### Space

- Space number
- Dimensions
- Type
- Covered
- Floor

### Access

- Gate
- Security
- QR
- ANPR
- Manual verification

### Pricing

- Hourly
- Daily
- Monthly

### Rules

- Maximum vehicle size
- Arrival window
- Overnight allowed?
- EV charging rules
- No commercial vehicles, if applicable

### Photos

- Entrance
- Driveway
- Actual parking bay
- Signage
- Gate

---

# 20. Guaranteed Booking

The key product promise:

> **Once paid, the parking space is reserved for you.**

Inventory must be locked during checkout.

Example:

```text
AVAILABLE
   ↓
HELD
   ↓
PAYMENT SUCCESS
   ↓
CONFIRMED
   ↓
CHECKED-IN
   ↓
COMPLETED
```

---

# 21. Inventory Lock

When the driver starts payment:

**5-minute hold**

During hold:

- No other driver can book the space.

If payment succeeds:

**CONFIRMED**

If payment fails or expires:

**AVAILABLE**

---

# 22. Booking State Machine

```text
AVAILABLE
   ↓
HELD
   ↓
CONFIRMED
   ↓
CHECKED_IN
   ↓
COMPLETED
```

Alternative states:

```text
CANCELLED
EXPIRED
NO_SHOW
OWNER_CANCELLED
DISPUTED
REFUNDED
```

---

# 23. Pricing Engine

Each parking space should support:

### Base price

Example:

₹50/hour

### Minimum duration

1 hour

### Maximum duration

12 hours

### Peak price

Example:

6 PM–10 PM = ₹100/hour

### Weekend price

Optional.

### Event price

Optional.

### Monthly price

Optional.

---

# 24. Pricing Formula

A configurable pricing engine:

```text
Base parking price
+ Peak adjustment
+ Event adjustment
+ Special day adjustment
+ Platform fee
+ Applicable taxes
- Discounts
= Customer payable
```

The exact tax treatment should be configured with professional tax/legal advice rather than hard-coded.

---

# 25. Platform Revenue

Potential models:

## Model A

10–20% commission.

## Model B

Parking fee + fixed customer booking fee.

Example:

Parking:

₹150

Platform fee:

₹20

## Model C

Owner subscription.

Example:

₹499/month to list/manage inventory.

## Model D

B2B SaaS subscription.

## Recommended

Use:

**Transaction commission + customer service/booking fee + B2B SaaS**

with pricing experiments.

---

# 26. Owner Onboarding

Owner provides:

- Name
- Mobile
- Address
- GPS location
- Parking photos
- Space number
- Dimensions
- Availability
- Price
- Access rules
- Bank account
- KYC
- Ownership/authorization evidence

---

# 27. Supply Verification

Levels:

### Level 1 — Basic

Phone verified.

### Level 2 — Location verified

GPS + photos.

### Level 3 — Property authorization

Ownership/allocation/authorization evidence.

### Level 4 — Physical verification

Field team verifies the space.

Listings receive:

- Basic
- Verified
- Premium Verified

badges.

---

# 28. Society / Building Authorization

This is critical.

A person should not be able to list:

> "Parking #42, XYZ Society"

without authorization.

The platform should support:

- Society onboarding
- Property manager approval
- Parking allocation verification
- Building rules
- Outsider access policy
- Visitor registration requirements

The owner must confirm they are legally/contractually permitted to offer the space.

---

# 29. Availability Management

Owner can define:

```text
Monday-Friday

00:00–08:00 Available
08:00–18:00 Resident
18:00–23:00 Marketplace
23:00–00:00 Available
```

Different schedules can exist for:

- Weekdays
- Weekends
- Holidays
- Events
- Special dates

---

# 30. Recurring Parking

Owner can list:

> Monthly parking

Driver selects:

- Start date
- Duration
- Vehicle

System generates recurring agreement/payment schedule.

Potential products:

- Monthly
- Quarterly
- Corporate employee parking
- Resident parking
- Long-term parking

---

# 31. Check-In

Driver receives:

- Booking ID
- QR code
- Space number
- Navigation
- Access instructions

Security scans QR.

System validates:

```text
booking active
AND
location correct
AND
vehicle allowed
AND
time valid
```

Then:

**CHECKED_IN**

---

# 32. Vehicle Verification

At booking:

Driver enters:

> MH01AB1234

At arrival:

Security can verify:

- Number plate
- Vehicle type
- Booking
- Time

Future:

**ANPR**

Automatic number plate recognition.

---

# 33. Access Control

MVP:

**QR + security**

Later:

- ANPR
- RFID
- Smart barriers
- IoT gates
- Digital locks

Ideal future experience:

```text
Drive to property
       ↓
ANPR recognizes vehicle
       ↓
Booking verified
       ↓
Gate opens
       ↓
Driver parks
```

---

# 34. No-Show

Example:

Booking:

6:00 PM

Grace period:

15 minutes.

If not checked in by:

6:15 PM

mark:

**NO_SHOW**

Policy should determine:

- Refund
- Owner compensation
- Platform fee
- Inventory release

---

# 35. Overstay

Example:

Booking:

6 PM–9 PM

Driver leaves:

10 PM

System calculates:

**1-hour overstay**

Possible rule:

> Additional hourly rate + penalty

Payment method:

- Auto-charge
- Security settlement
- Pre-authorized payment

---

# 36. Cancellation

Example default policy:

### >2 hours before

100% refund.

### 30 minutes–2 hours

50% refund.

### <30 minutes

No refund.

But policies must be configurable by product type.

---

# 37. Owner Cancellation

Owner cancellations damage marketplace trust.

Track:

**Owner cancellation rate**

Ranking penalty:

- Increased cancellation → lower search ranking
- Repeated cancellations → temporary suspension
- Severe/repeated abuse → permanent removal

Potential compensation:

Driver receives:

**100% refund + goodwill credit**

Owner may receive a penalty.

---

# 38. Driver Ratings

After parking:

Rate:

- Accuracy
- Access
- Safety
- Cleanliness
- Location
- Overall experience

---

# 39. Owner Ratings

Owner can rate:

- Driver behavior
- Vehicle compliance
- No-show
- Overstay
- Property damage

---

# 40. Disputes

Supported disputes:

- Space unavailable
- Wrong space
- Owner denied entry
- Vehicle damage
- Theft claim
- Overcharge
- Incorrect location
- Access problem

Every booking should have an audit trail.

---

# 41. Damage Handling

Before check-in:

Driver can optionally capture vehicle photos.

Platform stores:

- Timestamp
- GPS
- Booking ID
- Vehicle
- Photos

At checkout:

Driver can report damage.

Important:

The platform's terms must clearly define whether it is:

- Marketplace only
- Parking operator
- Agent
- Insurer/guarantor

Do not promise insurance coverage without actually arranging appropriate insurance.

---

# 42. Security / Trust

Required controls:

- Phone verification
- Vehicle verification
- Owner verification
- Listing verification
- Booking audit trail
- QR access
- Photo evidence
- Fraud detection
- Dispute workflow

Potential advanced controls:

- Government ID verification
- Driver's license verification
- RC verification
- ANPR
- Risk scoring

---

# 43. Admin Dashboard

## Marketplace

- GMV
- Platform revenue
- Bookings
- Successful sessions
- Cancellation rate
- No-show rate
- Repeat rate
- Average booking value

## Supply

- Active spaces
- Verified spaces
- Pending spaces
- Utilization
- Owner earnings
- Owner churn

## Demand

- Searches
- Search-to-booking conversion
- No-result searches
- Average distance
- Repeat users

---

# 44. The Most Important Metric

Do not optimize for:

- App downloads
- Registered users
- Page views

Primary metric:

# Successful parking sessions

Secondary metric:

# Percentage of searches that produce a reliable parking option within 300 metres

This captures actual product-market fit.

---

# 45. Geographic Density Dashboard

The company needs an internal demand/supply map.

Example:

| Area | Searches | Active spaces | Successful bookings | Supply gap |
|---|---:|---:|---:|---|
| BKC | 920 | 210 | 340 | High |
| Bandra | 740 | 190 | 270 | High |
| Powai | 420 | 380 | 210 | Medium |
| Andheri | 300 | 500 | 180 | Low |

The key question:

> **Where should the supply team acquire parking next?**

---

# 46. Supply Acquisition

Do not rely exclusively on organic host signups.

Build a local sales operation.

Target:

- Office buildings
- Societies
- Hotels
- Hospitals
- Restaurants
- Malls
- Schools
- Gyms
- Event venues
- Commercial properties

Pitch:

> "Your parking capacity is unused for X hours. ParkAway can monetize that idle capacity."

---

# 47. B2B Parking Management

Property dashboard should support:

- Parking inventory
- Slot allocation
- Tenant permits
- Visitor parking
- Marketplace inventory
- Employee parking
- Monthly passes
- Pricing
- Access control
- Occupancy
- Revenue
- Reports

---

# 48. Dynamic Inventory

A single parking space can have different users at different times.

Example:

```text
08:00–18:00
Office tenant

18:00–23:00
Marketplace

23:00–08:00
Resident
```

This is one of the strongest aspects of the business model.

The platform isn't creating new parking.

It is **increasing utilization of existing parking.**

---

# 49. Event Parking

Event organizers can create parking zones.

Example:

Concert:

**7 PM–11 PM**

Available spaces:

500

Price:

₹300

Driver books in advance.

Potential partners:

- Event organizers
- Wedding venues
- Convention centers
- Stadiums
- Restaurants
- Exhibition centers

This could be a high-intent, higher-price acquisition channel.

---

# 50. Monthly Parking

Driver sees:

> "Need parking near your office?"

Plans:

- Monthly
- Quarterly
- Employee
- Overnight
- Weekend

This should be a major product category.

---

# 51. Corporate Parking

Companies can purchase parking inventory.

Example:

Company:

> 50 employee parking passes

ParkAway manages:

- Allocation
- Vehicle mapping
- Attendance
- Access
- Billing
- Employee changes

This becomes B2B SaaS + marketplace revenue.

---

# 52. Technology Architecture

Suggested high-level architecture:

```text
Mobile/Web Apps
       │
       ▼
API Gateway
       │
       ├── Auth Service
       ├── User Service
       ├── Parking Inventory Service
       ├── Availability Service
       ├── Booking Service
       ├── Pricing Service
       ├── Payment Service
       ├── Access Service
       ├── Notification Service
       ├── Rating Service
       ├── Dispute Service
       └── Admin Service
              │
              ▼
          PostgreSQL
              │
       ┌──────┴──────┐
       │             │
    Redis       Object Storage
       │
       ▼
 Maps / Payments / SMS / WhatsApp / ANPR / IoT
```

For MVP, this can be a modular monolith rather than microservices.

---

# 53. Core Data Model

## User

```text
id
name
phone
email
role
status
created_at
```

## Vehicle

```text
id
user_id
registration_number
vehicle_type
make
model
size_category
```

## Property

```text
id
owner_id
name
address
latitude
longitude
property_type
verification_status
```

## ParkingSpace

```text
id
property_id
space_number
dimensions
vehicle_size_limit
covered
security
access_type
status
```

## AvailabilityRule

```text
id
space_id
day_of_week
start_time
end_time
price
status
```

## Booking

```text
id
user_id
space_id
vehicle_id
start_time
end_time
status
base_amount
platform_fee
tax
discount
total_amount
```

## Payment

```text
id
booking_id
provider
transaction_id
amount
status
```

## CheckIn

```text
id
booking_id
timestamp
location
vehicle_verified
method
```

## Dispute

```text
id
booking_id
type
description
status
resolution
```

---

# 54. Notification System

Notifications:

### Booking confirmed

> Your parking is confirmed.

### Before arrival

> Your parking starts in 30 minutes.

### Arrival

> Use Gate B. Show QR code.

### Expiring

> Your parking ends in 15 minutes.

### Overstay

> Your booking has exceeded the reserved duration.

Channels:

- Push
- SMS
- WhatsApp
- Email

MVP priority:

**Push + WhatsApp/SMS fallback**

---

# 55. Search Ranking

Ranking factors:

```text
distance
price
availability certainty
rating
verification
cancellation rate
access reliability
walking distance
conversion rate
```

A listing that frequently causes failed bookings should rank lower even if it is cheap.

---

# 56. Search Ranking Principle

Do not optimize:

> Cheapest parking

Optimize:

> **Best reliable parking**

A ₹180 space that is definitely available 150m away is more valuable than a ₹100 space that is uncertain 500m away.

---

# 57. Marketplace Flywheel

```text
Acquire supply
      ↓
Higher density
      ↓
Better search results
      ↓
More driver bookings
      ↓
Higher owner earnings
      ↓
More owners join
      ↓
More inventory
      ↓
Higher density
```

But this flywheel only works **locally**.

This is why citywide launch is dangerous.

---

# 58. Defensibility

Initially:

**Low.**

Anyone can build:

- Map
- Booking
- Payment
- Listing

Defensibility must come from:

### 1. Local density

More useful inventory.

### 2. Supply relationships

Exclusive agreements with properties.

### 3. Access infrastructure

Integration with gates/ANPR.

### 4. Historical utilization data

Know when/where demand occurs.

### 5. Parking operating system

Become embedded in property operations.

### 6. Demand network

Drivers return because the app reliably works.

---

# 59. Major Risks

## 1. Marketplace chicken-and-egg

No supply → no drivers.

No drivers → no hosts.

## 2. Density

Scattered inventory has little value.

## 3. Low transaction value

₹150 transactions create weak unit economics.

## 4. Access failures

One bad experience can destroy trust.

## 5. Society restrictions

Some residential properties may not permit outsider parking.

## 6. Liability

Damage/theft disputes can become expensive.

## 7. Fraud

Fake listings, unauthorized listings, fake bookings.

## 8. Price competition

Drivers compare against:

- Street parking
- Public parking
- Mall parking
- Office parking
- Valet
- Free parking

## 9. Owner disintermediation

Driver and owner may exchange numbers and transact outside the platform.

## 10. Hardware complexity

Smart gates and ANPR improve reliability but increase capital expenditure and operational complexity.

---

# 60. Recommended Business Model

## Phase 1

Hourly + daily + monthly marketplace.

Focus on one micro-market.

## Phase 2

Recurring commuter parking.

## Phase 3

Property management SaaS.

## Phase 4

Access control integrations.

## Phase 5

Parking infrastructure platform.

---

# 61. What NOT to Build Initially

Do not build:

- IoT hardware
- AI dynamic pricing
- Loyalty program
- Wallet
- Complex subscription system
- Nationwide marketplace
- Social features
- EV ecosystem
- Advanced analytics
- Full enterprise APIs

until demand is proven.

---

# 62. MVP Scope

## Driver

- Mobile login
- Location
- Search
- Map
- Parking details
- Availability
- Booking
- Payment
- Navigation
- QR
- Booking history

## Owner

- Signup
- Add space
- Photos
- Availability
- Pricing
- Bookings
- Earnings

## Admin

- User management
- Listing verification
- Booking management
- Refunds
- Disputes
- Pricing
- Marketplace analytics

---

# 63. Version 2

Add:

- Monthly parking
- Recurring bookings
- Corporate accounts
- Property managers
- Security dashboard
- QR scanning
- Overstay handling
- Ratings
- Advanced cancellation policies

---

# 64. Version 3

Add:

- ANPR
- Smart barriers
- IoT
- Dynamic pricing
- Property APIs
- Parking analytics
- Enterprise billing

---

# 65. Business KPIs

## North Star

**Successful parking sessions**

## Marketplace KPIs

- GMV
- Take rate
- Revenue
- Contribution margin
- Booking conversion
- Search-to-booking
- Repeat booking
- Cancellation rate
- No-show rate
- Supply utilization
- Active inventory
- Revenue per parking space

## Supply KPIs

- Hosts acquired
- Spaces acquired
- Verified spaces
- Host activation
- Host retention
- Host earnings

## Demand KPIs

- CAC
- Active drivers
- Repeat rate
- Average order value
- LTV
- Search density

---

# 66. Unit Economics Targets

These are **startup targets, not market facts**.

I'd want approximately:

### Hourly booking

AOV:

**₹200–₹400+**

Take rate:

**15–20%**

Contribution:

**₹30–₹50+**

### Monthly parking

AOV:

**₹2,000–₹10,000+**

Take rate:

**10–20%**

Contribution:

**₹300–₹1,500+ per active monthly customer**

### B2B

Target:

**₹5k–₹50k+ monthly recurring revenue/property**

The actual numbers must be validated in the chosen neighborhood.

---

# 67. What Success Looks Like

Suppose one neighborhood reaches:

### Supply

1,000 active spaces.

### Average utilization

30%.

### 300 spaces effectively occupied at a point in time.

If average monetized parking revenue per active space is ₹4,000/month:

Total monthly GMV:

**₹40 lakh**

At 15% take rate:

**₹6 lakh/month platform revenue**

At 5,000 equivalent recurring customers/bookings and additional B2B SaaS revenue, the economics become substantially more attractive.

This is why **inventory utilization** matters more than raw listing count.

---

# 68. The Business Model I Would Bet On

If I were founding this company, I would NOT pitch investors:

> "We are Airbnb for parking."

I would pitch:

> **"We are building the operating system for fragmented urban parking. We aggregate private parking capacity, make it reservable, manage access, and monetize idle inventory."**

That is a much stronger company.

---

# 69. Go-To-Market

## Step 1

Pick one dense neighborhood.

## Step 2

Acquire 50–100 parking spaces manually.

## Step 3

Acquire demand manually.

## Step 4

Run transactions through WhatsApp.

## Step 5

Measure:

- Search
- Booking
- Repeat
- Utilization
- Revenue
- Failed sessions

## Step 6

Find the most profitable parking category.

## Step 7

Build only the workflows that are repeatedly used.

---

# 70. The First Customer Segments I'd Test

Priority:

### 1. Office commuters

Strong recurring demand.

### 2. Event visitors

High willingness to pay.

### 3. Restaurant visitors

High-intent demand.

### 4. Hospital visitors

Very high pain.

### 5. Monthly residential parking

High retention.

### 6. Casual hourly parking

Large market but weaker economics.

---

# 71. Why Hospitals Could Be Interesting

Parking near hospitals can be unusually painful.

Drivers often:

- Need guaranteed parking
- Are time-sensitive
- Don't want to circle
- May stay for several hours
- May return repeatedly

This can create higher willingness to pay than generic parking.

But hospital partnerships and operational/security requirements are more complicated.

---

# 72. Why Events Could Be Interesting

An event creates:

**Predictable demand + predictable geography + predictable time.**

Example:

5,000 attendees.

Only 1,000 parking spaces nearby.

ParkAway can aggregate:

- Offices
- Hotels
- Commercial buildings
- Private properties

for that specific time window.

That is an excellent marketplace use case because demand and supply can be concentrated.

---

# 73. Potential Moat: Event Parking

A future event workflow:

```text
Event created
      ↓
Demand estimated
      ↓
Nearby parking mapped
      ↓
Hosts contacted
      ↓
Temporary inventory activated
      ↓
Drivers pre-book
      ↓
QR/ANPR access
      ↓
Event ends
      ↓
Inventory released
```

This may be a better initial marketplace wedge than random hourly parking.

---

# 74. Critical Product Principle

The customer isn't buying:

> "Parking space."

They are buying:

> **certainty**

The real value proposition is:

> "I know where my car will go before I arrive."

That is what people should pay a premium for.

---

# 75. Final Investment Verdict

| Dimension | Score |
|---|---:|
| Problem severity | 9/10 |
| Market size | 9/10 |
| Willingness to pay | 7/10 |
| Existing supply | 8/10 |
| Marketplace difficulty | 10/10 |
| ₹150 hourly economics | 4/10 |
| Recurring parking economics | 8/10 |
| B2B opportunity | 9/10 |
| Technology difficulty | 5/10 |
| Regulatory/operational complexity | 7/10 |
| Initial defensibility | 3/10 |
| Long-term defensibility | 7/10 |
| Overall opportunity | 7/10 |

---

# 76. Final Answer: Does It Work?

## Pure Airbnb-for-parking

**Probably not as a great standalone business.**

The problem is not the market.

The problem is:

> **low ARPU + high operational complexity + marketplace density + trust + acquisition cost.**

At ₹150 per booking, the platform's revenue is simply too small unless transaction volume becomes enormous.

---

## Parking marketplace + recurring parking

**Potentially yes.**

Monthly parking creates better LTV and more predictable demand.

---

## Parking marketplace + B2B Parking OS

**This is the version I would pursue.**

The company can become the software/infrastructure layer between:

> Property → Parking capacity → Driver → Payment → Access

That is significantly more defensible.

---

# 77. The One Experiment That Determines Whether You Should Build

Pick:

**ONE neighborhood.**

Acquire:

**100 spaces.**

Then generate:

**500 parking searches.**

Try to achieve:

- 100+ bookings
- 30%+ repeat
- ₹50k–₹1L+ GMV
- 25–30%+ inventory utilization
- <5% owner cancellations
- <5–10% failed parking sessions

If you can do that manually:

# BUILD IT.

If you cannot:

# KILL IT.

Do not hide behind the enormous theoretical Indian parking TAM.

A huge parking problem does **not** automatically produce a profitable marketplace.

The only thing that matters initially is:

> **Can you reliably match a driver with a nearby parking space, get them inside, and make enough money from that transaction to acquire the next driver and parking space?**

If yes, there is a company here.

If no, there is only a good problem statement.

---

# 78. Sources / Research Notes

The research used for this analysis included reporting and industry material covering:

- Mumbai parking shortages
- Mumbai parking demand/capacity
- Park 24x7's original private-parking marketplace and subsequent B2B pivot
- Parkobot's private-space + IoT model
- SimplyGuest's long-term parking marketplace
- RentParkings' parking-space marketplace
- Bengaluru parking pricing proposals
- Parking policy and regulatory developments

Important evidence from the research:

- Mumbai reporting cited approximately 23 lakh cars and 34 lakh two-wheelers, with roughly one-third parked on roads/non-designated locations.
- Mumbai parking demand was cited at approximately 2.85 lakh equivalent car spaces versus materially lower formal available capacity.
- Park 24x7's founder reportedly said the B2C model did not make enough profit and the company changed to B2B.
- Parkobot demonstrates a technology-heavy version involving private inventory, booking and smart barriers.
- SimplyGuest demonstrates a long-term parking model.
- Bengaluru parking proposals provide useful evidence that paid parking can command meaningful hourly/monthly prices.

These sources support the **existence of the problem and competitive precedent**, but the unit economics and KPI thresholds in this document are startup planning assumptions and should be validated through a real-world pilot.

---

# 79. Recommended Next Step

**Do not start with engineering.**

Start with:

> **100 parking spaces + 500 potential customers + 30 days + one neighborhood.**

The first product is not an app.

The first product is:

> **a reliable parking transaction.**

Once that works repeatedly, build the software around it.
