import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2, ShieldCheck, Mail } from "lucide-react";

export default function AdminLogin() {
  useEffect(() => { document.title = "Admin Sign In | Once Were Wild"; }, []);
  const navigate = useNavigate();
  const { admin, completeLogin } = useAuth();

  const [step, setStep] = useState("login"); // login | otp
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (admin && admin.id) navigate("/admin/dashboard");
  }, [admin, navigate]);

  const doLogin = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.status === "success") {
        completeLogin(data.access_token, data.user);
        navigate("/admin/dashboard");
      } else if (data.status === "otp_required") {
        setChallenge(data.challenge_token);
        setSentTo(data.sent_to || "your email");
        setStep("otp");
      }
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const doVerify = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { challenge_token: challenge, code });
      completeLogin(data.access_token, data.user);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(""); setInfo("");
    try {
      const { data } = await api.post("/auth/otp/resend", { challenge_token: challenge });
      setInfo(data.message);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EE] flex items-center justify-center p-5" data-testid="admin-login">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200 p-8 sm:p-10">
        <div className="text-center mb-8">
          <img src="/assets/logo-nav-dark.png" alt="Once Were Wild" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-[#1C1C1C]">Manage Your Website</h1>
          <p className="text-base text-gray-500 mt-1">Please sign in to continue</p>
        </div>

        {step === "login" && (
          <form onSubmit={doLogin} className="space-y-5" data-testid="login-form">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full text-lg rounded-md border border-gray-300 px-4 py-3 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                data-testid="login-email" />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full text-lg rounded-md border border-gray-300 px-4 py-3 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                data-testid="login-password" />
            </div>
            {error && <p className="text-red-600 text-base bg-red-50 rounded-md px-4 py-3" data-testid="login-error">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#2D4A3E] text-white text-lg font-medium rounded-md px-6 py-3.5 hover:bg-[#3a5d4e] transition-colors disabled:opacity-60"
              data-testid="login-submit">
              {loading && <Loader2 className="h-5 w-5 animate-spin" />} Sign in
            </button>
            <div className="text-center pt-1">
              <Link to="/admin/forgot-password" className="text-sm text-[#2E6DA4] font-medium hover:underline" data-testid="login-forgot-password">
                Forgot your password?
              </Link>
            </div>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={doVerify} className="space-y-5" data-testid="otp-verify">
            <div className="text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#2D4A3E]/10 text-[#2D4A3E]">
                <Mail className="h-7 w-7" />
              </span>
              <p className="text-lg text-gray-700">We have emailed a 6 digit code to</p>
              <p className="text-lg font-semibold text-[#1C1C1C]">{sentTo}</p>
              <p className="text-sm text-gray-500 mt-1">Enter it below. The code expires in 10 minutes.</p>
            </div>
            <input inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full text-center tracking-[0.5em] text-2xl rounded-md border border-gray-300 px-4 py-3 focus:border-[#2D4A3E] outline-none"
              data-testid="otp-code" />
            {info && <p className="text-green-700 text-base bg-green-50 rounded-md px-4 py-3" data-testid="otp-info">{info}</p>}
            {error && <p className="text-red-600 text-base bg-red-50 rounded-md px-4 py-3" data-testid="otp-error">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#2D4A3E] text-white text-lg font-medium rounded-md px-6 py-3.5 hover:bg-[#3a5d4e] transition-colors disabled:opacity-60"
              data-testid="otp-submit">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />} Verify and sign in
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setStep("login"); setCode(""); setError(""); setInfo(""); }} className="text-gray-500 hover:text-gray-700" data-testid="otp-back">
                Back
              </button>
              <button type="button" onClick={resend} className="text-[#2E6DA4] font-medium hover:underline" data-testid="otp-resend">
                Send a new code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
