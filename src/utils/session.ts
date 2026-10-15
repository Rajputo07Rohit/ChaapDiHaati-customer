// Small helpers around "the customer got signed out without asking to" —
// browser data cleared, token expired (30 days), or the server rejecting it.
// Everything here is best-effort: storage can be blocked or already wiped.

const NOTICE_KEY = "cdh_signed_out_notice";
const RETURN_KEY = "cdh_return_to";
const LAST_PHONE_KEY = "cdh_last_phone";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Call when a session disappears unexpectedly (not on an explicit Log out). */
export function markUnexpectedSignOut(returnTo: string) {
  safe(() => sessionStorage.setItem(NOTICE_KEY, "1"), undefined);
  if (returnTo && !returnTo.startsWith("/verify")) safe(() => sessionStorage.setItem(RETURN_KEY, returnTo), undefined);
}

export function consumeSignedOutNotice(): boolean {
  const had = safe(() => sessionStorage.getItem(NOTICE_KEY) === "1", false);
  safe(() => sessionStorage.removeItem(NOTICE_KEY), undefined);
  return had;
}

export function consumeReturnTo(): string | null {
  const to = safe(() => sessionStorage.getItem(RETURN_KEY), null);
  safe(() => sessionStorage.removeItem(RETURN_KEY), undefined);
  return to && to.startsWith("/") && !to.startsWith("/verify") ? to : null;
}

/** Remembered only so re-verifying is one tap; the number alone grants no access. */
export function rememberPhone(phone: string) {
  safe(() => localStorage.setItem(LAST_PHONE_KEY, phone), undefined);
}

export function getRememberedPhone(): string {
  const digits = (safe(() => localStorage.getItem(LAST_PHONE_KEY), "") ?? "").replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? digits : "";
}

/** On a deliberate Log out — nothing about the previous person should linger on a shared phone. */
export function forgetPhone() {
  safe(() => localStorage.removeItem(LAST_PHONE_KEY), undefined);
}
