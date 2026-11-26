/* Number and time formats from design/voice.md: 62%, 25 min, 1 h 48 m, 11:24, 9:42 pm. */

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const pctNum = (v: number) => Math.round(v * 100);

/** "9:58 pm" */
export function clock(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "11:24" (or "1:02:05" past an hour). */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** "25 min", or "1 h 48 m" from an hour up. */
export function minutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} m` : `${h} h`;
}

/** Spoken form for screen readers: "1 hour 48 minutes". */
export function minutesSpoken(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (r || !h) parts.push(`${r} minute${r === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** "12s", "4 min", "2 h" for "last seen … ago". */
export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

/** "Mon", "Tue"… for a YYYY-MM-DD date. */
export function weekday(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

/** "Tuesday 25 November" */
export function longDate(d = new Date()): string {
  const day = d.toLocaleDateString("en-GB", { weekday: "long" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  return `${day} ${d.getDate()} ${month}`;
}

/** Avatar initials from an email's local part: "sam.rivera@…" gives "SR". */
export function initials(email?: string | null): string {
  if (!email) return "";
  const name = email.split("@")[0].replace(/[^a-zA-Z]+/g, " ").trim();
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

/** "3 November 2026" */
export function fullDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "long" })} ${d.getFullYear()}`;
}
