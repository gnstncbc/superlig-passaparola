"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import s from "./Admin.module.css";

export default function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error ?? "Giriş başarısız");
  };

  return (
    <div className={s.loginWrap}>
      <form className={s.loginCard} onSubmit={submit}>
        <h1 className={s.brand}>
          Passaparola <span>Admin</span>
        </h1>
        {!configured ? (
          <p className={s.warn}>
            <strong>ADMIN_PASSWORD</strong> ortam değişkeni tanımlı değil. Vercel &gt; Settings &gt; Environment
            Variables kısmından ekleyip yeniden deploy et.
          </p>
        ) : (
          <>
            <div className={s.passwordWrap}>
              <input
                className={s.input}
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
                autoFocus
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={s.eye}
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
                aria-pressed={visible}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path
                    d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  {visible && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
                </svg>
              </button>
            </div>
            {error && <p className={s.error}>{error}</p>}
            <button className={s.primary} disabled={busy || !password}>
              {busy ? "…" : "Giriş"}
            </button>
          </>
        )}
        <a className={s.link} href="/">← Oyuna dön</a>
      </form>
    </div>
  );
}
