import { checkPassword, COOKIE, adminPassword } from "@/lib/auth";

export async function POST(req: Request) {
  if (!adminPassword()) {
    return Response.json({ error: "ADMIN_PASSWORD tanımlı değil" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const token = checkPassword(String(body?.password ?? ""));
  if (!token) {
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "Şifre yanlış" }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return res;
}
