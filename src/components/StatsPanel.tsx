import { useState } from "react";
import { dailyStreaks, formatTime, gameMode, type Mode, type Stats } from "@/lib/game";
import Num from "./Num";
import s from "./StatsPanel.module.css";

const BUCKETS = [
  { label: "0–5", min: 0, max: 5 },
  { label: "6–10", min: 6, max: 10 },
  { label: "11–15", min: 11, max: 15 },
  { label: "16–20", min: 16, max: 20 },
  { label: "21–26", min: 21, max: 26 },
];

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function StatsPanel({
  stats,
  onReset,
  initialMode = "daily",
  today,
}: {
  stats: Stats;
  onReset: () => void;
  initialMode?: Mode;
  today: string;
}) {
  const [tab, setTab] = useState<Mode>(initialMode);
  const history = stats.history.filter((g) => gameMode(g) === tab);
  const last = history[history.length - 1];
  const answered = history.reduce((n, g) => n + g.correct + g.wrong, 0);
  const correct = history.reduce((n, g) => n + g.correct, 0);
  const accuracy = answered ? Math.round((correct / answered) * 100) : null;
  const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const counts = BUCKETS.map((b) => history.filter((g) => g.correct >= b.min && g.correct <= b.max).length);
  const maxCount = Math.max(1, ...counts);
  const lastBucket = last ? BUCKETS.findIndex((b) => last.correct >= b.min && last.correct <= b.max) : -1;

  const streaks = dailyStreaks(stats.history, today);
  const played = tab === "daily" ? history.length : stats.played;
  const tiles =
    tab === "daily"
      ? [
          { v: String(history.length), l: "Oynanan" },
          { v: String(streaks.current), l: "Seri" },
          { v: String(streaks.max), l: "En uzun seri" },
          { v: history.length ? fmt(correct / history.length) : "–", l: "Ortalama" },
        ]
      : [
          { v: String(stats.played), l: "Oyun" },
          { v: String(stats.best), l: "En iyi" },
          { v: stats.played ? fmt(stats.totalCorrect / stats.played) : "–", l: "Ortalama" },
          { v: accuracy === null ? "–" : `%${accuracy}`, l: "İsabet" },
        ];

  return (
    <div className={s.panel}>
      <h2>İstatistikler</h2>

      <div className={s.tabs} role="tablist">
        {(["daily", "free"] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={tab === m} className={tab === m ? s.tabOn : ""} onClick={() => setTab(m)}>
            {m === "daily" ? "Günlük" : "Serbest"}
          </button>
        ))}
      </div>

      <div className={s.tiles}>
        {tiles.map((x) => (
          <div key={x.l}>
            <strong>
              <Num value={x.v} />
            </strong>
            <span>{x.l}</span>
          </div>
        ))}
      </div>

      {played === 0 ? (
        <p className={s.empty}>
          {tab === "daily"
            ? "Henüz günlük bulmaca çözmedin. Her gün yeni bir tane var."
            : "Henüz serbest modda oynamadın."}
        </p>
      ) : history.length === 0 ? (
        <p className={s.empty}>Ayrıntılı geçmiş bir sonraki oyunundan itibaren tutulacak.</p>
      ) : (
        <>
          <h3>Doğru sayısı dağılımı</h3>
          <div className={s.bars} role="table" aria-label="Doğru sayısına göre oyun dağılımı">
            {BUCKETS.map((b, i) => (
              <div key={b.label} className={s.barRow} role="row" title={`${b.label} doğru: ${counts[i]} oyun`}>
                <span className={s.barLabel} role="rowheader">{b.label}</span>
                <span className={s.barTrack} role="cell">
                  <span
                    className={`${s.bar} ${i === lastBucket ? s.barLast : ""}`}
                    style={{ width: `${Math.max(8, (counts[i] / maxCount) * 100)}%` }}
                  >
                    <Num value={counts[i]} />
                  </span>
                </span>
              </div>
            ))}
          </div>

          <h3>Son oyunlar</h3>
          <ol className={s.recent}>
            {history.slice(-10).reverse().map((g) => (
              <li key={g.at}>
                <span className={s.when}>
                  {tab === "daily" && g.number ? `#${g.number} · ` : ""}
                  {dateFmt.format(g.at)}
                </span>
                <span className={s.score}>
                  <b>
                    <Num value={g.correct} />
                  </b>
                  <Num value={`/${g.total}`} />
                </span>
                <span className={s.meta}>
                  <Num value={g.wrong} /> yanlış · <Num value={formatTime(g.ms)} />
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {stats.played + stats.history.length > 0 && (
        <button className={s.reset} onClick={onReset}>İstatistikleri sıfırla</button>
      )}
    </div>
  );
}
