import { isAdmin } from "@/lib/auth";
import { deleteQuestion, saveQuestion } from "@/lib/store";
import { parseQuestion } from "@/lib/validate";

const unauthorized = () => Response.json({ error: "Yetkisiz" }, { status: 401 });

export async function PUT(req: Request, ctx: RouteContext<"/api/admin/questions/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const parsed = parseQuestion(await req.json().catch(() => null), id);
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  await saveQuestion(parsed);
  return Response.json(parsed);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/questions/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  await deleteQuestion(id);
  return Response.json({ ok: true });
}
