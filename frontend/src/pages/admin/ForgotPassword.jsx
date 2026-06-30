import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Mail, ArrowLeft, RotateCw, CheckCircle2 } from "lucide-react";

// Admin "forgot password" screen. Submitting the email triggers
// POST /api/auth/forgot-password with window.location.origin so the
// emailed reset link matches whichever environment (preview vs prod) the
// admin is currently on. The same endpoint is idempotent, so the
// "Resend email" button on the confirmation screen just re-POSTs with
// the same email (invalidating any prior token).
export default function ForgotPassword() {
  useEffect(() => { document.title = "Reset Password | Once Were Wild"; }, []);
  const navigate = useNavigate();
  const { admin } = useAuth();

  const [email, setEmail] = useState("");
  const [step, setStep] = useState("form");      // form | sent
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining

  useEffect(() => {
    if (admin && admin.id) navigate("/admin/dashboard");
  }, [admin, navigate]);

  // Cooldown timer between "Resend email" presses (avoids accidental
  // double-tapping; the backend rate-limits at 3 per 15 min as well).
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data } = await api.post("/auth/forgot-password", { email: email.trim().toLowerCase(), origin });
      setInfo(data.message || "");
      setStep("sent");
      setResendCooldown(30);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resendCooldown > 0) return;
    setError(""); setInfo(""); setResending(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data } = await api.post("/auth/forgot-password", { email: email.trim().toLowerCase(), origin });
      setInfo(data.message || "Email sent again. Please check your inbox.");
      setResendCooldown(30);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EE] flex items-center justify-center p-5" data-testid="admin-forgot-password">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200 p-8 sm:p-10">
        <div className="text-center mb-8">
          <img src="/assets/logo-nav-dark.png" alt="Once Were Wild" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-[#1C1C1C]">Reset your password</h1>
          <p className="text-base text-gray-500 mt-1">
            {step === "form"
              ? "Enter the email on your admin account and we will send you a reset link."
              : "Check your inbox."}
          </p>
        </div>

        {step === "form" && (
          <form onSubmit={submit} className="space-y-5" data-testid="forgot-password-form">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@oncewerewild.com"
                className="w-full text-lg rounded-md border border-gray-300 px-4 py-3 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                data-testid="forgot-password-email"
              />
            </div>
            {error && (
              <p className="text-red-600 text-base bg-red-50 rounded-md px-4 py-3" data-testid="forgot-password-error">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#2D4A3E] text-white text-lg font-medium rounded-md px-6 py-3.5 hover:bg-[#3a5d4e] transition-colors disabled:opacity-60"
              data-testid="forgot-password-submit"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />} Send reset link
            </button>
            <div className="text-center pt-1">
              <Link to="/admin" className="text-sm text-gray-500 hover:text-[#2D4A3E] inline-flex items-center gap-1" data-testid="forgot-password-back">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          </form>
        )}

        {step === "sent" && (
          <div className="space-y-5" data-testid="forgot-password-sent">
            <div className="text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#2D4A3E]/10 text-[#2D4A3E]">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <p className="text-base text-gray-700 leading-relaxed" data-testid="forgot-password-message">
                {info}
              </p>
              <p className="text-sm text-gray-500 mt-3">
                The link will expire in 30 minutes. Did not get the email? Check your spam folder, or send it again.
              </p>
            </div>
            {error && (
              <p className="text-red-600 text-base bg-red-50 rounded-md px-4 py-3" data-testid="forgot-password-error">{error}</p>
            )}
            <button
              type="button"
              onClick={resend}
              disabled={resending || resendCooldown > 0}
              className="w-full flex items-center justify-center gap-2 border border-[#2D4A3E] text-[#2D4A3E] text-base font-medium rounded-md px-6 py-3 hover:bg-[#2D4A3E]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="forgot-password-resend"
            >
              {resending ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCw className="h-5 w-5" />}
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend email"}
            </button>
            <div className="flex items-center justify-between text-sm pt-1">
              <button
                type="button"
                onClick={() => { setStep("form"); setError(""); setInfo(""); }}
                className="text-gray-500 hover:text-[#2D4A3E] inline-flex items-center gap-1"
                data-testid="forgot-password-change-email"
              >
                <ArrowLeft className="h-4 w-4" /> Use a different email
              </button>
              <Link to="/admin" className="text-[#2E6DA4] font-medium hover:underline" data-testid="forgot-password-to-login">
                Back to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
