import { LETTERS } from "@/lib/types";
import type { Status } from "@/lib/game";
import s from "./Ring.module.css";

export default function Ring({
  letters = LETTERS,
  statuses = [],
  children,
}: {
  letters?: string[];
  statuses?: Status[];
  children?: React.ReactNode;
}) {
  const n = letters.length;
  return (
    <div className={s.ring}>
      {letters.map((l, i) => (
        <span
          key={l}
          className={`${s.bubble} ${s[statuses[i] ?? "pending"]}`}
          style={{ "--a": `${(i / n) * 360}deg` } as React.CSSProperties}
          aria-label={`${l}: ${statuses[i] ?? "pending"}`}
        >
          {l}
        </span>
      ))}
      <div className={s.inner}>{children}</div>
    </div>
  );
}
