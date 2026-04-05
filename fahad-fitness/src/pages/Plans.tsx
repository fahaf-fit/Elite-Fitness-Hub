import { Link, useLocation } from "wouter";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { Check, Zap, Star, Shield, Crown, Trophy, Loader2, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Plan {
  id: number;
  name: string;
  price: number;
}

/* Duration in days per plan price */
function getDays(price: number): number {
  if (price <= 5)   return 1;
  if (price <= 60)  return 30;
  if (price <= 150) return 90;
  if (price <= 250) return 180;
  return 365;
}

interface PlanMeta {
  icon: typeof Zap;
  color: string;
  borderColor: string;
  hoverBorder: string;
  popular?: boolean;
  durationEn: string;
  durationAr: string;
  descEn: string;
  descAr: string;
  features: { en: string[]; ar: string[] };
}

const META_BY_PRICE: Record<number, PlanMeta> = {
  5: {
    icon: Zap,
    color: "from-zinc-700 to-zinc-500",
    borderColor: "border-zinc-700/50",
    hoverBorder: "hover:border-zinc-500",
    durationEn: "1 Day",
    durationAr: "يوم واحد",
    descEn: "Single-day trial to experience Coach Fahad's program",
    descAr: "جلسة تجريبية ليوم واحد مع برنامج المدرب فهد",
    features: {
      en: ["1 full training session", "Full workout access", "App access"],
      ar: ["جلسة تدريبية كاملة", "وصول لجميع التمارين", "الوصول للتطبيق"],
    },
  },
  60: {
    icon: Star,
    color: "from-red-700 to-red-500",
    borderColor: "border-red-600/50",
    hoverBorder: "hover:border-red-500",
    popular: true,
    durationEn: "1 Month",
    durationAr: "شهر واحد",
    descEn: "4 weeks of structured training to build momentum",
    descAr: "4 أسابيع من التدريب المنظم لبناء الزخم",
    features: {
      en: ["4 weeks (4 sessions/week)", "Weekly workout plans", "Progress tracking", "Email support", "App access"],
      ar: ["4 أسابيع (4 جلسات/أسبوع)", "خطط تدريب أسبوعية", "تتبع التقدم", "دعم عبر البريد", "الوصول للتطبيق"],
    },
  },
  150: {
    icon: Shield,
    color: "from-blue-700 to-blue-500",
    borderColor: "border-blue-600/40",
    hoverBorder: "hover:border-blue-500/60",
    durationEn: "3 Months",
    durationAr: "3 أشهر",
    descEn: "12 weeks of progressive overload for real transformation",
    descAr: "12 أسبوعاً من التحميل التدريجي لتحول حقيقي",
    features: {
      en: ["12 weeks (4–5 sessions/week)", "Progressive overload program", "Nutrition guidance", "Monthly assessment", "Priority support", "App access"],
      ar: ["12 أسبوعاً (4–5 جلسات/أسبوع)", "برنامج تحميل تدريجي", "إرشاد غذائي", "تقييم شهري", "دعم أولوية", "الوصول للتطبيق"],
    },
  },
  250: {
    icon: Crown,
    color: "from-amber-700 to-amber-500",
    borderColor: "border-amber-600/40",
    hoverBorder: "hover:border-amber-500/60",
    durationEn: "6 Months",
    durationAr: "6 أشهر",
    descEn: "25 weeks of elite programming for serious athletes",
    descAr: "25 أسبوعاً من البرمجة المتقدمة للرياضيين الجادين",
    features: {
      en: ["25 weeks (5 sessions/week)", "Elite custom program", "Full nutrition plan", "Bi-weekly assessment", "WhatsApp support", "Video form checks", "App access"],
      ar: ["25 أسبوعاً (5 جلسات/أسبوع)", "برنامج نخبة مخصص", "خطة تغذية كاملة", "تقييم كل أسبوعين", "دعم واتساب", "فحص تقني بالفيديو", "الوصول للتطبيق"],
    },
  },
  550: {
    icon: Trophy,
    color: "from-rose-700 to-rose-500",
    borderColor: "border-rose-600/40",
    hoverBorder: "hover:border-rose-500/60",
    durationEn: "1 Year",
    durationAr: "سنة كاملة",
    descEn: "50 weeks — the full journey from foundation to peak performance",
    descAr: "50 أسبوعاً — الرحلة الكاملة من الأساس إلى أعلى مستوى",
    features: {
      en: ["50 weeks (5 sessions/week)", "Yearly elite program", "Full nutrition plan", "Weekly assessment", "24/7 direct support", "Competition prep", "Supplement guidance", "Priority booking", "App access"],
      ar: ["50 أسبوعاً (5 جلسات/أسبوع)", "برنامج سنوي متميز", "خطة تغذية كاملة", "تقييم أسبوعي", "دعم مباشر 24/7", "تحضير للبطولات", "إرشاد المكملات", "حجز أولوية", "الوصول للتطبيق"],
    },
  },
};

const DEFAULT_META: PlanMeta = {
  icon: Zap,
  color: "from-zinc-700 to-zinc-600",
  borderColor: "border-zinc-700/50",
  hoverBorder: "hover:border-zinc-500",
  durationEn: "Subscription",
  durationAr: "اشتراك",
  descEn: "A tailored fitness plan for your goals",
  descAr: "خطة لياقة مخصصة لأهدافك",
  features: {
    en: ["Personal training sessions", "Custom workout plan", "Progress tracking", "Access to workouts", "Monthly review"],
    ar: ["جلسات تدريب شخصية", "خطة تدريبية مخصصة", "تتبع التقدم", "الوصول للتمارين", "مراجعة شهرية"],
  },
};

export default function Plans() {
  const { t, lang, isRTL } = useLang();
  const { user } = useAuth();
  const { subscriptions, isSubscribedToPlan, subscribe, loading: subLoading } = useSubscription();
  const [, navigate] = useLocation();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [subscribingId, setSubscribingId] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingPlans(true);
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, price")
        .order("price", { ascending: true });

      if (error) setFetchError(error.message);
      else setPlans(data ?? []);
      setLoadingPlans(false);
    };
    load();
  }, []);

  const handleSubscribe = async (plan: Plan) => {
    if (!user) { navigate("/signup"); return; }
    setSubscribeError(null);
    setSubscribingId(plan.id);
    const days = getDays(plan.price);
    const { error } = await subscribe(plan.id, days);
    if (error) {
      setSubscribeError(error);
    } else {
      setSuccessId(plan.id);
      supabase.from("invoices").insert({
        user_id: user.id,
        date: new Date().toISOString().split("T")[0],
        plan: plan.name,
        amount: plan.price,
        status: "paid",
      }).then(({ error: invErr }) => {
        if (invErr) console.warn("Invoice save failed:", invErr.message);
      });
    }
    setSubscribingId(null);
  };


  return (
    <div className="min-h-screen bg-transparent pt-24 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="w-12 h-1 bg-red-600 mb-6 rounded-full mx-auto" />
          <h1 className="text-5xl font-black text-white mb-4" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {t("plans.title")}
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">{t("plans.subtitle")}</p>
        </div>

        {subscriptions.length > 0 && (
          <div className="mb-10 glass rounded-2xl p-5 border border-green-600/30 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
              <p className="text-white font-semibold">
                {isRTL ? "اشتراكاتك النشطة" : "Your Active Subscriptions"}
              </p>
            </div>
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                  <span className="text-zinc-200 text-sm font-medium">{sub.plan?.name ?? "—"}</span>
                  <span className="text-zinc-500 text-xs">
                    {isRTL
                      ? `حتى ${new Date(sub.end_date).toLocaleDateString("ar-KW")}`
                      : `expires ${new Date(sub.end_date).toLocaleDateString("en-GB")}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {subscribeError && (
          <div className="mb-8 glass rounded-xl p-4 border border-red-600/30 text-red-300 text-sm text-center max-w-md mx-auto">
            {subscribeError}
          </div>
        )}

        {loadingPlans ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
            <p className="text-zinc-500 text-sm">{isRTL ? "جارٍ تحميل الباقات..." : "Loading plans..."}</p>
          </div>
        ) : fetchError ? (
          <div className="text-center py-16 glass rounded-2xl border border-red-600/20 max-w-md mx-auto">
            <p className="text-red-400 mb-2">{isRTL ? "خطأ في تحميل الباقات" : "Error loading plans"}</p>
            <p className="text-zinc-600 text-sm">{fetchError}</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500">{isRTL ? "لا توجد باقات متاحة حالياً" : "No plans available yet"}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const meta = META_BY_PRICE[plan.price] ?? DEFAULT_META;
              const Icon = meta.icon;
              const features = lang === "ar" ? meta.features.ar : meta.features.en;
              const isCurrentPlan = isSubscribedToPlan(plan.id);
              const isLoadingThis = subscribingId === plan.id || subLoading;
              const justSubscribed = successId === plan.id;
              const days = getDays(plan.price);
              const durationLabel = lang === "ar" ? meta.durationAr : meta.durationEn;

              return (
                <div
                  key={plan.id}
                  className={`plan-card relative glass rounded-2xl border ${meta.borderColor} ${meta.hoverBorder} overflow-hidden ${
                    meta.popular ? "ring-1 ring-red-500/50 scale-[1.02]" : ""
                  } ${isCurrentPlan ? "ring-1 ring-green-500/60" : ""}`}
                >
                  {meta.popular && !isCurrentPlan && (
                    <div className="absolute top-0 left-0 right-0 py-1.5 bg-red-600 text-center">
                      <span className="text-xs font-bold text-white uppercase tracking-widest">
                        {isRTL ? "الأكثر شعبية" : "Most Popular"}
                      </span>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute top-0 left-0 right-0 py-1.5 bg-green-700 text-center">
                      <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {isRTL ? "باقتك الحالية" : "Your Current Plan"}
                      </span>
                    </div>
                  )}

                  <div className={`p-6 flex flex-col h-full ${(meta.popular || isCurrentPlan) ? "pt-10" : ""}`}>
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${meta.color} flex items-center justify-center mb-4`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>

                    {/* Duration badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-3 self-start">
                      <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">{durationLabel}</span>
                      {days > 1 && (
                        <span className="text-xs text-zinc-600">
                          · {lang === "ar"
                            ? `${Math.round(days / 7)} أسبوع`
                            : `${Math.round(days / 7)} wks`}
                        </span>
                      )}
                    </div>

                    <p className="text-zinc-500 text-sm mb-5 leading-relaxed">
                      {isRTL ? meta.descAr : meta.descEn}
                    </p>

                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-sm text-zinc-500">$</span>
                      <span className="text-5xl font-black text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>
                        {plan.price}
                      </span>
                      <span className="text-zinc-500 text-sm ms-1">
                        {lang === "ar"
                          ? (days === 1 ? "/ يوم" : "/ فترة")
                          : (days === 1 ? "/ day" : "/ period")}
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-6 flex-1">
                      {features.map((feature, i) => (
                        <div key={i} className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <div className="w-5 h-5 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-red-400" />
                          </div>
                          <span className="text-sm text-zinc-300">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {isCurrentPlan ? (
                      <div className="w-full py-3 rounded-xl text-center text-sm font-bold bg-green-800/30 text-green-400 border border-green-700/40 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {isRTL ? "مشترك حالياً" : "Subscribed"}
                      </div>
                    ) : justSubscribed ? (
                      <div className="w-full py-3 rounded-xl text-center text-sm font-bold bg-green-800/30 text-green-400 border border-green-700/40 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {isRTL ? "تم الاشتراك!" : "Subscribed!"}
                      </div>
                    ) : user ? (
                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={isLoadingThis}
                        className={`w-full py-3 rounded-xl text-center text-sm font-bold transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                          meta.popular
                            ? "bg-red-600 hover:bg-red-500 text-white red-glow hover:scale-105"
                            : "glass-light hover:bg-white/10 text-white border border-white/10 hover:border-white/20"
                        }`}
                      >
                        {isLoadingThis ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />{isRTL ? "جارٍ الاشتراك..." : "Subscribing..."}</>
                        ) : (
                          isRTL ? "اشترك الآن" : "Subscribe Now"
                        )}
                      </button>
                    ) : (
                      <Link
                        href="/signup"
                        className={`block w-full py-3 rounded-xl text-center text-sm font-bold transition-all duration-300 ${
                          meta.popular
                            ? "bg-red-600 hover:bg-red-500 text-white red-glow hover:scale-105"
                            : "glass-light hover:bg-white/10 text-white border border-white/10 hover:border-white/20"
                        }`}
                      >
                        {t("plans.cta")}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-16 glass rounded-2xl p-8 border border-white/5 text-center">
          <h3 className="text-xl font-bold text-white mb-3">
            {isRTL ? "هل لديك استفسار؟" : "Have a question?"}
          </h3>
          <p className="text-zinc-400 mb-6">
            {isRTL ? "تواصل مباشرة مع المدرب فهد" : "Contact Coach Fahad directly"}
          </p>
          <button
            onClick={() => alert("Info@alshiblawi.com")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-700/80 hover:bg-red-600 text-white font-semibold rounded-xl transition-all duration-300"
          >
            {isRTL ? "تواصل مع المدرب" : "Contact Coach"}
          </button>
        </div>
      </div>
    </div>
  );
}
