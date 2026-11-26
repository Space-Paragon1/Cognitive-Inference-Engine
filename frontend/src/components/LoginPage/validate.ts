/* Field rules for the auth forms, worded from voice.md. Validated on blur and on
   submit; the submit button stays enabled. */

export const EMAIL_MISSING = "Enter your email.";
export const EMAIL_PARTIAL = "Add the rest of your email, like sam@uni.edu.";
export const PASSWORD_MISSING = "Enter your password.";
export const PASSWORD_SHORT = "Use at least 8 characters.";
export const MIN_PASSWORD = 8;

export function emailError(email: string): string | undefined {
  const v = email.trim();
  if (!v) return EMAIL_MISSING;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return EMAIL_PARTIAL;
  return undefined;
}

export interface Strength {
  /** 0–4 bars. */
  bars: number;
  /** Shown under the field while there's no error. */
  help: string;
  strong: boolean;
}

/** Length first (the engine asks for 8+), with a bonus for mixing letters, digits and symbols. */
export function strength(pw: string): Strength | null {
  if (!pw) return null;
  if (pw.length < MIN_PASSWORD) return { bars: 1, help: "At least 8 characters.", strong: false };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 12 && (kinds >= 2 || pw.length >= 16)) return { bars: 4, help: "Strong. 12+ characters.", strong: true };
  if (pw.length >= 12) return { bars: 3, help: "Good. A number or symbol makes it stronger.", strong: true };
  return { bars: 2, help: "Fair. 12 or more characters is stronger.", strong: false };
}

/** "2 min" or "45 s" from a Retry-After header. */
export function waitText(seconds: number | null): string {
  if (!seconds) return "a minute";
  return seconds >= 90 ? `${Math.ceil(seconds / 60)} min` : `${Math.ceil(seconds)} s`;
}
