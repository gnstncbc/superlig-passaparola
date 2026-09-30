export type Rule = "starts" | "contains";
export type Category = "superlig" | "general";

export interface Question {
  id: string;
  letter: string;
  rule: Rule;
  category: Category;
  question: string;
  answer: string;
  alternates: string[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  superlig: "Süper Lig",
  general: "Genel futbol",
};

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function ruleLabel(letter: string, rule: Rule) {
  return rule === "starts" ? `${letter} ile başlar` : `İçinde ${letter} geçer`;
}
