import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api, ApiError } from "../api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";

const RESEND_COOLDOWN_SECONDS = 30;

/** Validates a plain Indian mobile number (10 digits, starts 6-9) and returns it in +91 E.164 form. Returns null if invalid. */
function toE164(rawPhone: string): string | null {
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith("+91")) return /^\+91[6-9]\d{9}$/.test(trimmed) ? trimmed : null;
  return /^[6-9]\d{9}$/.test(trimmed) ? `+91${trimmed}` : null;
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
    <div className="flex min-h-screen flex-col bg-white px-6 py-4 dark:bg-stone-950">
      <div className="mt-10 flex-1">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
          {step === "phone" ? "Verify your phone number" : "Enter the OTP"}
        </h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          {step === "phone"
            ? "We'll send a one-time code to confirm it's you before you order."
            : `We sent a code to ${e164Preview}.`}
        </p>

        <div className="mt-8">
          {step === "phone" ? (
            <>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(null);
                }}
                placeholder="10-digit mobile number"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-lg tracking-wide text-stone-900 dark:bg-stone-900 dark:text-stone-100 ${
                  phoneError ? "border-red-400" : "border-stone-200 dark:border-stone-700"
                }`}
                autoFocus
              />
              {phoneError && <p className="mt-1.5 text-sm text-red-500">{phoneError}</p>}
              <button
                onClick={sendOtp}
                disabled={sending}
                className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <input
                type="tel"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-lg tracking-widest text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                autoFocus
              />
              <button
                onClick={verifyOtp}
                disabled={verifying}
                className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-60"
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
              <button
                onClick={resendOtp}
                disabled={resendIn > 0 || sending}
                className="mt-3 w-full text-sm text-brand-600 disabled:text-stone-400"
              >
                {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
              </button>
              <button onClick={() => setStep("phone")} className="mt-2 w-full text-sm text-stone-400">
                Change phone number
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
