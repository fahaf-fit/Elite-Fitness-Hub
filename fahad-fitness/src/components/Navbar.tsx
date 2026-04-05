import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Menu, X, Dumbbell, Globe, Shield } from "lucide-react";

export default function Navbar() {
  const { t, toggleLang, lang } = useLang();
  const { user, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const [isHome] = useRoute("/");
  const [isPlans] = useRoute("/plans");
  const [isWorkouts] = useRoute("/workouts");
  const [isProfile] = useRoute("/profile");
  const [isAdmin] = useRoute("/admin");

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;
  const isAdminUser =
    (adminEmail && user?.email === adminEmail) ||
    user?.user_metadata?.role === "admin";

  const displayName = profile?.name || user?.email || "";
  const initials = displayName.charAt(0).toUpperCase();

  const navLinks = [
    { href: "/", label: t("nav.home"), active: isHome },
    { href: "/plans", label: t("nav.plans"), active: isPlans },
    ...(user ? [
      { href: "/workouts", label: t("nav.workouts"), active: isWorkouts },
      { href: "/profile", label: t("nav.profile"), active: isProfile },
    ] : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center group-hover:bg-red-500 transition-colors">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-wide hidden sm:block">
              {lang === "ar" ? "المدرب فهد" : "Coach Fahad"}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover-underline ${
                  link.active
                    ? "text-red-400 bg-red-600/10"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Globe className="w-4 h-4" />
              <span>{lang === "en" ? "عربي" : "English"}</span>
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                {isAdminUser && (
                  <Link
                    href="/admin"
                    title="Admin Dashboard"
                    className={`p-2 rounded-lg transition-all ${isAdmin ? "bg-red-600/20 text-red-400" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}
                  >
                    <Shield className="w-4 h-4" />
                  </Link>
                )}
                <Link href="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-red-600/50 flex-shrink-0">
                    {profile?.photo_url ? (
                      <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">
                        {initials}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-zinc-300">{(profile?.name || user.email || "").split(" ")[0]}</span>
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-1.5 text-sm font-medium text-zinc-400 hover:text-red-400 transition-colors"
                >
                  {t("nav.logout")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="px-4 py-1.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                  {t("nav.login")}
                </Link>
                <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all duration-200 pulse-red">
                  {t("nav.signup")}
                </Link>
              </div>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden glass border-t border-white/5 px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                link.active
                  ? "text-red-400 bg-red-600/10"
                  : "text-zinc-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
            <button
              onClick={() => { toggleLang(); setMenuOpen(false); }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white"
            >
              <Globe className="w-4 h-4" />
              {lang === "en" ? "عربي" : "English"}
            </button>
            {user ? (
              <>
                {isAdminUser && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300"
                  >
                    <Shield className="w-4 h-4" />Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 text-left"
                >
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-zinc-300 hover:text-white">
                  {t("nav.login")}
                </Link>
                <Link href="/signup" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg text-center">
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
