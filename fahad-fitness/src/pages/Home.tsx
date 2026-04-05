import { Link } from "wouter";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { Trophy, Zap, Shield, Award, ChevronRight } from "lucide-react";

export default function Home() {
  const { t, isRTL } = useLang();
  const { user, loading: authLoading } = useAuth();
  const { isSubscribed, loading: subLoading } = useSubscription();

  // 3-way CTA routing — wait until both auth + subscription are resolved
  const isReady = !authLoading && !subLoading;
  const ctaHref = !user
    ? "/signup"
    : isSubscribed
      ? "/workouts"
      : "/plans";
  const ctaLabel = !user
    ? t("home.cta")
    : isSubscribed
      ? (isRTL ? "ابدأ تمارينك" : "Go to Workouts")
      : (isRTL ? "اختر باقتك" : "Choose a Plan");

  const features = [
    { icon: Award, title: t("home.f1.title"), desc: t("home.f1.desc") },
    { icon: Zap,   title: t("home.f2.title"), desc: t("home.f2.desc") },
    { icon: Shield,title: t("home.f3.title"), desc: t("home.f3.desc") },
    { icon: Trophy,title: t("home.f4.title"), desc: t("home.f4.desc") },
  ];

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="gym-bg min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto pt-20">
          <h1
            className="leading-none mb-6 uppercase"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: "clamp(2.4rem, 6.5vw, 5.5rem)",
              color: "#ffffff",
              letterSpacing: "0.08em",
              textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 4px 40px rgba(0,0,0,0.85), 0 0 80px rgba(0,0,0,0.6)",
            }}
          >
            {t("home.title")}
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("home.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={isReady ? ctaHref : "#"}
              className={`inline-flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all duration-300 red-glow hover:scale-105 text-base ${!isReady ? "opacity-70 pointer-events-none" : ""}`}
            >
              {ctaLabel}
              <ChevronRight className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
            </Link>
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 px-8 py-4 glass-light hover:bg-white/10 text-white font-semibold rounded-xl transition-all duration-300 hover:scale-105 text-base border border-white/10"
            >
              {t("home.explore")}
            </Link>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-red-600/50 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-red-600 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-24 px-4 bg-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-12 h-1 bg-red-600 mb-6 rounded-full" />
              <h2 className="text-4xl font-bold text-white mb-6" style={{ fontFamily: "'Oswald', sans-serif" }}>
                {t("home.about.title")}
              </h2>
              <p className="text-zinc-400 leading-relaxed text-lg">{t("home.about.text")}</p>
              <div className="mt-8 flex gap-4">
                <div className="flex-1 p-4 glass rounded-xl border border-white/5">
                  <div className="text-2xl font-black text-red-500" style={{ fontFamily: "'Oswald', sans-serif" }}>CSCS</div>
                  <div className="text-xs text-zinc-500 mt-1">Certified Strength & Conditioning</div>
                </div>
                <div className="flex-1 p-4 glass rounded-xl border border-white/5">
                  <div className="text-2xl font-black text-red-500" style={{ fontFamily: "'Oswald', sans-serif" }}>FAHAD</div>
                  <div className="text-xs text-zinc-500 mt-1">Certified Personal Trainer</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[3/4] max-h-[500px] rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&q=90&fit=crop&crop=top"
                  alt="Coach Fahad"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.7) 100%)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="w-12 h-1 bg-red-600 mb-6 rounded-full mx-auto" />
            <h2 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: "'Oswald', sans-serif" }}>
              {t("home.features.title")}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="glass rounded-2xl p-6 border border-white/5 hover:border-red-600/30 transition-all duration-300 group hover:-translate-y-2"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-600/15 flex items-center justify-center mb-4 group-hover:bg-red-600/25 transition-colors">
                    <Icon className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-black to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.15)_0%,_transparent_70%)]" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-black text-white mb-6" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {isRTL ? "مستعد لبدء رحلتك؟" : "Ready to Start?"}
          </h2>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all duration-300 red-glow hover:scale-105 text-lg"
          >
            {t("home.cta")}
            <ChevronRight className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5 bg-[#050505]">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-xs font-bold text-white">F</div>
            <span className="text-zinc-500 text-sm">Practice with Fahad &copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
