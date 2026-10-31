// Seat urgency + group prioritization logic.
// A group is urgent when it departs soon and/or has very few seats left.
import type { GroupStats } from "./groups";

export type UrgencyLevel = "full" | "critical" | "warning" | "normal" | "undated";

export interface GroupUrgency {
  remainingSeats: number;
  capacity: number;
  usedPax: number;
  departure?: string;
  daysToDeparture: number | null;
  isFull: boolean;
  level: UrgencyLevel;
  reason: string;
}

const DAY = 86400000;

export function daysUntil(date?: string): number | null {
  if (!date) return null;
  const t = new Date(`${date}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((t - base) / DAY);
}

export function computeUrgency(stats: GroupStats): GroupUrgency {
  const capacity = stats.capacity || 0;
  const remainingSeats = capacity > 0 ? Math.max(0, capacity - stats.usedPax) : Infinity;
  const days = daysUntil(stats.group.date);
  const isFull = capacity > 0 && remainingSeats <= 0;

  let level: UrgencyLevel = "normal";
  let reason = "On track";

  if (isFull) {
    level = "full";
    reason = "Group full — closed for new sales";
  } else if (days !== null && days <= 7) {
    level = "critical";
    reason = days < 0 ? `Departed ${Math.abs(days)}d ago` : days === 0 ? "Departs today" : `Departs in ${days} day${days === 1 ? "" : "s"}`;
  } else if (capacity > 0 && remainingSeats <= 3) {
    level = "critical";
    reason = `Only ${remainingSeats} seat${remainingSeats === 1 ? "" : "s"} left`;
  } else if ((days !== null && days <= 21) || (capacity > 0 && remainingSeats <= 8)) {
    level = "warning";
    reason = days !== null && days <= 21 ? `Departs in ${days} days` : `${remainingSeats} seats left`;
  } else if (days === null) {
    level = "undated";
    reason = "No departure date set";
  }

  return {
    remainingSeats: capacity > 0 ? remainingSeats : 0,
    capacity, usedPax: stats.usedPax,
    departure: stats.group.date,
    daysToDeparture: days,
    isFull, level, reason,
  };
}

/** Nearest departure first, then lowest remaining seats. Undated groups sink to the bottom. */
export function sortByUrgency<T>(list: T[], pick: (item: T) => GroupUrgency): T[] {
  return [...list].sort((a, b) => {
    const ua = pick(a), ub = pick(b);
    const da = ua.daysToDeparture, db = ub.daysToDeparture;
    if (da === null && db !== null) return 1;
    if (db === null && da !== null) return -1;
    if (da !== null && db !== null && da !== db) return da - db;
    const ra = ua.capacity > 0 ? ua.remainingSeats : Number.MAX_SAFE_INTEGER;
    const rb = ub.capacity > 0 ? ub.remainingSeats : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}

export const urgencyTone: Record<UrgencyLevel, string> = {
  full: "border-border bg-muted/40 text-muted-foreground",
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
  normal: "border-success/30 bg-success/10 text-success",
  undated: "border-border bg-accent/30 text-muted-foreground",
};

export const urgencyLabel: Record<UrgencyLevel, string> = {
  full: "FULL",
  critical: "URGENT",
  warning: "CLOSING",
  normal: "OPEN",
  undated: "NO DATE",
};
