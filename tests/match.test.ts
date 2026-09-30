import { describe, expect, it } from "vitest";
import { fitsLetter, isCorrect, normalize } from "@/lib/match";
import seed from "@/data/seed-questions.json";

describe("normalize", () => {
  it("folds Turkish and Balkan characters", () => {
    expect(normalize("Dončić")).toBe("doncic");
    expect(normalize("Fenerbahçe İstanbul")).toBe("fenerbahce istanbul");
    expect(normalize("Šarūnas Jasikevičius")).toBe("sarunas jasikevicius");
    expect(normalize("Hayes-Davis")).toBe("hayes davis");
  });
});

describe("isCorrect", () => {
  const cases: [string, string, string[], boolean][] = [
    ["Vassilis Spanoulis", "Vassilis Spanoulis", [], true],
    ["spanoulis", "Vassilis Spanoulis", [], true],
    ["Spanulis", "Vassilis Spanoulis", [], true],
    ["spanoul", "Vassilis Spanoulis", [], true],
    ["Doncic", "Luka Dončić", [], true],
    ["dönçiç", "Luka Dončić", [], true],
    ["jasikevicus", "Šarūnas Jasikevičius", [], true],
    ["yasikevicius", "Šarūnas Jasikevičius", [], true],
    ["Diamantidi", "Dimitris Diamantidis", [], true],
    ["efes", "Anadolu Efes", [], true],
    ["fenerbahce", "Fenerbahçe", [], true],
    ["fener", "Fenerbahçe", ["Fener"], true],
    ["tel aviv", "Maccabi Tel Aviv", [], true],
    ["maccabi", "Maccabi Tel Aviv", ["Maccabi"], true],
    ["etihad", "Etihad Arena", [], true],
    ["olympiakos", "Olympiacos", [], true],
    ["olimpiakos", "Olympiacos", [], true],
    ["nun", "Kendrick Nunn", [], true],
    ["hayes", "Nigel Hayes-Davis", ["Hayes"], true],
    ["de colo", "Nando De Colo", [], true],
    ["decolo", "Nando De Colo", [], true],
    // should be rejected
    ["sergio", "Sergio Llull", [], false],
    ["real", "Real Madrid", [], false],
    ["micic", "Nikola Mirotić", [], false],
    ["larkin", "Vasilije Micić", [], false],
    ["ab", "Abu Dhabi", [], false],
    ["", "Berlin", [], false],
    ["barcelona", "Berlin", [], false],
    ["panathinaikos", "Olympiacos", [], false],
  ];
  it.each(cases)("%s vs %s", (guess, answer, alts, expected) => {
    expect(isCorrect(guess, answer, alts)).toBe(expected);
  });

  it("accepts every seed answer and its alternates", () => {
    for (const q of seed) {
      expect(isCorrect(q.answer, q.answer, q.alternates)).toBe(true);
      for (const a of q.alternates) expect(isCorrect(a, q.answer, q.alternates)).toBe(true);
    }
  });
});

describe("seed data", () => {
  it("has questions for every letter and answers fit their rule", () => {
    const letters = new Set(seed.map((q) => q.letter));
    expect(letters.size).toBe(26);
    for (const q of seed) {
      expect(fitsLetter(q.answer, q.letter, q.rule as "starts" | "contains"), q.answer).toBe(true);
    }
  });

  it("has unique ids", () => {
    expect(new Set(seed.map((q) => q.id)).size).toBe(seed.length);
  });
});

describe("edge cases", () => {
  it.each([
    ["rodrigez", "Sergio Rodríguez", true],
    ["sergio", "Sergio Rodríguez", false],
    ["mirotic", "Vasilije Micić", false],
    ["teodosic", "Miloš Teodosić", true],
    ["obradovic", "Željko Obradović", true],
    ["zalgiris", "Žalgiris", true],
    ["istanbul", "İstanbul", true],
    ["koln", "Köln", true],
    ["belgrat", "Belgrad", true],
    ["luka doncic", "Luka Dončić", true],
    ["kaunas", "Kaunas", true],
    ["kazan", "Kaunas", false],
  ])("%s vs %s", (guess, answer, expected) => {
    expect(isCorrect(guess as string, answer as string)).toBe(expected);
  });
});

describe("closeness", () => {
  it("ranks near misses above unrelated guesses", async () => {
    const { closeness } = await import("@/lib/match");
    expect(closeness("spanolis vasilis", "Vassilis Spanoulis")).toBeGreaterThan(0.8);
    expect(closeness("mirotic", "Vasilije Micić")).toBeLessThan(0.6);
    expect(closeness("jasikevicius", "Šarūnas Jasikevičius")).toBe(1);
    expect(closeness("adanolu", "Anadolu Efes")).toBeGreaterThan(0.6);
    expect(closeness("galatasaray", "Anadolu Efes")).toBeLessThan(0.55);
  });
});

describe("fill-in-the-blank questions", () => {
  it("accepts the blanked word on its own", () => {
    const q = "Galatasaray'ın 2017-2021 arası Faslı ofansif orta sahası ___ Belhanda.";
    expect(isCorrect("Younes", "Younès Belhanda", ["Belhanda"], q)).toBe(true);
    expect(isCorrect("younès", "Younès Belhanda", [], q)).toBe(true);
    expect(isCorrect("Belhanda", "Younès Belhanda", [], q)).toBe(true);
    expect(isCorrect("Mike", "Mike James", [], "AS Monaco'nun yıldızı Mike ___.")).toBe(false);
    expect(isCorrect("James", "Mike James", [], "AS Monaco'nun yıldızı Mike ___.")).toBe(true);
  });

  it("does not accept a first name alone without a blank", () => {
    expect(isCorrect("Younes", "Younès Belhanda", [], "Galatasaray'ın Faslı orta sahası.")).toBe(false);
  });

  it("every seed question with a blank accepts what the blank asks for", () => {
    for (const q of seed) {
      if (!q.question.includes("___")) continue;
      const shown = new Set(normalize(q.question).split(" "));
      const missing = normalize(q.answer).split(" ").filter((w) => w && !shown.has(w)).join(" ");
      if (missing.replace(/ /g, "").length < 3) continue;
      expect(isCorrect(missing, q.answer, q.alternates, q.question), `${q.id}: ${missing}`).toBe(true);
    }
  });

  it("no question gives its answer away", () => {
    for (const q of seed) {
      const text = ` ${normalize(q.question)} `;
      const words = normalize(q.answer).split(" ").filter((w) => w.length >= 3);
      expect(words.length > 0 && words.every((w) => text.includes(` ${w} `)), `${q.id}: ${q.answer}`).toBe(false);
    }
  });
});
