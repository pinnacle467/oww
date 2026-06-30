import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2, KeyRound, ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";

// /admin/reset-password?token=<64-char-hex>
// The link arrives in the user's inbox. The token is single-use and expires
// in 30 minutes — both enforced server-side. On success we show a
// confirmation card with a CTA back to /admin so the user signs in with
// their new password.
export default function ResetPassword() {
  useEffect(() => { document.title = "Set a new password | Once Were Wild"; }, []);
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [params] = useSearchParams();

  const token = useMemo(() => (params.get("token") || "").trim(), [params]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (admin && admin.id) navigate("/admin/dashboard");
  }, [admin, navigate]);

  // Quick client-side validation matching the backend rules so the user gets
  // immediate feedback before the round-trip. The backend remains the source
  // of truth for everything.
  const tokenLooksValid = token && token.length === 64;
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!tokenLooksValid) {
      setError("This reset link is not valid. Please request a new one.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: newPassword });
      setDone(true);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EE] flex items-center justify-center p-5" data-testid="admin-reset-password">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200 p-8 sm:p-10">
        <div className="text-center mb-8">
          <img src="/assets/logo-nav-dark.png" alt="Once Were Wild" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-[#1C1C1C]">
            {done ? "Password updated" : "Choose a new password"}
          </h1>
          <p className="text-base text-gray-500 mt-1">
            {done
              ? "You can now sign in with your new password."
              : "Pick something at least 8 characters long."}
          </p>
        </div>

        {!tokenLooksValid && !done && (
          <div className="space-y-5" data-testid="reset-password-bad-token">
            <p className="text-red-600 text-base bg-red-50 rounded-md px-4 py-3">
              This reset link is missing or malformed. Please request a new one.
            </p>
            <Link
              to="/admin/forgot-password"
              className="w-full inline-flex items-center justify-center gap-2 bg-[#2D4A3E] text-white text-lg font-medium rounded-md px-6 py-3.5 hover:bg-[#3a5d4e] transition-colors"
              data-testid="reset-password-request-new"
            >
              Request a new link
            </Link>
            <div className="text-center pt-1">
              <Link to="/admin" className="text-sm text-gray-500 hover:text-[#2D4A3E] inline-flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          </div>
        )}

        {tokenLooksValid && !done && (
          <form onSubmit={submit} className="space-y-5" data-testid="reset-password-form">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-lg rounded-md border border-gray-300 px-4 py-3 pr-12 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                  data-testid="reset-password-new"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  data-testid="reset-password-toggle-visibility"
                >
                  {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordTooShort && (
                <p className="text-amber-700 text-sm mt-1.5">At least 8 characters.</p>
              )}
            </div>
            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">Confirm new password</label>
              <input
                type={showPwd ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-lg rounded-md border border-gray-300 px-4 py-3 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                data-testid="reset-password-confirm"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-amber-700 text-sm mt-1.5">The two passwords do not match.</p>
              )}
            </div>
            {error && (
              <p className="text-red-600 text-base bg-red-50 rounded-md px-4 py-3" data-testid="reset-password-error">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !passwordsMatch || newPassword.length < 8}
              className="w-full flex items-center justify-center gap-2 bg-[#2D4A3E] text-white text-lg font-medium rounded-md px-6 py-3.5 hover:bg-[#3a5d4e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="reset-password-submit"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />} Save new password
            </button>
            <div className="text-center pt-1">
              <Link to="/admin" className="text-sm text-gray-500 hover:text-[#2D4A3E] inline-flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          </form>
        )}

        {done && (
          <div className="space-y-5" data-testid="reset-password-done">
            <div className="text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#2D4A3E]/10 text-[#2D4A3E]">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <p className="text-base text-gray-700 leading-relaxed">
                Your password has been updated. Sign in with the new one to continue.
              </p>
            </div>
            <Link
              to="/admin"
              className="w-full inline-flex items-center justify-center gap-2 bg-[#2D4A3E] text-white text-lg font-medium rounded-md px-6 py-3.5 hover:bg-[#3a5d4e] transition-colors"
              data-testid="reset-password-to-login"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
