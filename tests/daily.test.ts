import { describe, expect, it } from "vitest";
import seed from "@/data/seed-questions.json";
import { addDays, dailyNumber, istanbulDate, msUntilNextDay } from "@/lib/day";
import { pickDaily } from "@/lib/dailyPick";
import { dailyStreaks, type GameRecord } from "@/lib/game";
import type { Question } from "@/lib/types";

const questions = seed as Question[];

describe("day helpers", () => {
  it("uses Istanbul midnight", () => {
    expect(istanbulDate(Date.parse("2026-09-30T20:59:00Z"))).toBe("2026-09-30");
    expect(istanbulDate(Date.parse("2026-09-30T21:00:00Z"))).toBe("2026-10-01");
    expect(msUntilNextDay(Date.parse("2026-09-30T20:59:00Z"))).toBe(60_000);
  });
  it("numbers puzzles from the start date", () => {
    expect(dailyNumber("2026-09-30")).toBe(1);
    expect(dailyNumber("2026-10-10")).toBe(11);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("pickDaily", () => {
  it("is deterministic and picks one per letter", () => {
    const a = pickDaily(questions, "2026-10-01");
    expect(a.map((q) => q.id)).toEqual(pickDaily(questions, "2026-10-01").map((q) => q.id));
    expect(new Set(a.map((q) => q.letter)).size).toBe(26);
    expect(a.map((q) => q.letter).join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  });

  it("rotates through the pool before repeating", () => {
    const lastUsed: Record<string, string> = {};
    const seen = new Map<string, Set<string>>();
    let date = "2026-10-01";
    const poolSize = (l: string) => questions.filter((q) => q.letter === l && q.category !== "general").length;
    for (let d = 0; d < 7; d++) {
      for (const q of pickDaily(questions, date, lastUsed)) {
        const set = seen.get(q.letter) ?? new Set();
        // no Süper Lig repeat until every Süper Lig question of the letter was used
        if (q.category !== "general" && set.size < poolSize(q.letter)) expect(set.has(q.id)).toBe(false);
        if (q.category !== "general") set.add(q.id);
        seen.set(q.letter, set);
        lastUsed[q.id] = date;
      }
      date = addDays(date, 1);
    }
  });
});

describe("pickDaily categories", () => {
  it("caps general questions per day", () => {
    const lastUsed: Record<string, string> = {};
    let date = "2026-10-01";
    for (let d = 0; d < 60; d++) {
      const day = pickDaily(questions, date, lastUsed);
      expect(day.filter((q) => q.category === "general").length).toBeLessThanOrEqual(2);
      day.forEach((q) => (lastUsed[q.id] = date));
      date = addDays(date, 1);
    }
  });

  it("prefers Süper Lig questions and never repeats an answer in one puzzle", () => {
    const lastUsed: Record<string, string> = {};
    let date = "2026-10-01";
    for (let d = 0; d < 30; d++) {
      const day = pickDaily(questions, date, lastUsed);
      const answers = day.map((q) => q.answer);
      expect(new Set(answers).size).toBe(answers.length);
      for (const q of day) {
        if (q.category === "general") {
          // only when every Süper Lig question of the letter was used recently
          const el = questions.filter((x) => x.letter === q.letter && x.category !== "general");
          for (const x of el) {
            expect(lastUsed[x.id]).toBeDefined();
            expect(Date.parse(date) - Date.parse(lastUsed[x.id])).toBeLessThan(21 * 86_400_000);
          }
        }
        lastUsed[q.id] = date;
      }
      date = addDays(date, 1);
    }
  });

  it("uses no general questions on the first day", () => {
    expect(pickDaily(questions, "2026-10-01").filter((q) => q.category === "general")).toEqual([]);
  });
});

describe("dailyStreaks", () => {
  const g = (date: string): GameRecord => ({ at: 0, correct: 10, wrong: 2, total: 26, ms: 1, mode: "daily", date });
  it("counts consecutive days", () => {
    const h = [g("2026-10-01"), g("2026-10-02"), g("2026-10-03"), g("2026-10-05"), g("2026-10-06")];
    expect(dailyStreaks(h, "2026-10-06")).toEqual({ current: 2, max: 3 });
    expect(dailyStreaks(h, "2026-10-07")).toEqual({ current: 2, max: 3 });
    expect(dailyStreaks(h, "2026-10-08")).toEqual({ current: 0, max: 3 });
    expect(dailyStreaks([], "2026-10-08")).toEqual({ current: 0, max: 0 });
  });
});
