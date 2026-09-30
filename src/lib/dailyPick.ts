import { normalize } from "./match";
import { LETTERS, type Question } from "./types";

/** A general-football question only comes up once every Süper Lig question
 *  of its letter has been used within this many days. */
export const GENERAL_PENALTY_DAYS = 21;
/** At most this many general-football questions in one daily puzzle. */
export const MAX_GENERAL_PER_DAY = 2;

const DAY_MS = 86_400_000;

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * One question per letter for the given day. Süper Lig questions come first,
 * least recently used (or never used) first; ties are broken by a hash of the
 * date so the pick is stable but not alphabetical. The same answer never
 * appears twice in one puzzle.
 */
export function pickDaily(
  questions: Question[],
  date: string,
  lastUsed: Record<string, string> = {},
): Question[] {
  const today = Date.parse(date);
  const score = (q: Question) => {
    const used = lastUsed[q.id];
    const age = used ? (today - Date.parse(used)) / DAY_MS : Infinity;
    if (q.category !== "general") return age;
    return used ? age - GENERAL_PENALTY_DAYS : GENERAL_PENALTY_DAYS;
  };

  const ranked = LETTERS.map((letter) =>
    questions
      .filter((q) => q.letter === letter)
      .sort((a, b) => score(b) - score(a) || hash(`${date}:${a.id}`) - hash(`${date}:${b.id}`)),
  ).filter((pool) => pool.length);

  // Letters where a general question beats the best Süper Lig one; only the
  // strongest few may use it (letters without Süper Lig questions always can).
  const isGeneral = (q: Question) => q.category === "general";
  const wants = ranked
    .map((pool, i) => {
      const el = pool.find((q) => !isGeneral(q));
      const gen = pool.find(isGeneral);
      return { i, gain: !el ? Infinity : gen ? score(gen) - score(el) : -Infinity };
    })
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  const allowGeneral = new Set(
    wants.filter((x, n) => x.gain === Infinity || n < MAX_GENERAL_PER_DAY).map((x) => x.i),
  );

  const picked: Question[] = [];
  const answers = new Set<string>();
  ranked.forEach((pool, i) => {
    const ok = (q: Question) => allowGeneral.has(i) || !isGeneral(q);
    const q =
      pool.find((x) => ok(x) && !answers.has(normalize(x.answer))) ?? pool.find(ok) ?? pool[0];
    answers.add(normalize(q.answer));
    picked.push(q);
  });
  return picked;
}
