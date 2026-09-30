import type { Settings, Theme } from "@/lib/settings";
import s from "./SettingsPanel.module.css";

function Segment<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={s.segment} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? s.segOn : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${s.switch} ${checked ? s.switchOn : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export default function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });

  return (
    <div className={s.panel}>
      <h2>Ayarlar</h2>

      <div className={s.row}>
        <div className={s.text}>
          <strong>Tema</strong>
        </div>
        <Segment<Theme>
          label="Tema"
          value={settings.theme}
          onChange={(v) => set("theme", v)}
          options={[
            { value: "system", label: "Sistem" },
            { value: "light", label: "Açık" },
            { value: "dark", label: "Koyu" },
          ]}
        />
      </div>

      <div className={s.row}>
        <div className={s.text}>
          <strong>Oyun süresi</strong>
          <span>Serbest mod için. Günlük bulmaca herkes için 4 dakika.</span>
        </div>
        <Segment<3 | 4 | 5>
          label="Oyun süresi"
          value={settings.minutes}
          onChange={(v) => set("minutes", v)}
          options={[
            { value: 3, label: "3 dk" },
            { value: 4, label: "4 dk" },
            { value: 5, label: "5 dk" },
          ]}
        />
      </div>

      <div className={s.row}>
        <div className={s.text}>
          <strong>Serbest mod soruları</strong>
          <span>Günlük bulmacada tüm kategoriler karışık gelir.</span>
        </div>
        <Segment<"all" | "superlig">
          label="Serbest mod soruları"
          value={settings.scope}
          onChange={(v) => set("scope", v)}
          options={[
            { value: "all", label: "Tümü" },
            { value: "superlig", label: "Süper Lig" },
          ]}
        />
      </div>

      <div className={s.row}>
        <div className={s.text}>
          <strong>Yanlışta cevabı göster</strong>
          <span>Kapalıysa cevaplar sadece oyun sonunda görünür</span>
        </div>
        <Toggle label="Yanlışta cevabı göster" checked={settings.revealAnswer} onChange={(v) => set("revealAnswer", v)} />
      </div>

      <div className={s.row}>
        <div className={s.text}>
          <strong>Renk körü modu</strong>
          <span>Doğru cevaplar yeşil yerine mavi</span>
        </div>
        <Toggle label="Renk körü modu" checked={settings.colorBlind} onChange={(v) => set("colorBlind", v)} />
      </div>
    </div>
  );
}
