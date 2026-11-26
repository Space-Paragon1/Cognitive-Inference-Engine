/* Who sees onboarding. First-time students (accounts under a day old) go through it
   once per device; returning students go straight to Now.
   TODO(backend): an "onboarded" flag on the user would make this follow the account. */
import type { AuthUser } from "../types";

const DONE_KEY = "clr_onboarded";
export const STEP_KEY = "clr_onboarding_step";
const NEW_ACCOUNT_SECONDS = 86400;

function doneIds(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function onboardingDue(user: AuthUser): boolean {
  if (doneIds().includes(user.id)) return false;
  return Date.now() / 1000 - user.created_at < NEW_ACCOUNT_SECONDS;
}

export function markOnboarded(id: number) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...doneIds(), id])]));
    sessionStorage.removeItem(STEP_KEY);
  } catch {
    /* storage blocked: onboarding may show again next visit */
  }
}
