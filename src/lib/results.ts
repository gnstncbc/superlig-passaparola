import "server-only";
import { redisClient } from "./store";

const STATS = "sl:qstats";
const WRONG = "sl:wrong";
const SEP = "|";

export type ResultStatus = "correct" | "wrong" | "passed" | "pending";
export interface ResultItem {
  id: string;
  status: ResultStatus;
  guess?: string;
}

export interface QuestionStats {
  c: number; // correct
  w: number; // wrong
  p: number; // passed and never answered
  n: number; // never reached
}

const FIELD: Record<ResultStatus, keyof QuestionStats> = { correct: "c", wrong: "w", passed: "p", pending: "n" };

// Local fallback when Redis is not configured.
const g = globalThis as unknown as { __ppStats?: Map<string, number>; __ppWrong?: Map<string, number> };
const mem = () => {
  g.__ppStats ??= new Map();
  g.__ppWrong ??= new Map();
  return { stats: g.__ppStats, wrong: g.__ppWrong };
};

export function cleanGuess(guess: string): string {
  return guess.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr").slice(0, 60).replaceAll(SEP, " ");
}

/** Returns false when the caller is over the per-minute limit. */
export async function allowResults(ip: string): Promise<boolean> {
  const redis = redisClient();
  if (!redis) return true;
  const key = `sl:rl:results:${ip}:${Math.floor(Date.now() / 60_000)}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 120);
  return n <= 12;
}

export async function recordResults(items: ResultItem[], mode: "daily" | "free") {
  const incs: [string, string, number][] = [[STATS, `_games${SEP}${mode}`, 1]];
  for (const it of items) {
    incs.push([STATS, `${it.id}${SEP}${FIELD[it.status]}`, 1]);
    const guess = it.status === "wrong" && it.guess ? cleanGuess(it.guess) : "";
    if (guess) incs.push([WRONG, `${it.id}${SEP}${guess}`, 1]);
  }
  const redis = redisClient();
  if (!redis) {
    const m = mem();
    for (const [key, field, by] of incs) {
      const map = key === STATS ? m.stats : m.wrong;
      map.set(field, (map.get(field) ?? 0) + by);
    }
    return;
  }
  const p = redis.pipeline();
  for (const [key, field, by] of incs) p.hincrby(key, field, by);
  await p.exec();
}

export interface StatsReport {
  games: { daily: number; free: number };
  stats: Record<string, QuestionStats>;
  wrong: Record<string, { guess: string; count: number }[]>;
}

export async function readStatsReport(): Promise<StatsReport> {
  const redis = redisClient();
  let statsRaw: Record<string, number>;
  let wrongRaw: Record<string, number>;
  if (redis) {
    const [a, b] = await Promise.all([
      redis.hgetall<Record<string, number>>(STATS),
      redis.hgetall<Record<string, number>>(WRONG),
    ]);
    statsRaw = a ?? {};
    wrongRaw = b ?? {};
  } else {
    statsRaw = Object.fromEntries(mem().stats);
    wrongRaw = Object.fromEntries(mem().wrong);
  }

  const report: StatsReport = { games: { daily: 0, free: 0 }, stats: {}, wrong: {} };
  for (const [field, value] of Object.entries(statsRaw)) {
    const [id, kind] = field.split(SEP);
    const n = Number(value) || 0;
    if (id === "_games") {
      if (kind === "daily" || kind === "free") report.games[kind] = n;
      continue;
    }
    const s = (report.stats[id] ??= { c: 0, w: 0, p: 0, n: 0 });
    if (kind === "c" || kind === "w" || kind === "p" || kind === "n") s[kind] = n;
  }
  for (const [field, value] of Object.entries(wrongRaw)) {
    const i = field.indexOf(SEP);
    const id = field.slice(0, i);
    (report.wrong[id] ??= []).push({ guess: field.slice(i + 1), count: Number(value) || 0 });
  }
  for (const list of Object.values(report.wrong)) list.sort((a, b) => b.count - a.count);
  return report;
}

/** Forget a recorded wrong guess (after adding it as an alternate, or dismissing it). */
export async function dismissGuess(id: string, guess: string) {
  const field = `${id}${SEP}${cleanGuess(guess)}`;
  const redis = redisClient();
  if (!redis) {
    mem().wrong.delete(field);
    return;
  }
  await redis.hdel(WRONG, field);
}

export async function resetStatsReport() {
  const redis = redisClient();
  if (!redis) {
    mem().stats.clear();
    mem().wrong.clear();
    return;
  }
  await redis.del(STATS, WRONG);
}
