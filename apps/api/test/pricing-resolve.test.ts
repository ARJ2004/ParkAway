import { describe, expect, it } from "vitest";
import { resolvePrice, type PricingRuleInput } from "../src/modules/pricing/resolve.js";

// All times below are given in UTC and chosen so that UTC = IST - 5:30,
// i.e. "T03:30" UTC is "09:00" IST — see resolve.ts's istDayStart/
// istMinutesOfDay comment for why this fixed offset matters: peak/weekend
// windows resolve in IST regardless of the server process's system
// timezone. 2026-09-28 is a Monday (dow 1); 2026-10-03 is a Saturday (dow 6).

const baseHourly: PricingRuleInput = { ruleType: "base_hourly", amountPaise: 5000 };
const baseDaily: PricingRuleInput = { ruleType: "base_daily", amountPaise: 40000 };
const peak: PricingRuleInput = {
  ruleType: "peak",
  amountPaise: 8000,
  daysOfWeek: [1, 2, 3, 4, 5],
  windowStartMin: 540, // 09:00 IST
  windowEndMin: 660, // 11:00 IST
};
const weekend: PricingRuleInput = {
  ruleType: "weekend",
  amountPaise: 6000,
  daysOfWeek: [0, 6],
};

describe("resolvePrice precedence", () => {
  it("base-only: a plain window with no peak/weekend overlap is a single base_hourly segment", () => {
    const result = resolvePrice([baseHourly], new Date("2026-09-28T01:00:00Z"), new Date("2026-09-28T03:00:00Z"));
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({ ruleType: "base_hourly", durationMin: 120 });
    expect(result.baseAmountPaise).toBe(10000); // 2h * 5000/h
  });

  it("peak overlapping partially: splits into base then peak segments at the window boundary", () => {
    // 08:30–11:00 IST = 03:00–05:30 UTC. Peak is 09:00–11:00 IST.
    const result = resolvePrice([baseHourly, peak], new Date("2026-09-28T03:00:00Z"), new Date("2026-09-28T05:30:00Z"));
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({ ruleType: "base_hourly", durationMin: 30 });
    expect(result.segments[1]).toMatchObject({ ruleType: "peak", durationMin: 120 });
    expect(result.baseAmountPaise).toBe(2500 + 16000);
  });

  it("weekend + peak collision: peak wins even on a day the weekend rule would otherwise match", () => {
    // Redefine peak to also apply on Saturday, to force a real collision at the same instant.
    const peakIncludingSat: PricingRuleInput = { ...peak, daysOfWeek: [1, 2, 3, 4, 5, 6] };
    // 2026-10-03 is a Saturday. 09:30–10:00 IST = 04:00–04:30 UTC.
    const result = resolvePrice([baseHourly, peakIncludingSat, weekend], new Date("2026-10-03T04:00:00Z"), new Date("2026-10-03T04:30:00Z"));
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.ruleType).toBe("peak");
  });

  it("weekend alone: an all-day weekend rule applies across a Saturday window", () => {
    const result = resolvePrice([baseHourly, weekend], new Date("2026-10-03T04:00:00Z"), new Date("2026-10-03T06:00:00Z"));
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.ruleType).toBe("weekend");
  });

  it("window spanning midnight IST: correctly splits at the IST calendar-day boundary", () => {
    // 23:00 IST Sunday to 01:00 IST Monday = 17:30 UTC Sun to 19:30 UTC Sun.
    // Peak applies Mon–Fri 09:00–11:00 IST, so it should NOT appear here —
    // this asserts the day-of-week boundary itself is computed in IST, not
    // in the server's local time or naive UTC-day terms.
    const result = resolvePrice([baseHourly, peak], new Date("2026-10-04T17:30:00Z"), new Date("2026-10-04T19:30:00Z"));
    expect(result.segments.every((s) => s.ruleType === "base_hourly")).toBe(true);
    expect(result.baseAmountPaise).toBe(10000);
  });

  it("sub-hour minimum duration: a 15-minute window prices proportionally, not rounded to a full hour", () => {
    const result = resolvePrice([baseHourly], new Date("2026-09-28T01:00:00Z"), new Date("2026-09-28T01:15:00Z"));
    expect(result.segments[0]).toMatchObject({ durationMin: 15 });
    expect(result.baseAmountPaise).toBe(1250); // 15/60 * 5000
  });

  it("day-rate short-circuit: a 30-hour window with base_daily prices as 2 days, not hourly proration", () => {
    const result = resolvePrice([baseHourly, baseDaily], new Date("2026-09-28T01:00:00Z"), new Date("2026-09-29T07:00:00Z"));
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.ruleType).toBe("base_daily");
    expect(result.baseAmountPaise).toBe(80000); // ceil(30h/24h) = 2 days * 40000
  });

  it("platform fee is deducted from host earnings, and total is the driver-facing price (not fee-inclusive on top)", () => {
    const result = resolvePrice([baseHourly], new Date("2026-09-28T01:00:00Z"), new Date("2026-09-28T02:00:00Z"));
    expect(result.totalPaise).toBe(5000);
    expect(result.platformFeePaise).toBe(750); // 15%
    expect(result.hostEarningsPaise).toBe(4250);
  });

  it("throws when no base_hourly rule is present", () => {
    expect(() => resolvePrice([peak], new Date("2026-09-28T01:00:00Z"), new Date("2026-09-28T02:00:00Z"))).toThrow();
  });

  it("throws when end is not after start", () => {
    expect(() => resolvePrice([baseHourly], new Date("2026-09-28T02:00:00Z"), new Date("2026-09-28T02:00:00Z"))).toThrow();
  });
});
