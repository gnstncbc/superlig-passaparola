import { formatTime, type Slot } from "./game";

export interface ShareImageData {
  title: string; // e.g. "Günlük #3 · 2 Ekim"
  slots: Slot[];
  ms: number;
  hideAnswers: boolean;
  colorBlind: boolean;
  site: string; // host shown in the footer
}

export const SHARE_W = 1080;
export const SHARE_H = 1350;

const FONT = '"Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
const C = {
  bg: "#ffffff",
  fg: "#1a1a1b",
  muted: "#787c7e",
  line: "#e3e4e6",
  tile: "#f1f2f3",
  tileLine: "#d3d6da",
  accent: "#e30a17",
  green: "#6aaa64",
  blue: "#3a7bd5",
  red: "#d8594c",
  yellow: "#c9b458",
};

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  // Older Safari (< 16) has no roundRect.
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws text, shrinking it with an ellipsis so it fits `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  let t = text;
  if (ctx.measureText(t).width > maxWidth) {
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    t = `${t.trimEnd()}…`;
  }
  ctx.fillText(t, x, y);
}

function spacedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = "center";
}

export function drawShareImage(canvas: HTMLCanvasElement, d: ShareImageData) {
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d")!;
  const correctColor = d.colorBlind ? C.blue : C.green;
  const color = (st: Slot["status"]) =>
    st === "correct" ? correctColor : st === "wrong" ? C.red : st === "passed" ? C.yellow : null;

  const correct = d.slots.filter((x) => x.status === "correct").length;
  const wrong = d.slots.filter((x) => x.status === "wrong");
  const open = d.slots.filter((x) => x.status !== "correct" && x.status !== "wrong");

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Header
  ctx.fillStyle = C.fg;
  ctx.font = font(800, 64);
  spacedText(ctx, "PASSAPAROLA", SHARE_W / 2, 118, 3);
  ctx.fillStyle = C.accent;
  ctx.font = font(800, 22);
  spacedText(ctx, "SÜPER LİG", SHARE_W / 2, 156, 11);
  ctx.fillStyle = C.muted;
  ctx.font = font(600, 30);
  ctx.fillText(d.title, SHARE_W / 2, 206);

  // Letter ring
  const cx = SHARE_W / 2;
  const cy = 540;
  const R = 250;
  const r = 27;
  d.slots.forEach((slot, i) => {
    const a = (i / d.slots.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    const fill = color(slot.status);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill ?? C.tile;
    ctx.fill();
    if (!fill) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.tileLine;
      ctx.stroke();
    }
    ctx.fillStyle = fill ? "#ffffff" : C.fg;
    ctx.font = font(800, 26);
    ctx.textBaseline = "middle";
    ctx.fillText(slot.q.letter, x, y + 1);
    ctx.textBaseline = "alphabetic";
  });

  // Score in the middle
  ctx.fillStyle = C.fg;
  ctx.font = font(800, 170);
  const scoreW = ctx.measureText(String(correct)).width;
  ctx.font = font(800, 64);
  const totalText = `/${d.slots.length}`;
  const totalW = ctx.measureText(totalText).width;
  const startX = cx - (scoreW + totalW) / 2;
  ctx.textAlign = "left";
  ctx.font = font(800, 170);
  ctx.fillText(String(correct), startX, cy + 50);
  ctx.fillStyle = C.muted;
  ctx.font = font(800, 64);
  ctx.fillText(totalText, startX + scoreW + 4, cy + 50);
  ctx.textAlign = "center";
  ctx.font = font(600, 32);
  ctx.fillText(`doğru · ${formatTime(d.ms)}`, cx, cy + 108);

  // Summary row
  const rowY = 880;
  const cells = [
    { v: String(correct), l: "Doğru", c: correctColor },
    { v: String(wrong.length), l: "Yanlış", c: C.red },
    { v: String(open.length), l: "Boş", c: C.tileLine },
    { v: formatTime(d.ms), l: "Süre", c: C.fg },
  ];
  const cellW = (SHARE_W - 120) / cells.length;
  cells.forEach((cell, i) => {
    const x = 60 + cellW * i + cellW / 2;
    ctx.fillStyle = C.fg;
    ctx.font = font(800, 52);
    ctx.fillText(cell.v, x, rowY);
    ctx.fillStyle = cell.c;
    roundRect(ctx, x - 14, rowY + 20, 28, 6, 3);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = font(600, 24);
    ctx.fillText(cell.l, x, rowY + 60);
  });

  // Divider
  ctx.fillStyle = C.line;
  ctx.fillRect(60, 980, SHARE_W - 120, 2);

  // Wrong answers
  ctx.textAlign = "left";
  if (!wrong.length) {
    const perfect = correct === d.slots.length;
    ctx.textAlign = "center";
    ctx.fillStyle = C.fg;
    ctx.font = font(800, 52);
    ctx.fillText(perfect ? "Kusursuz oyun! 🏆" : "Hiç yanlış yok 👏", SHARE_W / 2, 1120);
    ctx.fillStyle = C.muted;
    ctx.font = font(600, 30);
    ctx.fillText(
      perfect ? `${d.slots.length} harfin hepsi doğru` : `${open.length} harf boş kaldı`,
      SHARE_W / 2,
      1172,
    );
  } else {
    ctx.fillStyle = C.muted;
    ctx.font = font(800, 22);
    ctx.fillText(d.hideAnswers ? "YANLIŞLAR" : "YANLIŞLAR VE DOĞRU CEVAPLARI", 60, 1030);
  }

  const listTop = 1056;
  const rowH = 54;
  const maxRows = 4;
  if (wrong.length) {
    const twoCols = wrong.length > maxRows;
    const cols = twoCols ? 2 : 1;
    const capacity = maxRows * cols;
    const shown = wrong.length > capacity ? wrong.slice(0, capacity - 1) : wrong;
    const colW = (SHARE_W - 120 - (twoCols ? 30 : 0)) / cols;
    shown.forEach((slot, i) => {
      const col = twoCols ? Math.floor(i / maxRows) : 0;
      const row = twoCols ? i % maxRows : i;
      const x = 60 + col * (colW + 30);
      const y = listTop + row * rowH;
      ctx.fillStyle = C.red;
      roundRect(ctx, x, y, 42, 42, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = font(800, 24);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(slot.q.letter, x + 21, y + 22);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      if (d.hideAnswers) {
        ctx.fillStyle = C.tile;
        roundRect(ctx, x + 58, y + 8, Math.min(colW - 70, 220 + ((i * 53) % 90)), 26, 13);
        ctx.fill();
      } else {
        ctx.fillStyle = C.fg;
        ctx.font = font(700, 30);
        fitText(ctx, slot.q.answer, x + 58, y + 32, colW - 66);
      }
    });
    if (shown.length < wrong.length) {
      const i = shown.length;
      const col = twoCols ? Math.floor(i / maxRows) : 0;
      const row = twoCols ? i % maxRows : i;
      ctx.fillStyle = C.muted;
      ctx.font = font(700, 28);
      ctx.fillText(`+${wrong.length - shown.length} yanlış daha`, 60 + col * (colW + 30), listTop + row * rowH + 32);
    }
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = C.muted;
  ctx.font = font(600, 26);
  ctx.fillText(d.site, SHARE_W / 2, SHARE_H - 38);
}

export function shareImageBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
