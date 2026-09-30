import { LETTERS, type Question } from "./types";

export type Status = "pending" | "current" | "correct" | "wrong" | "passed";

export interface Slot {
  q: Question;
  status: Exclude<Status, "current">;
  guess?: string;
}

export const GAME_MS = 4 * 60 * 1000;

const SEEN_KEY = "sl:seen";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

// One random question per letter, preferring ones not played recently.
export function buildRound(questions: Question[]): Slot[] {
  const seen = readSeen();
  const slots: Slot[] = [];
  for (const letter of LETTERS) {
    const pool = questions.filter((q) => q.letter === letter);
    if (!pool.length) continue;
    const fresh = pool.filter((q) => !seen.has(q.id));
    const from = fresh.length ? fresh : pool;
    if (!fresh.length) pool.forEach((q) => seen.delete(q.id));
    const q = from[Math.floor(Math.random() * from.length)];
    seen.add(q.id);
    slots.push({ q, status: "pending" });
  }
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
  return slots;
}

// Next unresolved slot after `from`, wrapping around; -1 when none left.
export function nextOpen(slots: Slot[], from: number): number {
  const n = slots.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (slots[i].status === "pending" || slots[i].status === "passed") return i;
  }
  return -1;
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type Mode = "daily" | "free";

export interface GameRecord {
  at: number;
  correct: number;
  wrong: number;
  total: number;
  ms: number;
  /** Missing on games recorded before daily mode existed (those were free games). */
  mode?: Mode;
  /** Istanbul date of the daily puzzle. */
  date?: string;
  number?: number;
}

export interface Stats {
  /** Free-mode totals (kept separately so games from before history existed still count). */
  played: number;
  best: number;
  totalCorrect: number;
  history: GameRecord[];
}

const STATS_KEY = "sl:stats";
const HISTORY_LIMIT = 400;

const emptyStats = (): Stats => ({ played: 0, best: 0, totalCorrect: 0, history: [] });

export function readStats(): Stats {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) ?? "null");
    if (s && typeof s.played === "number") {
      return { ...emptyStats(), ...s, history: Array.isArray(s.history) ? s.history : [] };
    }
  } catch {}
  return emptyStats();
}

function writeStats(s: Stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {}
}

export function recordGame(game: Omit<GameRecord, "at">): Stats {
  const s = readStats();
  const entry = { ...game, at: Date.now() };
  if (game.mode === "daily" && s.history.some((g) => g.mode === "daily" && g.date === game.date)) {
    return s; // one result per daily puzzle
  }
  const free = game.mode !== "daily";
  const next: Stats = {
    played: s.played + (free ? 1 : 0),
    best: free ? Math.max(s.best, game.correct) : s.best,
    totalCorrect: s.totalCorrect + (free ? game.correct : 0),
    history: [...s.history, entry].slice(-HISTORY_LIMIT),
  };
  writeStats(next);
  return next;
}

export function resetStats(): Stats {
  const s = emptyStats();
  writeStats(s);
  return s;
}

export const gameMode = (g: GameRecord): Mode => g.mode ?? "free";

/** Current and longest run of consecutive days with a finished daily puzzle. */
export function dailyStreaks(history: GameRecord[], today: string): { current: number; max: number } {
  const days = [...new Set(history.filter((g) => g.mode === "daily" && g.date).map((g) => g.date!))].sort();
  const DAY = 86_400_000;
  let max = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i && Date.parse(days[i]) - Date.parse(days[i - 1]) === DAY ? run + 1 : 1;
    max = Math.max(max, run);
  }
  let current = 0;
  const last = days[days.length - 1];
  if (last && Date.parse(today) - Date.parse(last) <= DAY) {
    current = 1;
    for (let i = days.length - 1; i > 0 && Date.parse(days[i]) - Date.parse(days[i - 1]) === DAY; i--) current++;
  }
  return { current, max };
}

/* ---- daily puzzle progress (survives reloads, one attempt per day) ---- */

export interface DailyProgress {
  date: string;
  slots: { id: string; status: Slot["status"]; guess?: string }[];
  current: number;
  remaining: number;
  finished: boolean;
}

const DAILY_KEY = "sl:daily";

export function readDailyProgress(date: string): DailyProgress | null {
  try {
    const p = JSON.parse(localStorage.getItem(DAILY_KEY) ?? "null");
    if (p && p.date === date && Array.isArray(p.slots)) return p;
  } catch {}
  return null;
}

export function saveDailyProgress(p: DailyProgress) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(p));
  } catch {}
}

/** Rebuild slots from saved progress against today's questions. */
export function restoreSlots(questions: Question[], progress: DailyProgress): Slot[] {
  const saved = new Map(progress.slots.map((x) => [x.id, x]));
  return questions.map((q) => {
    const x = saved.get(q.id);
    return x ? { q, status: x.status, guess: x.guess } : { q, status: "pending" };
  });
}
