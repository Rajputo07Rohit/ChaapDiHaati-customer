import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api, ApiError } from "../api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import logo from "../assets/logo.png";

const RESEND_COOLDOWN_SECONDS = 30;

/** Validates a plain Indian mobile number (10 digits, starts 6-9) and returns it in +91 E.164 form. Returns null if invalid. */
function toE164(rawPhone: string): string | null {
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith("+91")) return /^\+91[6-9]\d{9}$/.test(trimmed) ? trimmed : null;
  return /^[6-9]\d{9}$/.test(trimmed) ? `+91${trimmed}` : null;
}

const BRAND_NAME = "Desi Chaap Di Hatti";

/** Pre-computed so the embers don't jump around on every re-render. */
const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 7 + 4) % 96}%`,
  size: 4 + ((i * 5) % 8),
  duration: 7 + ((i * 3) % 7),
  delay: -((i * 2.3) % 9),
  drift: ((i % 2 ? 1 : -1) * (14 + ((i * 9) % 40))),
}));

/** Animated brand hero: a floating logo with pulsing rings that tilts toward
 * the pointer, a letter-by-letter shimmering name, and rising embers (the
 * tandoor). Tap/click the logo for a little pop. Full-height side panel on
 * laptops, compact banner on phones/tablets. */
function BrandPanel() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [popKey, setPopKey] = useState(0);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: nx, y: ny });
  }

  const words = BRAND_NAME.split(" ");
  let letterIndex = 0;

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative flex shrink-0 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-stone-950 via-brand-900 to-brand-700 px-6 py-8 text-center sm:py-10 lg:min-h-screen lg:w-1/2 lg:py-0"
    >
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="cdh-ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
            ["--drift" as string]: `${e.drift}px`,
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative grid h-28 w-28 place-items-center sm:h-32 sm:w-32 lg:h-52 lg:w-52">
          <span className="cdh-ring absolute inset-0 rounded-full border-2 border-brand-300/60" />
          <span className="cdh-ring absolute inset-0 rounded-full border-2 border-brand-300/60" style={{ animationDelay: "1.5s" }} />
          <div
            className="transition-transform duration-200 ease-out"
            style={{ transform: `perspective(600px) rotateY(${tilt.x * 24}deg) rotateX(${-tilt.y * 24}deg)` }}
          >
            <button
              type="button"
              key={popKey}
              onClick={() => setPopKey((k) => k + 1)}
              aria-label="Desi Chaap Di Hatti"
              className={`cdh-float block rounded-full ${popKey > 0 ? "cdh-pop" : ""}`}
            >
              <img
                src={logo}
                alt=""
                className="h-24 w-24 rounded-full bg-white/95 object-contain p-1 shadow-2xl shadow-black/40 ring-4 ring-white/20 sm:h-28 sm:w-28 lg:h-44 lg:w-44"
              />
            </button>
          </div>
        </div>

        <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:mt-8 lg:text-6xl" aria-label={BRAND_NAME}>
          {words.map((word, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap pr-[0.25em]" aria-hidden>
              {word.split("").map((ch) => {
                const delay = 0.15 + letterIndex++ * 0.045;
                return (
                  <span key={letterIndex} className="cdh-letter" style={{ animationDelay: `${delay}s` }}>
                    {ch}
                  </span>
                );
              })}
            </span>
          ))}
        </h1>
        <p className="cdh-rise mt-2 text-sm text-brand-100/90 sm:text-base lg:mt-4 lg:text-lg" style={{ animationDelay: "1.2s" }}>
          Fresh off the tandoor, straight to your door 🔥
        </p>
      </div>
    </div>
  );
}

export function Verify() {
  const navigate = useNavigate();
  const { setSession } = useCustomerAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendOtp() {
    const e164 = toE164(phone);
    if (!e164) {
      setPhoneError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setPhoneError(null);
    setSending(true);
    try {
      const { sessionId } = await api.post<{ sessionId: string }>("/public/auth/send-otp", { phone: e164 });
      setSessionId(sessionId);
      setStep("otp");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send the code. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function resendOtp() {
    if (resendIn > 0) return;
    await sendOtp();
  }

  async function verifyOtp() {
    const e164 = toE164(phone);
    if (!sessionId || !e164 || otp.trim().length === 0) return;
    setVerifying(true);
    try {
      const { token, phone: verifiedPhone } = await api.post<{ token: string; phone: string }>("/public/auth/verify-otp", {
        sessionId,
        otp: otp.trim(),
        phone: e164,
      });
      setSession(verifiedPhone, token);
      navigate("/menu", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  const e164Preview = toE164(phone);

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-stone-950 lg:flex-row">
      <BrandPanel />

      <div className="flex flex-1 items-start justify-center px-5 pb-10 pt-6 sm:items-center sm:px-8 lg:py-10">
        <div className="cdh-rise w-full max-w-md rounded-3xl bg-white p-6 shadow-xl shadow-stone-300/40 ring-1 ring-black/5 dark:bg-stone-900 dark:shadow-black/40 dark:ring-white/10 sm:p-8" style={{ animationDelay: "0.5s" }}>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
            {step === "phone" ? "Verify your phone number" : "Enter the OTP"}
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            {step === "phone"
              ? "We'll send a one-time code to confirm it's you before you order."
              : `We sent a code to ${e164Preview}.`}
          </p>

          <div className="mt-7">
            {step === "phone" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendOtp();
                }}
              >
                <div
                  className={`flex items-center overflow-hidden rounded-xl border bg-white transition focus-within:ring-2 focus-within:ring-brand-500/40 dark:bg-stone-800 ${
                    phoneError ? "border-red-400" : "border-stone-200 focus-within:border-brand-500 dark:border-stone-700"
                  }`}
                >
                  <span className="border-r border-stone-200 px-4 py-3 text-lg text-stone-500 dark:border-stone-700 dark:text-stone-400">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneError(null);
                    }}
                    placeholder="10-digit mobile number"
                    className="w-full bg-transparent px-4 py-3 text-lg tracking-wide text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-stone-100"
                    autoFocus
                  />
                </div>
                {phoneError && <p className="mt-1.5 text-sm text-red-500">{phoneError}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send OTP"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verifyOtp();
                }}
              >
                <input
                  type="tel"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-center text-2xl tracking-[0.4em] text-stone-900 placeholder:text-base placeholder:tracking-normal focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={verifying}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                  {verifying ? "Verifying…" : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={resendIn > 0 || sending}
                  className="mt-3 w-full text-sm text-brand-600 disabled:text-stone-400"
                >
                  {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                </button>
                <button type="button" onClick={() => setStep("phone")} className="mt-2 w-full text-sm text-stone-400">
                  Change phone number
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
