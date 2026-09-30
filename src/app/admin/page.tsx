import type { Metadata } from "next";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminPanel from "@/components/admin/AdminPanel";
import { adminPassword, isAdmin } from "@/lib/auth";
import { listQuestions, storeKind } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Passaparola", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminLogin configured={!!adminPassword()} />;
  }
  return <AdminPanel initial={await listQuestions()} storeKind={storeKind} />;
}
