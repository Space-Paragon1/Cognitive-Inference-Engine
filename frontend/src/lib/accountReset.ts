/* Signing out clears everything cached for the account, so the next person to sign
   in on this device or tab never sees it: in-memory caches register a reset here,
   and stored keys are removed by prefix. */
const resets = new Set<() => void>();
const STORED_PREFIXES = ["clr_tasks_", "clr_done_", "clr_rest", "clr_onboarding_step"];

export function onAccountReset(fn: () => void): void {
  resets.add(fn);
}

export function resetAccount(): void {
  resets.forEach((fn) => fn());
  for (const store of [localStorage, sessionStorage]) {
    try {
      Object.keys(store)
        .filter((k) => STORED_PREFIXES.some((p) => k.startsWith(p)))
        .forEach((k) => store.removeItem(k));
    } catch {
      /* storage blocked: nothing stored */
    }
  }
}
