/**
 * The host sets the driver-facing price; the platform fee is a percentage
 * deducted from host earnings. The value lives in this one constant rather
 * than scattered across call sites (locked decision 10, resolving O-5).
 * TODO(ADM-08, Sprint 7): make this admin-configurable, versioned and
 * future-effective — this sprint uses a single centralized constant.
 */
export const PLATFORM_FEE_PERCENT = 15;
