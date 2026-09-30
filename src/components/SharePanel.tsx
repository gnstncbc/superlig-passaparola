"use client";

import { useEffect, useRef, useState } from "react";
import type { Slot } from "@/lib/game";
import { drawShareImage, shareImageBlob } from "@/lib/shareImage";
import s from "./SharePanel.module.css";

export default function SharePanel({
  title,
  fileName,
  slots,
  ms,
  colorBlind,
  defaultHideAnswers,
  text,
}: {
  title: string;
  fileName: string;
  slots: Slot[];
  ms: number;
  colorBlind: boolean;
  defaultHideAnswers: boolean;
  text: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hideAnswers, setHideAnswers] = useState(defaultHideAnswers);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    drawShareImage(canvas, {
      title,
      slots,
      ms,
      hideAnswers,
      colorBlind,
      site: window.location.host,
    });
    let objectUrl = "";
    shareImageBlob(canvas).then((b) => {
      objectUrl = URL.createObjectURL(b);
      setBlob(b);
      setUrl(objectUrl);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [title, slots, ms, hideAnswers, colorBlind]);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 2200);
  };

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const shareImage = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
      } catch {
        // cancelled by the user
      }
      return;
    }
    download();
    flash("Görsel indirildi");
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Metin kopyalandı");
    } catch {
      flash("Kopyalanamadı");
    }
  };

  return (
    <div className={s.panel}>
      <h2>Sonucunu paylaş</h2>
      <div className={s.preview}>
        {url ? <img src={url} alt="Paylaşım görseli: skor, süre ve yanlış yapılan sorular" /> : <div className={s.placeholder} />}
      </div>

      <label className={s.toggleRow}>
        <span>
          <strong>Cevapları gizle</strong>
          <small>Henüz oynamamış arkadaşların için spoiler olmasın</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={hideAnswers}
          className={`${s.switch} ${hideAnswers ? s.switchOn : ""}`}
          onClick={() => setHideAnswers((v) => !v)}
        >
          <span />
        </button>
      </label>

      <div className={s.actions}>
        <button className={s.primary} onClick={shareImage} disabled={!blob}>
          Görseli paylaş
        </button>
        <div className={s.secondary}>
          <button className={s.ghost} onClick={download} disabled={!url}>
            İndir
          </button>
          <button className={s.ghost} onClick={copyText}>
            Metni kopyala
          </button>
        </div>
      </div>
      <p className={s.status} aria-live="polite">{status}</p>
    </div>
  );
}
