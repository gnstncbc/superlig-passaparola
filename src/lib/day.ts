// Daily puzzles roll over at midnight Istanbul time (UTC+3, no DST).
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** First daily puzzle (#1). */
export const DAILY_START = "2026-09-30";

export function istanbulDate(now: number = Date.now()): string {
  return new Date(now + OFFSET_MS).toISOString().slice(0, 10);
}

export function dailyNumber(date: string): number {
  return Math.round((Date.parse(date) - Date.parse(DAILY_START)) / DAY_MS) + 1;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function msUntilNextDay(now: number = Date.now()): number {
  return DAY_MS - ((now + OFFSET_MS) % DAY_MS);
}
