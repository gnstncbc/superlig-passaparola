"use client";

import { useMemo } from "react";
import { closeness, isCorrect } from "@/lib/match";
import type { Question } from "@/lib/types";
import type { QuestionStats, StatsReport } from "@/lib/results";
import s from "./Admin.module.css";

const MIN_SHOWN = 5;

export const shownCount = (st: QuestionStats) => st.c + st.w + st.p + st.n;
const pct = (n: number) => `%${Math.round(n * 100)}`;

export function statsLine(st: QuestionStats | undefined) {
  if (!st || !shownCount(st)) return "Henüz oynanmadı";
  const n = shownCount(st);
  return `${n} kez soruldu · ${pct(st.c / n)} doğru · ${pct(st.w / n)} yanlış · ${pct((st.p + st.n) / n)} boş`;
}

export default function AdminStats({
  report,
  questions,
  busy,
  onEdit,
  onAccept,
  onDismiss,
  onRefresh,
  onReset,
}: {
  report: StatsReport | null;
  questions: Question[];
  busy: boolean;
  onEdit: (q: Question) => void;
  onAccept: (q: Question, guess: string) => void;
  onDismiss: (q: Question, guess: string) => void;
  onRefresh: () => void;
  onReset: () => void;
}) {
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const nearMisses = useMemo(() => {
    if (!report) return [];
    const rows: { q: Question; guess: string; count: number; score: number }[] = [];
    for (const [id, guesses] of Object.entries(report.wrong)) {
      const q = byId.get(id);
      if (!q) continue;
      for (const { guess, count } of guesses) {
        if (isCorrect(guess, q.answer, q.alternates, q.question)) continue; // already accepted now
        const score = closeness(guess, q.answer, q.alternates);
        if (score >= 0.55) rows.push({ q, guess, count, score });
      }
    }
    return rows.sort((a, b) => b.count - a.count || b.score - a.score).slice(0, 60);
  }, [report, byId]);

  const rated = useMemo(() => {
    if (!report) return [];
    return questions
      .map((q) => ({ q, st: report.stats[q.id] }))
      .filter((x): x is { q: Question; st: QuestionStats } => !!x.st && shownCount(x.st) >= MIN_SHOWN);
  }, [report, questions]);

  const hardest = [...rated].sort((a, b) => a.st.c / shownCount(a.st) - b.st.c / shownCount(b.st)).slice(0, 15);
  const skipped = [...rated]
    .sort((a, b) => (b.st.p + b.st.n) / shownCount(b.st) - (a.st.p + a.st.n) / shownCount(a.st))
    .slice(0, 15);

  if (!report) return <p className={s.empty}>Yükleniyor…</p>;

  const Row = ({ q, st, metric }: { q: Question; st: QuestionStats; metric: string }) => (
    <li className={s.item}>
      <button className={s.itemMain} onClick={() => onEdit(q)}>
        <span className={s.badge}>{q.letter}</span>
        <span className={s.itemText}>
          <span className={s.itemQ}>{q.question}</span>
          <span className={s.itemA}>{q.answer}</span>
          <span className={s.itemRule}>
            {metric} · {shownCount(st)} kez
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <div className={s.statsView}>
      <div className={s.statsHead}>
        <p>
          <strong>{report.games.daily + report.games.free}</strong> oyun kaydedildi ({report.games.daily} günlük,{" "}
          {report.games.free} serbest)
        </p>
        <div className={s.topActions}>
          <button className={s.ghostSm} onClick={onRefresh} disabled={busy}>Yenile</button>
          <button className={s.ghostSm} onClick={onReset} disabled={busy}>Sıfırla</button>
        </div>
      </div>

      <h2 className={s.sectionTitle}>Doğruya yakın yanlış cevaplar</h2>
      <p className={s.hint}>
        Oyuncuların yazıp reddedilen ama doğru cevaba benzeyen cevapları. Doğruysa “Kabul et” alternatif cevap olarak
        ekler.
      </p>
      <ul className={s.list}>
        {nearMisses.map(({ q, guess, count }) => (
          <li key={`${q.id}|${guess}`} className={s.missRow}>
            <span className={s.badge}>{q.letter}</span>
            <div className={s.itemText}>
              <span className={s.itemA}>
                “{guess}” <em>× {count}</em>
              </span>
              <span className={s.itemQ}>Doğru cevap: {q.answer}</span>
            </div>
            <div className={s.missActions}>
              <button className={s.primarySm} onClick={() => onAccept(q, guess)} disabled={busy}>Kabul et</button>
              <button className={s.ghostSm} onClick={() => onDismiss(q, guess)} disabled={busy}>Yok say</button>
            </div>
          </li>
        ))}
        {!nearMisses.length && <li className={s.empty}>Şimdilik yok.</li>}
      </ul>

      <h2 className={s.sectionTitle}>En zor sorular</h2>
      <p className={s.hint}>En az {MIN_SHOWN} kez sorulmuş sorular, doğru oranına göre.</p>
      <ul className={s.list}>
        {hardest.map(({ q, st }) => (
          <Row key={q.id} q={q} st={st} metric={`${pct(st.c / shownCount(st))} doğru`} />
        ))}
        {!hardest.length && <li className={s.empty}>Yeterli veri yok.</li>}
      </ul>

      <h2 className={s.sectionTitle}>En çok boş bırakılanlar</h2>
      <p className={s.hint}>Pas geçilip cevaplanmayan ya da süre bittiği için sıra gelmeyen sorular.</p>
      <ul className={s.list}>
        {skipped.map(({ q, st }) => (
          <Row key={q.id} q={q} st={st} metric={`${pct((st.p + st.n) / shownCount(st))} boş`} />
        ))}
        {!skipped.length && <li className={s.empty}>Yeterli veri yok.</li>}
      </ul>
    </div>
  );
}
