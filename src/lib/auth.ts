import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "pp_admin";

export function adminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  // Local convenience only; production requires ADMIN_PASSWORD.
  return process.env.NODE_ENV === "production" ? null : "admin";
}

function sessionToken(pw: string) {
  return createHmac("sha256", pw).update("pp-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): string | null {
  const pw = adminPassword();
  if (!pw || !safeEqual(input, pw)) return null;
  return sessionToken(pw);
}

export async function isAdmin(): Promise<boolean> {
  const pw = adminPassword();
  if (!pw) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  return !!token && safeEqual(token, sessionToken(pw));
}
