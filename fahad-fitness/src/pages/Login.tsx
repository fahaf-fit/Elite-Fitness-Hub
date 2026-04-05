import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Dumbbell, AlertCircle, CheckCircle } from "lucide-react";

export default function Login() {
  const { t, isRTL } = useLang();
  const { login, user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Route guard: authenticated users should never see /login
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetError, setResetError] = useState("");

  // Show a banner if this session was invalidated by a new login elsewhere
  const wasKicked = new URLSearchParams(window.location.search).get("kicked") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: loginError } = await login(email, password);
    if (loginError) {
      setError(loginError);
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetMsg("");
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setResetError(error.message);
    } else {
      setResetMsg(
        isRTL
          ? "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني."
          : "Password reset link sent. Check your email."
      );
    }
    setResetLoading(false);
  };

  const inputClass = "w-full px-4 py-3 rounded-xl glass-light border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 text-white placeholder-zinc-600 text-sm outline-none transition-all";

  return (
    <div className="min-h-screen gym-bg flex items-center justify-center px-4 pt-16">
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md">
        <div className="glass rounded-3xl p-8 border border-white/8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center mx-auto mb-4 red-glow">
              <Dumbbell className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>
              {showReset ? (isRTL ? "إعادة تعيين كلمة المرور" : "Reset Password") : t("login.title")}
            </h1>
            <p className="text-zinc-500 text-sm">
              {showReset
                ? (isRTL ? "أدخل بريدك لإرسال رابط الإعادة" : "Enter your email to receive a reset link")
                : t("login.subtitle")}
            </p>
          </div>

          {/* Login form */}
          {!showReset && (
            <>
              {/* Session-invalidated notice */}
              {wasKicked && !error && (
                <div className={`flex items-start gap-3 p-4 rounded-xl bg-amber-950/40 border border-amber-600/30 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-300">
                    {isRTL
                      ? "تم تسجيل خروجك تلقائياً لأنه تم تسجيل الدخول من جهاز آخر. يرجى تسجيل الدخول مجدداً."
                      : "You were signed out because your account was logged in from another device. Please sign in again."}
                  </p>
                </div>
              )}

              {error && (
                <div className={`flex items-start gap-3 p-4 rounded-xl bg-red-950/50 border border-red-600/30 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={`block text-sm font-medium text-zinc-400 mb-2 ${isRTL ? "text-right" : ""}`}>
                    {t("login.email")}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    dir="ltr"
                    className={inputClass}
                  />
                </div>

                <div>
                  <div className={`flex items-center justify-between mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <label className="block text-sm font-medium text-zinc-400">
                      {t("login.password")}
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowReset(true); setResetEmail(email); }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      {isRTL ? "نسيت كلمة المرور؟" : "Forgot password?"}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={`${inputClass} ${isRTL ? "pl-12" : "pr-12"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-4" : "right-4"} text-zinc-500 hover:text-zinc-300 transition-colors`}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-300 text-sm hover:scale-[1.02] red-glow"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isRTL ? "جارٍ تسجيل الدخول..." : "Signing in..."}
                    </span>
                  ) : (
                    t("login.btn")
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <span className="text-sm text-zinc-500">{t("login.no_account")} </span>
                <Link href="/signup" className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors">
                  {t("login.signup_link")}
                </Link>
              </div>
            </>
          )}

          {/* Reset form */}
          {showReset && (
            <>
              {resetError && (
                <div className={`flex items-start gap-3 p-4 rounded-xl bg-red-950/50 border border-red-600/30 mb-5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{resetError}</p>
                </div>
              )}
              {resetMsg && (
                <div className={`flex items-start gap-3 p-4 rounded-xl bg-green-950/50 border border-green-600/30 mb-5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-300">{resetMsg}</p>
                </div>
              )}

              {!resetMsg && (
                <form onSubmit={handleReset} className="space-y-5">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-400 mb-2 ${isRTL ? "text-right" : ""}`}>
                      {t("login.email")}
                    </label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      dir="ltr"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold rounded-xl transition-all text-sm red-glow"
                  >
                    {resetLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {isRTL ? "جارٍ الإرسال..." : "Sending..."}
                      </span>
                    ) : (
                      isRTL ? "إرسال رابط الإعادة" : "Send Reset Link"
                    )}
                  </button>
                </form>
              )}

              <button
                onClick={() => { setShowReset(false); setResetMsg(""); setResetError(""); }}
                className="w-full mt-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center"
              >
                {isRTL ? "← العودة لتسجيل الدخول" : "← Back to Sign In"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
