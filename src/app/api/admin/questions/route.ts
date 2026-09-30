import { isAdmin } from "@/lib/auth";
import { listQuestions, replaceAll, saveQuestion, defaultQuestions } from "@/lib/store";
import { parseQuestion } from "@/lib/validate";
import type { Question } from "@/lib/types";

const unauthorized = () => Response.json({ error: "Yetkisiz" }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(await listQuestions());
}

// Create one question.
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = parseQuestion(await req.json().catch(() => null), crypto.randomUUID());
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  await saveQuestion(parsed);
  return Response.json(parsed);
}

// Replace the whole set (JSON import or restoring the defaults).
export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await req.json().catch(() => null);
  const raw: unknown[] | null = body?.reset ? defaultQuestions() : Array.isArray(body) ? body : null;
  if (!raw) return Response.json({ error: "JSON bir dizi olmalı" }, { status: 400 });
  const list: Question[] = [];
  const ids = new Set<string>();
  for (const [i, item] of raw.entries()) {
    const parsed = parseQuestion(item);
    if (typeof parsed === "string") {
      return Response.json({ error: `${i + 1}. soru: ${parsed}` }, { status: 400 });
    }
    if (ids.has(parsed.id)) parsed.id = crypto.randomUUID();
    ids.add(parsed.id);
    list.push(parsed);
  }
  await replaceAll(list);
  return Response.json(await listQuestions());
}
