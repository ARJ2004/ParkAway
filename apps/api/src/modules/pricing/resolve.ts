import { PLATFORM_FEE_PERCENT } from "./pricing.config.js";

/**
 * Pure — no DB, no I/O. This is the single calculator Sprint 4's checkout
 * will call too (§2.1): building it here and the checkout there, from one
 * implementation, is what prevents two calculators that disagree.
 */
export interface PricingRuleInput {
  ruleType: "base_hourly" | "base_daily" | "peak" | "weekend";
  amountPaise: number;
  daysOfWeek?: number[] | null;
  windowStartMin?: number | null; // minutes from midnight; null = all day
  windowEndMin?: number | null;
  minDurationMin?: number | null;
}

export interface PriceSegment {
  startsAt: string;
  endsAt: string;
  ruleType: string;
  amountPaise: number;
  durationMin: number;
}

export interface PriceBreakdown {
  baseAmountPaise: number;
  segments: PriceSegment[];
  platformFeePaise: number;
  hostEarningsPaise: number;
  totalPaise: number;
}

const MINUTES_PER_DAY = 1440;

/**
 * Day-of-week and time-of-day for peak/weekend rules are wall-clock concepts
 * for the single India micro-market this pilot serves (`tech-stack.md`,
 * PRD §10) — they must resolve the same way regardless of what timezone the
 * server process happens to be running in. Using `Date`'s local getters
 * (`getHours`/`getDay`/`setHours`) would silently make every peak/weekend
 * quote depend on the deployment host's system timezone, which is exactly
 * the kind of bug that passes on a dev laptop set to IST and breaks on a
 * UTC-configured EC2 instance. Every wall-clock read/write in this file
 * goes through `toIstWallClock`/`fromIstWallClock` instead, using UTC
 * getters/setters on a shifted instant — deterministic on any host.
 */
const IST_OFFSET_MINUTES = 330; // UTC+5:30, no DST

function toIstWallClock(instant: Date): Date {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000);
}

function fromIstWallClock(wallClock: Date): Date {
  return new Date(wallClock.getTime() - IST_OFFSET_MINUTES * 60_000);
}

/** IST calendar-day start (00:00 IST), as a real UTC instant. */
function istDayStart(instant: Date): Date {
  const wall = toIstWallClock(instant);
  wall.setUTCHours(0, 0, 0, 0);
  return fromIstWallClock(wall);
}

function istDayOfWeek(instant: Date): number {
  return toIstWallClock(instant).getUTCDay();
}

function istMinutesOfDay(instant: Date): number {
  const wall = toIstWallClock(instant);
  return wall.getUTCHours() * 60 + wall.getUTCMinutes();
}

/**
 * Precedence: most specific rule wins (peak > weekend > base — `event`
 * pricing is P2/out of scope this sprint). A window spanning several rules
 * is computed per-segment. Deterministic and server-side only (AC-3).
 */
export function resolvePrice(rules: PricingRuleInput[], start: Date, end: Date): PriceBreakdown {
  if (end.getTime() <= start.getTime()) {
    throw new Error("end must be after start");
  }
  const baseHourly = rules.find((r) => r.ruleType === "base_hourly");
  if (!baseHourly) {
    throw new Error("A base_hourly rule is required to resolve a price");
  }
  const baseDaily = rules.find((r) => r.ruleType === "base_daily");
  const totalMinutes = (end.getTime() - start.getTime()) / 60_000;

  // Day-rate short-circuit: a window of 24h or more prices off base_daily
  // rather than proration through hourly/peak/weekend segments — a
  // deliberate scope bound (see module doc comment in pricing.service.ts).
  if (baseDaily && totalMinutes >= MINUTES_PER_DAY) {
    const days = Math.ceil(totalMinutes / MINUTES_PER_DAY);
    const amount = days * baseDaily.amountPaise;
    return finalize(amount, [
      { startsAt: start.toISOString(), endsAt: end.toISOString(), ruleType: "base_daily", amountPaise: amount, durationMin: totalMinutes },
    ]);
  }

  const breakpoints = collectBreakpoints(rules, start, end);
  const segments: PriceSegment[] = [];
  let total = 0;

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const segStart = breakpoints[i]!;
    const segEnd = breakpoints[i + 1]!;
    if (segEnd.getTime() <= segStart.getTime()) continue;

    const mid = new Date((segStart.getTime() + segEnd.getTime()) / 2);
    const rule = pickRule(rules, baseHourly, mid);
    const durationMin = (segEnd.getTime() - segStart.getTime()) / 60_000;
    const amount = Math.round((rule.amountPaise / 60) * durationMin);

    segments.push({ startsAt: segStart.toISOString(), endsAt: segEnd.toISOString(), ruleType: rule.ruleType, amountPaise: amount, durationMin });
    total += amount;
  }

  return finalize(total, segments);
}

function finalize(baseAmountPaise: number, segments: PriceSegment[]): PriceBreakdown {
  const platformFeePaise = Math.round((baseAmountPaise * PLATFORM_FEE_PERCENT) / 100);
  return {
    baseAmountPaise,
    segments,
    platformFeePaise,
    hostEarningsPaise: baseAmountPaise - platformFeePaise,
    totalPaise: baseAmountPaise,
  };
}

function ruleMatchesAt(rule: PricingRuleInput, at: Date): boolean {
  if (rule.daysOfWeek && rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(istDayOfWeek(at))) return false;
  const minutesOfDay = istMinutesOfDay(at);
  const windowStart = rule.windowStartMin ?? 0;
  const windowEnd = rule.windowEndMin ?? MINUTES_PER_DAY;
  return minutesOfDay >= windowStart && minutesOfDay < windowEnd;
}

function pickRule(rules: PricingRuleInput[], baseHourly: PricingRuleInput, at: Date): PricingRuleInput {
  const peak = rules.find((r) => r.ruleType === "peak" && ruleMatchesAt(r, at));
  if (peak) return peak;
  const weekend = rules.find((r) => r.ruleType === "weekend" && ruleMatchesAt(r, at));
  if (weekend) return weekend;
  return baseHourly;
}

/**
 * Breakpoints = every rule's window edges (projected onto each calendar day
 * the booking window touches, clamped to [start, end]) plus start/end
 * themselves — deduped and sorted, so each segment between consecutive
 * breakpoints has exactly one applicable rule throughout.
 */
function collectBreakpoints(rules: PricingRuleInput[], start: Date, end: Date): Date[] {
  const points = new Set<number>([start.getTime(), end.getTime()]);

  let day = istDayStart(start);

  while (day.getTime() <= end.getTime()) {
    const dow = istDayOfWeek(day);
    for (const rule of rules) {
      if (rule.ruleType === "base_hourly" || rule.ruleType === "base_daily") continue;
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dow)) continue;

      const windowStart = new Date(day.getTime() + (rule.windowStartMin ?? 0) * 60_000);
      const windowEnd = new Date(day.getTime() + (rule.windowEndMin ?? MINUTES_PER_DAY) * 60_000);
      const clampedStart = windowStart.getTime() < start.getTime() ? start : windowStart;
      const clampedEnd = windowEnd.getTime() > end.getTime() ? end : windowEnd;
      if (clampedStart.getTime() < clampedEnd.getTime()) {
        points.add(clampedStart.getTime());
        points.add(clampedEnd.getTime());
      }
    }
    // IST has no DST, so one IST calendar day is always exactly 24h of
    // real time — safe to advance by a fixed millisecond step rather than
    // a calendar-aware setDate().
    day = new Date(day.getTime() + MINUTES_PER_DAY * 60_000);
  }

  return [...points]
    .filter((t) => t >= start.getTime() && t <= end.getTime())
    .sort((a, b) => a - b)
    .map((t) => new Date(t));
}
