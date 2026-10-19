import { api } from "../api/client";

/**
 * Web Push: lets the restaurant tell the customer "accepted", "on the way",
 * "cancelled — refund started" even after they close the app. Works in Chrome/
 * Edge/Firefox on Android and desktop; on iPhone only once the app has been
 * added to the Home Screen (iOS 16.4+).
 */

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

const ASKED_KEY = "cdh_push_asked";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

/** The server's push key, fetched once — null when the server isn't set up to send notifications. */
let publicKeyPromise: Promise<string | null> | null = null;
function getPublicKey(): Promise<string | null> {
  publicKeyPromise ??= api.get<{ publicKey: string | null }>("/public/push/config").then(
    (r) => r.publicKey,
    (err) => {
      publicKeyPromise = null; // a network blip shouldn't hide notifications for good
      throw err;
    }
  );
  return publicKeyPromise;
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  // Without a server key, turning notifications on can't work — don't offer it.
  if (!(await getPublicKey())) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Asks permission (must be called from a tap) and registers this browser for the signed-in phone. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  markPushAsked();
  const publicKey = await getPublicKey();
  if (!publicKey) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBuffer(publicKey) }));
  await api.post("/public/push/subscribe", sub.toJSON());
  return "on";
}

/** Re-sends an existing subscription after sign-in, so it's linked to the current phone. */
export async function refreshPushSubscription(): Promise<void> {
  if (!supported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await api.post("/public/push/subscribe", sub.toJSON()).catch(() => undefined);
}

/** On log out: stop this device getting the previous person's order updates. */
export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.post("/public/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

export function wasPushAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPushAsked() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // ignore
  }
}
