import "server-only";
import { dailyNumber, istanbulDate } from "./day";
import { pickDaily } from "./dailyPick";
import { redisClient } from "./store";
import type { Question } from "./types";

const LAST_USED = "sl:dailyLast";
// Local fallback (no Redis): how many times today's set was regenerated.
const memorySalt = new Map<string, number>();
const dayKey = (date: string) => `sl:daily:${date}`;

export interface Daily {
  date: string;
  number: number;
  questions: Question[];
}

// Question ids for the day, chosen once and shared by every player.
async function dailyIds(questions: Question[], date: string): Promise<string[]> {
  const redis = redisClient();
  if (!redis) {
    // Without Redis, mark earlier picks of the day as used to get a new set.
    const lastUsed: Record<string, string> = {};
    for (let i = 0; i < (memorySalt.get(date) ?? 0); i++) {
      for (const q of pickDaily(questions, date, lastUsed)) lastUsed[q.id] = date;
    }
    return pickDaily(questions, date, lastUsed).map((q) => q.id);
  }

  const existing = await redis.get<string[]>(dayKey(date));
  if (Array.isArray(existing)) return existing;

  const lastUsed = (await redis.hgetall<Record<string, string>>(LAST_USED)) ?? {};
  const ids = pickDaily(questions, date, lastUsed).map((q) => q.id);
  // NX: if another request picked first, use its set.
  const created = await redis.set(dayKey(date), ids, { nx: true, ex: 60 * 60 * 24 * 60 });
  if (!created) {
    const winner = await redis.get<string[]>(dayKey(date));
    if (Array.isArray(winner)) return winner;
  }
  if (ids.length) await redis.hset(LAST_USED, Object.fromEntries(ids.map((id) => [id, date])));
  return ids;
}

/**
 * Drop today's set so the next visit picks a fresh one (admin action). The
 * replaced questions stay marked as used today, so different ones are chosen.
 */
export async function regenerateDaily(): Promise<void> {
  const redis = redisClient();
  if (!redis) {
    memorySalt.set(istanbulDate(), (memorySalt.get(istanbulDate()) ?? 0) + 1);
    return;
  }
  await redis.del(dayKey(istanbulDate()));
}

export async function getDaily(questions: Question[]): Promise<Daily> {
  const date = istanbulDate();
  const ids = await dailyIds(questions, date);
  const byId = new Map(questions.map((q) => [q.id, q]));
  // A question deleted during the day is replaced by another for its letter.
  const fallback = pickDaily(questions, date);
  const chosen = ids.map((id) => byId.get(id)).filter((q): q is Question => !!q);
  const letters = new Set(chosen.map((q) => q.letter));
  for (const q of fallback) if (!letters.has(q.letter)) chosen.push(q);
  chosen.sort((a, b) => a.letter.localeCompare(b.letter));
  return { date, number: dailyNumber(date), questions: chosen };
}
