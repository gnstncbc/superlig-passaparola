export type Theme = "system" | "light" | "dark";

export interface Settings {
  theme: Theme;
  minutes: 3 | 4 | 5;
  revealAnswer: boolean;
  colorBlind: boolean;
  /** Question pool for free mode (the daily puzzle always uses every category). */
  scope: "all" | "superlig";
}

export const SETTINGS_KEY = "sl:settings";

export const defaultSettings: Settings = {
  theme: "system",
  minutes: 4,
  revealAnswer: true,
  colorBlind: false,
  scope: "all",
};

export function readSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (s && typeof s === "object") {
      return {
        theme: ["light", "dark"].includes(s.theme) ? s.theme : "system",
        minutes: [3, 4, 5].includes(s.minutes) ? s.minutes : 4,
        revealAnswer: s.revealAnswer !== false,
        colorBlind: s.colorBlind === true,
        scope: s.scope === "superlig" ? "superlig" : "all",
      };
    }
  } catch {}
  return defaultSettings;
}

export function applySettings(s: Settings) {
  const root = document.documentElement;
  if (s.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  if (s.colorBlind) root.dataset.colorblind = "true";
  else delete root.dataset.colorblind;
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
  applySettings(s);
}

// Runs before first paint (inlined in <head>) so a saved theme never flashes.
export const settingsBootScript = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)})||"null");if(s){var r=document.documentElement;if(s.theme==="light"||s.theme==="dark")r.dataset.theme=s.theme;if(s.colorBlind===true)r.dataset.colorblind="true"}}catch(e){}`;
