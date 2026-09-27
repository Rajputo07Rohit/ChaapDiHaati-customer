import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string })?.returnTo ?? "/cart";
  const { mockVerify } = useCustomerAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  function sendOtp() {
    if (phone.replace(/\D/g, "").length < 10) return;
    setStep("otp");
  }

  function verifyOtp() {
    if (otp.trim().length === 0) return;
    // Mock verification — see CustomerAuthContext for why. Accepts any code.
    mockVerify(phone);
    navigate(returnTo, { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-4">
      <button onClick={() => navigate(-1)} aria-label="Back" className="self-start">
        <ArrowLeft size={20} />
      </button>

      <div className="mt-10 flex-1">
        <h1 className="text-2xl font-bold text-stone-900">
          {step === "phone" ? "Verify your phone number" : "Enter the OTP"}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          {step === "phone"
            ? "We'll send a one-time code to confirm it's you before placing your order."
            : `We sent a code to ${phone}.`}
        </p>

        <div className="mt-8">
          {step === "phone" ? (
            <>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-lg tracking-wide"
                autoFocus
              />
              <button
                onClick={sendOtp}
                className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white"
              >
                Send OTP
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
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-lg tracking-widest"
                autoFocus
              />
              <button
                onClick={verifyOtp}
                className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white"
              >
                Verify
              </button>
              <button onClick={() => setStep("phone")} className="mt-3 w-full text-sm text-stone-400">
                Change phone number
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
