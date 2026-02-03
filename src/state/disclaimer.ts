// src/state/disclaimer.ts
const KEY = "ppopgi_disclaimer_accepted_v1";

export function hasAcceptedDisclaimer(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function acceptDisclaimer(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // ignore (private mode / blocked storage)
  }
}