"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCorrect } from "@/lib/match";
import type { Question } from "@/lib/types";
import {
  buildRound, formatTime, GAME_MS, nextOpen, readDailyProgress, readStats, recordGame, resetStats,
  restoreSlots, saveDailyProgress, type Mode, type Slot, type Stats,
} from "@/lib/game";
import { istanbulDate, msUntilNextDay } from "@/lib/day";
import Ring from "./Ring";
import Num from "./Num";
import SharePanel from "./SharePanel";
import StatsPanel from "./StatsPanel";
import SettingsPanel from "./SettingsPanel";
import { defaultSettings, readSettings, saveSettings, type Settings } from "@/lib/settings";
import s from "./Game.module.css";

type Phase = "idle" | "playing" | "paused" | "done";

export interface DailyPuzzle {
  date: string;
  number: number;
  questions: Question[];
}

/** Every daily player gets the same clock. */
const DAILY_MS = GAME_MS;

function sendResults(slots: Slot[], mode: Mode) {
  try {
    const body = JSON.stringify({
      mode,
      results: slots.map((x) => ({ id: x.q.id, status: x.status, guess: x.status === "wrong" ? x.guess : undefined })),
    });
    fetch("/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
      () => {},
    );
  } catch {}
}

function Countdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(msUntilNextDay());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  if (left === null) return null;
  const done = left < 1500;
  const sec = Math.floor(left / 1000);
  const hms = [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return (
    <div className={s.countdown}>
      {done ? (
        <button className={s.ghost} onClick={() => window.location.reload()}>Yeni bulmaca hazır →</button>
      ) : (
        <>
          <span>Sonraki bulmaca</span>
          <strong>{hms}</strong>
        </>
      )}
    </div>
  );
}
type Feedback = { kind: "correct" | "wrong" | "passed"; text: string; key: number } | null;

// Keeps --vvh / --vvt in sync with the visual viewport so the layout
// shrinks above the on-screen keyboard (iOS does not resize the page).
function useVisualViewport() {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const update = () => {
      const h = vv ? vv.height : window.innerHeight;
      setHeight(h);
      root.style.setProperty("--vvh", `${h}px`);
      root.style.setProperty("--vvt", `${vv ? vv.offsetTop : 0}px`);
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return height;
}

export default function Game({ questions, daily }: { questions: Question[]; daily: DailyPuzzle }) {
  const viewportHeight = useVisualViewport();
  const [mode, setMode] = useState<Mode>("daily");
  const [phase, setPhase] = useState<Phase>("idle");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [current, setCurrent] = useState(0);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roundMs, setRoundMs] = useState(GAME_MS);
  const [remaining, setRemaining] = useState(GAME_MS);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAction = useRef(0);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;
  const roundMsRef = useRef(roundMs);
  roundMsRef.current = roundMs;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Bring back today's daily puzzle: finished result, or a paused game in progress.
  const loadDaily = useCallback(() => {
    let progress = readDailyProgress(daily.date);
    // Ignore progress saved for a set that has since been regenerated.
    const todayIds = new Set(daily.questions.map((q) => q.id));
    if (progress && !progress.slots.every((x) => todayIds.has(x.id))) progress = null;
    setRoundMs(DAILY_MS);
    setFeedback(null);
    setGuess("");
    if (!progress) {
      setSlots([]);
      setRemaining(DAILY_MS);
      setPhase("idle");
      return;
    }
    const restored = restoreSlots(daily.questions, progress);
    setSlots(restored);
    setRemaining(progress.remaining);
    if (progress.finished) {
      setPhase("done");
    } else {
      const open = restored[progress.current];
      const cur = open && (open.status === "pending" || open.status === "passed") ? progress.current : nextOpen(restored, -1);
      if (cur === -1) {
        setPhase("done");
      } else {
        setCurrent(cur);
        setPhase("paused");
      }
    }
  }, [daily]);

  useEffect(() => {
    setStats(readStats());
    setSettings(readSettings());
    loadDaily();
  }, [loadDaily]);

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    if (m === "daily") {
      loadDaily();
    } else {
      setSlots([]);
      setFeedback(null);
      setPhase("idle");
    }
  };

  // Persist daily progress (rounded to the second) so a reload cannot reset the clock.
  const remainingSec = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (mode !== "daily" || !slots.length || phase === "idle") return;
    saveDailyProgress({
      date: daily.date,
      slots: slots.map((x) => ({ id: x.q.id, status: x.status, guess: x.guess })),
      current,
      remaining: remainingSec * 1000,
      finished: phase === "done",
    });
  }, [mode, slots, current, phase, remainingSec, daily.date]);

  const updateSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  const finish = useCallback(
    (final: Slot[]) => {
      const m = modeRef.current;
      setPhase("done");
      setStats(
        recordGame({
          correct: final.filter((x) => x.status === "correct").length,
          wrong: final.filter((x) => x.status === "wrong").length,
          total: final.length,
          ms: roundMsRef.current - Math.max(0, remainingRef.current),
          mode: m,
          ...(m === "daily" ? { date: daily.date, number: daily.number } : {}),
        }),
      );
      sendResults(final, m);
      inputRef.current?.blur();
    },
    [daily],
  );

  // Countdown
  useEffect(() => {
    if (phase !== "playing") return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      setRemaining((r) => Math.max(0, r - dt));
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "playing" && remaining <= 0) finish(slots);
  }, [remaining, phase, slots, finish]);

  // Pause when the tab/app goes to the background.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) setPhase((p) => (p === "playing" ? "paused" : p));
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  const start = () => {
    const round =
      mode === "daily"
        ? daily.questions.map((q) => ({ q, status: "pending" as const }))
        : buildRound(settings.scope === "superlig" ? questions.filter((q) => q.category === "superlig") : questions);
    if (!round.length) return;
    setSlots(round);
    setCurrent(0);
    const ms = mode === "daily" ? DAILY_MS : settings.minutes * 60_000;
    setRoundMs(ms);
    setRemaining(ms);
    setGuess("");
    setFeedback(null);
    setPhase("playing");
    focusInput();
  };

  const resolve = (status: "correct" | "wrong" | "passed", typed?: string) => {
    const now = Date.now();
    if (now - lastAction.current < 350) return; // swallow accidental double taps
    lastAction.current = now;
    const slot = slots[current];
    const next = slots.map((x, i) => (i === current ? { ...x, status, guess: typed ?? x.guess } : x));
    setSlots(next);
    setGuess("");
    setFeedback({
      kind: status,
      key: now,
      text:
        status === "correct" ? slot.q.answer : status === "wrong" ? (settings.revealAnswer ? slot.q.answer : "Yanlış") : `${slot.q.letter} — pas`,
    });
    const n = nextOpen(next, current);
    if (n === -1) finish(next);
    else setCurrent(n);
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (phase !== "playing") return;
    const typed = guess.trim();
    if (!typed || typed.toLocaleLowerCase("tr") === "pas") return resolve("passed");
    const q = slots[current].q;
    resolve(isCorrect(typed, q.answer, q.alternates) ? "correct" : "wrong", typed);
  };

  const pause = () => {
    setPhase("paused");
    inputRef.current?.blur();
  };
  const resume = () => {
    setPhase("playing");
    focusInput();
  };

  const openHelp = () => {
    if (phase === "playing") pause();
    setHelpOpen(true);
  };

  const counts = useMemo(() => {
    const c = { correct: 0, wrong: 0, open: 0 };
    for (const x of slots) {
      if (x.status === "correct") c.correct++;
      else if (x.status === "wrong") c.wrong++;
      else c.open++;
    }
    return c;
  }, [slots]);

  const shareText = () => {
    const squares = slots
      .map((x) => (x.status === "correct" ? "🟩" : x.status === "wrong" ? "🟥" : "⬜"))
      .join("");
    const rows = squares.match(/(?:🟩|🟥|⬜){1,13}/gu)?.join("\n") ?? squares;
    const title = mode === "daily" ? `Passaparola #${daily.number} ⚽` : "Passaparola · Serbest mod ⚽";
    return `${title}\n${counts.correct}/${slots.length} doğru · ${formatTime(roundMs - remaining)}\n${rows}\n${
      window.location.origin
    }`;
  };

  const longDate = (date: string) =>
    new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(date),
    );
  const shareTitle =
    mode === "daily" ? `Günlük #${daily.number} · ${longDate(daily.date)}` : `Serbest mod · ${longDate(istanbulDate())}`;

  const ringStatuses = slots.map((x, i) =>
    (phase === "playing" || phase === "paused") && i === current ? "current" : x.status,
  );
  const active = slots[current];
  const lowTime = remaining < 30_000;
  const inGame = phase === "playing" || phase === "paused";
  // Short viewport (e.g. phone keyboard open): swap the ring for a slim bar.
  const compact = inGame && viewportHeight !== null && viewportHeight < 520;

  return (
    <div className={s.app}>
      <header className={s.header}>
        <div className={s.headerSide}>
          <button className={s.iconBtn} onClick={openHelp} aria-label="Nasıl oynanır">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="17.2" r="1.1" fill="currentColor" />
            </svg>
          </button>
        </div>
        <h1 className={s.title}>
          Passaparola<span className={s.titleSub}>Süper Lig</span>
        </h1>
        <div className={`${s.headerSide} ${s.headerRight}`}>
          {phase === "playing" ? (
            <button className={s.iconBtn} onClick={pause} aria-label="Duraklat">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                <rect x="7" y="5.5" width="3.2" height="13" rx="1" fill="currentColor" />
                <rect x="13.8" y="5.5" width="3.2" height="13" rx="1" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <>
              <button className={s.iconBtn} onClick={() => setStatsOpen(true)} aria-label="İstatistikler">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                  <rect x="4" y="12" width="3.6" height="8" rx="1" fill="currentColor" />
                  <rect x="10.2" y="7" width="3.6" height="13" rx="1" fill="currentColor" />
                  <rect x="16.4" y="4" width="3.6" height="16" rx="1" fill="currentColor" />
                </svg>
              </button>
              <button className={s.iconBtn} onClick={() => setSettingsOpen(true)} aria-label="Ayarlar">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                  <path
                    d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm8.3 4.8l-1.8-.4a6.9 6.9 0 0 1-.6 1.5l1 1.6-1.7 1.7-1.6-1a6.9 6.9 0 0 1-1.5.6l-.4 1.8h-2.4l-.4-1.8a6.9 6.9 0 0 1-1.5-.6l-1.6 1-1.7-1.7 1-1.6a6.9 6.9 0 0 1-.6-1.5l-1.8-.4v-2.4l1.8-.4c.1-.5.3-1 .6-1.5l-1-1.6 1.7-1.7 1.6 1c.5-.3 1-.5 1.5-.6l.4-1.8h2.4l.4 1.8c.5.1 1 .3 1.5.6l1.6-1 1.7 1.7-1 1.6c.3.5.5 1 .6 1.5l1.8.4z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      <main className={`${s.main} ${phase === "done" ? s.mainScroll : ""}`}>
        {(phase === "idle" || phase === "done") && (
          <div className={s.modeTabs} role="tablist" aria-label="Oyun modu">
            <button role="tab" aria-selected={mode === "daily"} className={mode === "daily" ? s.tabOn : ""} onClick={() => switchMode("daily")}>
              Günlük <small>#{daily.number}</small>
            </button>
            <button role="tab" aria-selected={mode === "free"} className={mode === "free" ? s.tabOn : ""} onClick={() => switchMode("free")}>
              Serbest
            </button>
          </div>
        )}
        {compact && (
          <div className={s.compactBar}>
            <div className={s.compactTop}>
              <span className={s.compactLetter}>{active?.q.letter}</span>
              <span className={`${s.compactTimer} ${lowTime ? s.timerLow : ""}`}>{formatTime(remaining)}</span>
              <span className={s.centerMeta}>
                <span className={s.dotGreen} /> {counts.correct}
                <span className={s.dotRed} /> {counts.wrong}
              </span>
            </div>
            <div className={s.strip}>
              {ringStatuses.map((st, i) => (
                <span key={i} className={`${s.seg} ${s["seg_" + st]}`} />
              ))}
            </div>
          </div>
        )}
        <div className={s.stage} hidden={compact}>
          <Ring
            letters={slots.length ? slots.map((x) => x.q.letter) : undefined}
            statuses={ringStatuses}
          >
            {phase === "idle" && (
              <button className={s.startBtn} onClick={start} disabled={!(mode === "daily" ? daily.questions : questions).length}>
                Başla
              </button>
            )}
            {(phase === "playing" || phase === "paused") && (
              <div className={s.center}>
                <div className={`${s.timer} ${lowTime ? s.timerLow : ""}`}>{formatTime(remaining)}</div>
                <div className={s.centerMeta}>
                  <span className={s.dotGreen} /> {counts.correct}
                  <span className={s.dotRed} /> {counts.wrong}
                </div>
              </div>
            )}
            {phase === "done" && (
              <div className={s.center}>
                <div className={s.score}>
                  <Num value={counts.correct} />
                  <span className={s.scoreTotal}>
                    <Num value={`/${slots.length}`} />
                  </span>
                </div>
                <div className={s.centerMeta}>doğru</div>
              </div>
            )}
          </Ring>
        </div>

        {phase === "idle" && (
          <section className={s.intro}>
            {mode === "daily" ? (
              <p className={s.lead}>
                <strong>Günün bulmacası #{daily.number}.</strong> Herkese aynı {daily.questions.length} soru, tek hak,{" "}
                <strong>{DAILY_MS / 60_000} dakika</strong>.
              </p>
            ) : (
              <p className={s.lead}>
                <strong>Serbest mod:</strong> her oyunda rastgele sorular, istediğin kadar oyna. Süren{" "}
                <strong>{settings.minutes} dakika</strong>.
              </p>
            )}
            <ul className={s.rules}>
              <li>Bilmiyorsan <strong>Pas</strong> geç; tur bitince o harfe geri dönersin.</li>
              <li>Küçük yazım hataları ve eksik yazılan isimler kabul edilir.</li>
              <li>Kişi isimlerinde harf genelde soyadına aittir.</li>
            </ul>
            {stats && stats.history.length + stats.played > 0 && (
              <button className={s.statsLink} onClick={() => setStatsOpen(true)}>
                İstatistikler →
              </button>
            )}
            {!questions.length && <p className={s.statsLine}>Henüz soru eklenmemiş.</p>}
          </section>
        )}

        {(phase === "playing" || phase === "paused") && active && (
          <section className={s.play}>
            <div className={s.questionWrap}>
              {phase === "paused" ? (
                <div className={s.pausedBox}>
                  <p>{mode === "daily" && remaining < roundMs ? "Kaldığın yerden devam et" : "Duraklatıldı"}</p>
                  <div className={s.row}>
                    <button className={s.primary} onClick={resume}>Devam et</button>
                    <button className={s.ghost} onClick={() => finish(slots)}>Bitir</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`${s.rule} ${active.q.rule === "contains" ? s.ruleContains : ""}`}>
                    {active.q.rule === "starts" ? (
                      <><b>{active.q.letter}</b> ile başlar</>
                    ) : (
                      <>İçinde <b>{active.q.letter}</b> geçer</>
                    )}
                  </div>
                  <p key={active.q.id} className={s.question}>{active.q.question}</p>
                </>
              )}
            </div>

            <div className={s.feedbackSlot} aria-live="polite">
              {feedback && (
                <div key={feedback.key} className={`${s.feedback} ${s[feedback.kind]}`}>
                  {feedback.kind === "correct" ? "✓ " : feedback.kind === "wrong" ? (settings.revealAnswer ? "✗ Cevap: " : "✗ ") : ""}
                  {feedback.text}
                </div>
              )}
            </div>

            <form className={s.answerRow} onSubmit={submit}>
              <input
                ref={inputRef}
                className={s.input}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Cevabın…"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="send"
                disabled={phase !== "playing"}
                aria-label="Cevap"
              />
              <button
                type="button"
                className={s.passBtn}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => resolve("passed")}
                disabled={phase !== "playing"}
              >
                Pas
              </button>
              <button
                type="submit"
                className={s.sendBtn}
                onPointerDown={(e) => e.preventDefault()}
                disabled={phase !== "playing"}
                aria-label="Cevapla"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                  <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </section>
        )}

        {phase === "done" && (
          <section className={s.result}>
            <div className={s.tally}>
              <div><strong><Num value={counts.correct} /></strong><span>Doğru</span></div>
              <div><strong><Num value={counts.wrong} /></strong><span>Yanlış</span></div>
              <div><strong><Num value={counts.open} /></strong><span>Boş</span></div>
              <div><strong><Num value={formatTime(roundMs - remaining)} /></strong><span>Süre</span></div>
            </div>
            <div className={s.row}>
              <button className={s.primary} onClick={() => setShareOpen(true)}>Paylaş</button>
              {mode === "daily" ? (
                <button className={s.ghost} onClick={() => switchMode("free")}>Serbest oyna</button>
              ) : (
                <button className={s.ghost} onClick={start}>Tekrar oyna</button>
              )}
            </div>
            {mode === "daily" && <Countdown />}
            <button className={s.statsLink} onClick={() => setStatsOpen(true)}>
              İstatistikler →
            </button>
            <ol className={s.review}>
              {slots.map((x) => (
                <li key={x.q.id} className={s.reviewItem}>
                  <span className={`${s.reviewLetter} ${s["st_" + x.status]}`}>{x.q.letter}</span>
                  <div>
                    <p className={s.reviewQ}>{x.q.question}</p>
                    <p className={s.reviewA}>
                      {x.q.answer}
                      {x.status === "wrong" && x.guess && <span className={s.reviewGuess}> · senin: {x.guess}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      {shareOpen && phase === "done" && (
        <div className={s.modalBack} onClick={() => setShareOpen(false)}>
          <div className={s.modal} role="dialog" aria-modal="true" aria-label="Paylaş" onClick={(e) => e.stopPropagation()}>
            <button className={s.modalClose} onClick={() => setShareOpen(false)} aria-label="Kapat">×</button>
            <SharePanel
              title={shareTitle}
              fileName={mode === "daily" ? `passaparola-gunluk-${daily.number}.png` : "passaparola-serbest.png"}
              slots={slots}
              ms={roundMs - remaining}
              colorBlind={settings.colorBlind}
              defaultHideAnswers={mode === "daily"}
              text={shareText()}
            />
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className={s.modalBack} onClick={() => setSettingsOpen(false)}>
          <div className={s.modal} role="dialog" aria-modal="true" aria-label="Ayarlar" onClick={(e) => e.stopPropagation()}>
            <button className={s.modalClose} onClick={() => setSettingsOpen(false)} aria-label="Kapat">×</button>
            <SettingsPanel settings={settings} onChange={updateSettings} />
          </div>
        </div>
      )}

      {statsOpen && stats && (
        <div className={s.modalBack} onClick={() => setStatsOpen(false)}>
          <div className={s.modal} role="dialog" aria-modal="true" aria-label="İstatistikler" onClick={(e) => e.stopPropagation()}>
            <button className={s.modalClose} onClick={() => setStatsOpen(false)} aria-label="Kapat">×</button>
            <StatsPanel
              stats={stats}
              initialMode={mode}
              today={istanbulDate()}
              onReset={() => {
                if (confirm("Tüm istatistiklerin silinsin mi?")) setStats(resetStats());
              }}
            />
          </div>
        </div>
      )}

      {helpOpen && (
        <div className={s.modalBack} onClick={() => setHelpOpen(false)}>
          <div className={s.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className={s.modalClose} onClick={() => setHelpOpen(false)} aria-label="Kapat">×</button>
            <h2>Nasıl oynanır</h2>
            <p>Her harf için modern Süper Lig (ve biraz genel futbol) hakkında bir soru gelir. Cevap o harfle başlar ya da içinde o harf geçer.</p>
            <p>
              <strong>Günlük:</strong> herkese her gün aynı sorular, günde bir hak; gece yarısı (TSİ) yenilenir.{" "}
              <strong>Serbest:</strong> rastgele sorularla istediğin kadar oyna.
            </p>
            <ul>
              <li><strong>Enter</strong> ya da ok tuşu: cevapla</li>
              <li><strong>Pas</strong> (ya da boşken Enter): sonraki harfe geç, tur sonunda geri gel</li>
              <li>Yanlış cevap o harfi kapatır.</li>
              <li>Süre bittiğinde ya da tüm harfler kapandığında oyun biter.</li>
            </ul>
            <div className={s.legend}>
              <span><i className={s.st_correct} /> doğru</span>
              <span><i className={s.st_wrong} /> yanlış</span>
              <span><i className={s.st_passed} /> pas</span>
            </div>
            <p className={s.muted}>Cevaplarda büyük/küçük harf, aksan ve küçük yazım hataları önemli değil. Soyad tek başına yeterli.</p>
          </div>
        </div>
      )}
    </div>
  );
}
