import { allowResults, recordResults, type ResultItem, type ResultStatus } from "@/lib/results";

const STATUSES = new Set<ResultStatus>(["correct", "wrong", "passed", "pending"]);

// Anonymous per-question outcomes sent when a game ends.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const raw = body?.results;
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const items: ResultItem[] = [];
  for (const r of raw) {
    if (!r || typeof r.id !== "string" || !/^[\w-]{1,64}$/.test(r.id) || !STATUSES.has(r.status)) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    items.push({ id: r.id, status: r.status, guess: typeof r.guess === "string" ? r.guess.slice(0, 80) : undefined });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!(await allowResults(ip))) return Response.json({ error: "rate" }, { status: 429 });
  await recordResults(items, body.mode === "daily" ? "daily" : "free");
  return Response.json({ ok: true });
}
