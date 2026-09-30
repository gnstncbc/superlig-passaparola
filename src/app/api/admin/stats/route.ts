import { isAdmin } from "@/lib/auth";
import { dismissGuess, readStatsReport, resetStatsReport } from "@/lib/results";

const unauthorized = () => Response.json({ error: "Yetkisiz" }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(await readStatsReport());
}

// { id, guess } forgets one recorded wrong guess.
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string" || typeof body?.guess !== "string") {
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  await dismissGuess(body.id, body.guess);
  return Response.json({ ok: true });
}

export async function DELETE() {
  if (!(await isAdmin())) return unauthorized();
  await resetStatsReport();
  return Response.json({ ok: true });
}
