// Tolerant answer matching: ignores case, accents and punctuation, accepts
// small typos, surnames / last words of multi-word answers and slightly
// incomplete (prefix) answers.

const CHAR_MAP: Record<string, string> = {
  ı: "i", İ: "i", I: "i", ğ: "g", ş: "s", ç: "c", ö: "o", ü: "u",
  đ: "dj", ł: "l", ø: "o", æ: "ae", œ: "oe", ß: "ss",
};

const STOPWORDS = new Set([
  "fc", "fk", "jk", "bc", "kk", "bk", "sk", "cf", "club", "basket", "basketball", "the",
  "arena", "center", "centre", "hall", "salonu",
]);

export function normalize(input: string): string {
  return input
    .replace(/[ıİIğşçöüđłøæœß]/g, (c) => CHAR_MAP[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Rough phonetic folding so "Dontchich" ≈ "Doncic", "Yasikevicius" ≈ "Jasikevicius".
function phonetic(s: string): string {
  return s
    .replace(/tsch|tch|ch|ts/g, "c")
    .replace(/sh|sz/g, "s")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/ck|q/g, "k")
    .replace(/w/g, "v")
    .replace(/y/g, "i")
    .replace(/j/g, "i")
    .replace(/z/g, "s")
    .replace(/(.)\1+/g, "$1");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Allowed edits, based on the shorter string so a first name alone
// ("Sergio" vs "Sergio Llull") is not counted as a typo of the full name.
function tolerance(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  if (len <= 2) return 0;
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  if (len <= 12) return 3;
  return 4;
}

// Acceptable forms of one answer: the whole thing plus every word-suffix
// ("Vassilis Spanoulis" -> "spanoulis", "Maccabi Tel Aviv" -> "tel aviv", "aviv").
function candidateForms(answer: string): string[] {
  const words = normalize(answer).split(" ").filter(Boolean);
  if (!words.length) return [];
  const content = words.filter((w) => !STOPWORDS.has(w));
  const forms = new Set<string>([words.join("")]);
  const base = content.length ? content : words;
  for (let i = 0; i < base.length; i++) {
    const form = base.slice(i).join("");
    if (form.length >= 3) forms.add(form);
  }
  return [...forms];
}

// Pieces of what the player typed: the whole input plus each run of words,
// so "Vassilis Spanulis" or "Olympiacos Pire" still match.
function inputForms(input: string): string[] {
  const words = normalize(input).split(" ").filter(Boolean).slice(0, 5);
  const forms = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j <= words.length; j++) {
      forms.add(words.slice(i, j).join(""));
    }
  }
  return [...forms].filter((f) => f.length >= 3);
}

function formsMatch(input: string, target: string): boolean {
  if (input === target) return true;
  if (levenshtein(input, target) <= tolerance(input, target)) return true;
  const pi = phonetic(input);
  const pt = phonetic(target);
  if (levenshtein(pi, pt) <= tolerance(pi, pt)) return true;
  // Slightly incomplete answers: a long enough prefix, allowing one typo.
  if (input.length >= 4 && input.length < target.length &&
      input.length >= Math.ceil(target.length * 0.6)) {
    const prefix = target.slice(0, input.length);
    if (levenshtein(input, prefix) <= (input.length >= 7 ? 1 : 0)) return true;
  }
  return false;
}

export function isCorrect(guess: string, answer: string, alternates: string[] = []): boolean {
  const inputs = inputForms(guess);
  if (!inputs.length) return false;
  for (const option of [answer, ...alternates]) {
    for (const target of candidateForms(option)) {
      for (const input of inputs) {
        if (formsMatch(input, target)) return true;
      }
    }
  }
  return false;
}

// Does the answer fit the letter rule? (for people, any word – usually the surname – may start with it)
export function fitsLetter(answer: string, letter: string, rule: "starts" | "contains"): boolean {
  const n = normalize(answer);
  const l = normalize(letter);
  if (!n || !l) return false;
  return rule === "starts" ? n.split(" ").some((w) => w.startsWith(l)) : n.includes(l);
}

/** 0–1 similarity of a rejected guess to the closest accepted form (for admin review). */
export function closeness(guess: string, answer: string, alternates: string[] = []): number {
  const inputs = inputForms(guess);
  let best = 0;
  for (const option of [answer, ...alternates]) {
    // Also compare with single words, so "Adanolu" counts as close to "Anadolu Efes".
    const words = normalize(option).split(" ").filter((w) => w.length >= 3 && !STOPWORDS.has(w));
    for (const target of new Set([...candidateForms(option), ...words])) {
      for (const input of inputs) {
        const len = Math.max(input.length, target.length);
        best = Math.max(best, 1 - levenshtein(phonetic(input), phonetic(target)) / len);
      }
    }
  }
  return best;
}
