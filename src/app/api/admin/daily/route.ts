import { isAdmin } from "@/lib/auth";
import { regenerateDaily } from "@/lib/daily";

// Re-pick today's puzzle (e.g. after changing questions before launch).
export async function POST() {
  if (!(await isAdmin())) return Response.json({ error: "Yetkisiz" }, { status: 401 });
  await regenerateDaily();
  return Response.json({ ok: true });
}
