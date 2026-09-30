import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Passaparola Süper Lig: her gün 26 soru, 4 dakika";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
// A game in progress: green = correct, red = wrong, yellow = passed, orange = current.
const STATE: Record<string, string> = {
  A: "#6aaa64", B: "#6aaa64", C: "#d8594c", D: "#6aaa64", E: "#c9b458", F: "#6aaa64",
  G: "#6aaa64", H: "#c9b458", I: "#6aaa64", J: "#d8594c", K: "#1a1a1b",
};

const font = (file: string) =>
  readFile(join(process.cwd(), "node_modules/@fontsource/inter/files", file)).then((b) =>
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  );

export default async function OpengraphImage() {
  const [regular, regularExt, bold, boldExt] = await Promise.all([
    font("inter-latin-400-normal.woff"),
    font("inter-latin-ext-400-normal.woff"),
    font("inter-latin-800-normal.woff"),
    font("inter-latin-ext-800-normal.woff"),
  ]);
  const ring = 440;
  const bubble = 46;
  const r = ring / 2 - bubble / 2;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 80px",
          background: "#ffffff",
          color: "#1a1a1b",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: 1, lineHeight: 1 }}>PASSAPAROLA</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 14, color: "#e30a17", marginTop: 14 }}>
            SÜPER LİG
          </div>
          <div style={{ fontSize: 32, marginTop: 44, lineHeight: 1.4, color: "#3a3a3c" }}>
            Her gün yeni 26 soru. A'dan Z'ye modern Süper Lig bilgini 4 dakikada test et.
          </div>
        </div>
        <div style={{ position: "relative", width: ring, height: ring, display: "flex" }}>
          {LETTERS.map((l, i) => {
            const a = (i / LETTERS.length) * Math.PI * 2 - Math.PI / 2;
            const color = STATE[l];
            const current = l === "K";
            const d = current ? bubble + 12 : bubble;
            return (
              <div
                key={l}
                style={{
                  position: "absolute",
                  left: ring / 2 + Math.cos(a) * r - d / 2,
                  top: ring / 2 + Math.sin(a) * r - d / 2,
                  width: d,
                  height: d,
                  borderRadius: d,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: current ? 28 : 22,
                  fontWeight: 800,
                  background: color ?? "#f1f2f3",
                  border: color ? `2px solid ${color}` : "2px solid #d3d6da",
                  color: color ? "#ffffff" : "#1a1a1b",
                }}
              >
                {l}
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: ring,
              height: ring,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1 }}>2:47</div>
            <div style={{ fontSize: 26, color: "#787c7e", marginTop: 10 }}>7 doğru · 2 yanlış</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: regularExt, weight: 400, style: "normal" },
        { name: "Inter", data: bold, weight: 800, style: "normal" },
        { name: "Inter", data: boldExt, weight: 800, style: "normal" },
      ],
    },
  );
}
