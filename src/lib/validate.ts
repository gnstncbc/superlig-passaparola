import { LETTERS, type Question } from "./types";

export function parseQuestion(input: unknown, id?: string): Question | string {
  if (!input || typeof input !== "object") return "Geçersiz veri";
  const o = input as Record<string, unknown>;
  const letter = String(o.letter ?? "").toUpperCase().trim();
  const rule = o.rule === "contains" ? "contains" : "starts";
  const category = o.category === "general" ? "general" : "superlig";
  const question = String(o.question ?? "").trim();
  const answer = String(o.answer ?? "").trim();
  const alternates = Array.isArray(o.alternates)
    ? o.alternates.map((a) => String(a).trim()).filter(Boolean).slice(0, 30)
    : [];
  if (!LETTERS.includes(letter)) return "Harf A–Z arasında olmalı";
  if (!question) return "Soru boş olamaz";
  if (!answer) return "Cevap boş olamaz";
  if (question.length > 500 || answer.length > 100) return "Metin çok uzun";
  const finalId = id ?? (typeof o.id === "string" && o.id.trim() ? o.id.trim() : crypto.randomUUID());
  return { id: finalId, letter, rule, category, question, answer, alternates };
}
