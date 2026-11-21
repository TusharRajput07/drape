// Per-user client state that lives outside the query cache (the Zustand stores) registers a reset
// here; endSession() (lib/api.ts) runs them all on logout, account delete and an expired session, so
// the next person to log in on this device starts clean (03 §4.2).
const resets = new Set<() => void>();

export function onSessionEnd(reset: () => void) {
  resets.add(reset);
}

export function resetSessionState() {
  resets.forEach((reset) => reset());
}
