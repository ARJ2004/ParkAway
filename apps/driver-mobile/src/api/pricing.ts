import { apiRequest } from "./client";

export interface PricingRuleInput {
  ruleType: "base_hourly" | "base_daily" | "peak" | "weekend";
  amountPaise: number;
  daysOfWeek?: number[];
  windowStartMin?: number;
  windowEndMin?: number;
  minDurationMin?: number;
}

export interface PricingVersion {
  id: string;
  listingId: string;
  version: number;
  effectiveFrom: string;
  createdByUserId: string;
  createdAt: string;
  rules: Array<PricingRuleInput & { id: string; pricingVersionId: string }>;
}

export function setPricing(listingId: string, rules: PricingRuleInput[]): Promise<PricingVersion> {
  return apiRequest(`/v1/host/listings/${listingId}/pricing`, { method: "PUT", body: { rules } });
}

export interface PriceBreakdown {
  baseAmountPaise: number;
  segments: Array<{ startsAt: string; endsAt: string; ruleType: string; amountPaise: number; durationMin: number }>;
  platformFeePaise: number;
  hostEarningsPaise: number;
  totalPaise: number;
}

export function previewPrice(listingId: string, start: string, end: string): Promise<PriceBreakdown> {
  return apiRequest(`/v1/host/listings/${listingId}/pricing/preview?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}
