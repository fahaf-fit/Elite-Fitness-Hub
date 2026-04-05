import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Dumbbell, AlertCircle, CheckCircle, CheckSquare, Square } from "lucide-react";

export default function Signup() {
  const { t, isRTL } = useLang();
  const { signup, user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Route guard: authenticated users must never land on /signup
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    birth_date: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [notRobot, setNotRobot] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirm) {
      setError(isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError(isRTL ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    if (!notRobot) {
      setError(isRTL ? "يرجى تأكيد أنك لست روبوتاً" : "Please confirm you are not a robot");
      return;
    }

    setLoading(true);

    const { error: signupError } = await signup({
      name: form.name,
      email: form.email.trim(),
      phone: form.phone,
      birth_date: form.birth_date,
      password: form.password,
    });

    setLoading(false);

    if (signupError) {
      setError(signupError);
      return;
    }

    setSuccess(isRTL ? "تم إنشاء الحساب بنجاح!" : "Account created successfully!");
    setTimeout(() => navigate("/profile"), 1500);
  };

  const inputClass = `w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 text-white placeholder-zinc-600 text-sm outline-none transition-all`;
  const labelClass = `block text-sm font-medium text-zinc-400 mb-2 ${isRTL ? "text-right" : ""}`;

  return (
    <div className="min-h-screen gym-bg flex items-center justify-center px-4 pt-16 pb-12">
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="glass rounded-3xl p-8 border border-white/8 shadow-2xl">

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center mx-auto mb-4 red-glow">
              <Dumbbell className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>
              {t("signup.title")}
            </h1>
            <p className="text-zinc-500 text-sm">{t("signup.subtitle")}</p>
          </div>

          {error && (
            <div className={`flex items-start gap-3 p-4 rounded-xl bg-red-950/50 border border-red-600/30 mb-5 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className={`flex items-start gap-3 p-4 rounded-xl bg-green-950/50 border border-green-600/30 mb-5 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-300">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t("signup.name")}</label>
                <input type="text" value={form.name} onChange={update("name")} required
                  placeholder={isRTL ? "الاسم الكامل" : "Full Name"} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t("signup.phone")}</label>
                <input type="tel" value={form.phone} onChange={update("phone")} required
                  placeholder="+965 XXXX XXXX" className={inputClass} dir="ltr" />
              </div>
            </div>

            <div>
              <label className={labelClass}>{t("signup.email")}</label>
              <input type="text" value={form.email} onChange={update("email")}
                placeholder="you@example.com" className={inputClass} dir="ltr" />
            </div>

            <div>
              <label className={labelClass}>{t("signup.birthdate")}</label>
              <input type="date" value={form.birth_date} onChange={update("birth_date")} required
                className={`${inputClass} [color-scheme:dark]`} dir="ltr" />
            </div>

            <div>
              <label className={labelClass}>{t("signup.password")}</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={form.password} onChange={update("password")}
                  required placeholder="••••••••" className={`${inputClass} ${isRTL ? "pl-12" : "pr-12"}`} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-4" : "right-4"} text-zinc-500 hover:text-zinc-300 transition-colors`}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass}>{t("signup.confirm")}</label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={form.confirm} onChange={update("confirm")}
                  required placeholder="••••••••" className={`${inputClass} ${isRTL ? "pl-12" : "pr-12"}`} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-4" : "right-4"} text-zinc-500 hover:text-zinc-300 transition-colors`}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Robot check — required */}
            <button
              type="button"
              onClick={() => setNotRobot(!notRobot)}
              className={`flex items-center gap-3 w-full p-4 rounded-xl border transition-all ${
                notRobot
                  ? "bg-red-950/20 border-red-500/50"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              } ${isRTL ? "flex-row-reverse" : ""}`}
            >
              {notRobot
                ? <CheckSquare className="w-5 h-5 text-red-400 flex-shrink-0" />
                : <Square className="w-5 h-5 text-zinc-500 flex-shrink-0" />}
              <span className={`text-sm ${notRobot ? "text-zinc-200" : "text-zinc-500"}`}>
                {isRTL ? "أنا لست روبوت" : "I'm not a robot"}
              </span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-300 text-sm red-glow mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isRTL ? "جارٍ إنشاء الحساب..." : "Creating account..."}
                </>
              ) : (
                t("signup.btn")
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-zinc-500">{t("signup.have_account")} </span>
            <Link href="/login" className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors">
              {t("signup.login_link")}
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
