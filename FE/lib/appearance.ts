// Cài đặt giao diện chỉ lưu trên trình duyệt hiện tại, tách theo tài khoản.
export type Appearance = { theme: "light" | "dark" | "system"; size: "normal" | "large" | "extra" };
export const defaultAppearance: Appearance = { theme: "system", size: "normal" };
export function appearanceKey(userId?: string | null) { return `dtu:appearance:${userId || "guest"}`; }
export function parseAppearance(raw: string | null): Appearance {
  try {
    const value = JSON.parse(raw || "{}");
    return { theme: ["light", "dark", "system"].includes(value.theme) ? value.theme : "system", size: ["normal", "large", "extra"].includes(value.size) ? value.size : "normal" };
  } catch { return defaultAppearance; }
}
export function applyAppearance(value: Appearance, systemDark: boolean, root: HTMLElement = document.documentElement) {
  root.dataset.theme = value.theme === "system" ? (systemDark ? "dark" : "light") : value.theme;
  root.dataset.textSize = value.size;
}
