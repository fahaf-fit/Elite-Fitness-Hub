import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { Camera, Check, X, FileText, Lock, Calendar, Mail, Phone, User, Loader2, Crown, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Invoice {
  id: string;
  date: string;
  plan: string;
  amount: number;
  status: string;
}

export default function Profile() {
  const { t, isRTL } = useLang();
  const { user, profile, updateProfile, uploadProfilePhoto } = useAuth();
  const { subscription, subscriptions, isSubscribed, loading: subLoading } = useSubscription();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // All state/effects must be declared before any early return (React hooks rules)
  const [profileTimedOut, setProfileTimedOut] = useState(false);
  const [hadPrevSub, setHadPrevSub] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name ?? "");
      setEditPhone(profile.phone ?? "");
    }
  }, [profile]);

  // Load avatar directly from fixed storage path — no DB column needed
  useEffect(() => {
    if (!user) return;
    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(`${user.id}/avatar.png`);
    // Add a small cache-bust tied to session start so stale images don't persist
    setAvatarUrl(`${data.publicUrl}?s=${user.id.slice(0, 8)}`);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (data) setInvoices(data as Invoice[]);
      });
  }, [user]);

  useEffect(() => {
    if (profile) return;
    const timer = setTimeout(() => setProfileTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, [profile]);

  useEffect(() => {
    if (!user || isSubscribed) return;
    supabase.from("subscriptions").select("id").eq("user_id", user.id).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setHadPrevSub(true); });
  }, [user, isSubscribed]);

  if (!user) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <div className="text-center glass rounded-2xl p-12 border border-white/5 max-w-md mx-4">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {t("workouts.protected")}
          </h2>
          <p className="text-zinc-500 mb-8">{t("workouts.login_to_view")}</p>
          <Link href="/login" className="inline-block px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all duration-300">
            {t("common.login")}
          </Link>
        </div>
      </div>
    );
  }

  if (!profile && !profileTimedOut) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  // Use real profile or fallback built from auth user data — never null past this point
  const safeProfile = profile ?? {
    id: user.id,
    name: user.email?.split("@")[0] ?? "",
    email: user.email ?? "",
    phone: "",
    birth_date: "",
    photo_url: null as null,
    plan: "",
    subscription_start: "",
    subscription_end: "",
    status: "expired" as const,
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    // Show local preview immediately while uploading
    const localPreview = URL.createObjectURL(file);
    setAvatarUrl(localPreview);

    const url = await uploadProfilePhoto(file);

    // Replace preview with the real persisted URL (cache-busted)
    if (url) {
      setAvatarUrl(url);
    } else {
      // Upload failed — revert to storage path URL (no DB column needed)
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(`${user.id}/avatar.png`);
      setAvatarUrl(`${data.publicUrl}?s=${user.id.slice(0, 8)}`);
    }
    setUploading(false);
    // Reset input so selecting the same file again triggers onChange
    e.target.value = "";
  };

  const saveEdits = async () => {
    setSaving(true);
    await updateProfile({ name: editName, phone: editPhone });
    setSaving(false);
    setEditing(false);
  };

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString(isRTL ? "ar-KW" : "en-GB", { year: "numeric", month: "long", day: "numeric" }) : "—";

  const initials = (safeProfile.name || user.email || "U").charAt(0).toUpperCase();

  // Badge: green = active, red = expired, yellow = never subscribed
  const subBadge = isSubscribed
    ? { label: isRTL ? "اشتراك نشط" : "Active", dot: "bg-green-500 animate-pulse", ring: "border-green-600/30 text-green-400 bg-green-900/10" }
    : hadPrevSub
    ? { label: isRTL ? "منتهي الصلاحية" : "Expired", dot: "bg-red-500", ring: "border-red-600/30 text-red-400 bg-red-900/10" }
    : { label: isRTL ? "لا يوجد اشتراك" : "No Subscription", dot: "bg-yellow-500", ring: "border-yellow-600/30 text-yellow-400 bg-yellow-900/10" };

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <div className="w-12 h-1 bg-red-600 mb-4 rounded-full" />
          <h1 className="text-4xl font-black text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {t("profile.title")}
          </h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <div className="glass rounded-2xl p-6 border border-white/5 text-center">
              {/* Avatar — label wraps the circle so the whole area is a native file-picker trigger */}
              <div className="flex flex-col items-center mb-4">
                <input
                  ref={fileRef}
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={uploading}
                />
                <label
                  htmlFor="avatar-file-input"
                  className={`relative w-28 h-28 rounded-full overflow-hidden border-4 border-red-600/40 block group cursor-pointer active:scale-95 transition-transform ${uploading ? "opacity-60 pointer-events-none" : ""}`}
                  aria-label={isRTL ? "تغيير الصورة" : "Change photo"}
                >
                  {/* Avatar image or initials — onError falls back to initials if file doesn't exist */}
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={() => setAvatarUrl(null)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center">
                      <span className="text-4xl font-black text-white">{initials}</span>
                    </div>
                  )}
                  {/* Spinner overlay while uploading */}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                    </div>
                  )}
                  {/* Hover / tap overlay (hidden while uploading) */}
                  {!uploading && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-active:opacity-100 flex flex-col items-center justify-center transition-opacity pointer-events-none">
                      <Camera className="w-6 h-6 text-white mb-1" />
                      <span className="text-[10px] text-white font-semibold">{isRTL ? "تغيير" : "Change"}</span>
                    </div>
                  )}
                </label>

                {/* Hint text below avatar */}
                <p className="text-xs text-zinc-600 mt-2">
                  {uploading
                    ? (isRTL ? "جارٍ رفع الصورة..." : "Uploading...")
                    : (isRTL ? "اضغط على الصورة للتغيير" : "Tap photo to change")}
                </p>
              </div>

              <h2 className="text-xl font-bold text-white mb-1">{safeProfile.name || user.email}</h2>
              <p className="text-zinc-500 text-sm">{safeProfile.email || user.email}</p>

              <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${subBadge.ring}`}>
                <div className={`w-2 h-2 rounded-full ${subBadge.dot}`} />
                {subBadge.label}
              </div>
            </div>

            {/* Subscription Card — shows all active plans */}
            <div className={`glass rounded-2xl p-5 border ${isSubscribed ? "border-green-600/20" : "border-white/5"}`}>
              <div className={`flex items-center gap-2 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Crown className={`w-4 h-4 ${isSubscribed ? "text-green-400" : "text-zinc-500"}`} />
                <h3 className="text-sm font-semibold text-zinc-300">{t("profile.subscription")}</h3>
                {subscriptions.length > 1 && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-green-900/20 text-green-500 border border-green-700/30">
                    {subscriptions.length} {isRTL ? "باقات" : "plans"}
                  </span>
                )}
              </div>

              {subLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                </div>
              ) : subscriptions.length > 0 ? (
                <div className="space-y-4">
                  {subscriptions.map((sub, idx) => {
                    const startMs    = new Date(sub.start_date).getTime();
                    const endMs      = new Date(sub.end_date).getTime();
                    const nowMs      = Date.now();
                    const totalMs    = Math.max(1, endMs - startMs);
                    const daysLeft   = Math.max(0, Math.ceil((endMs - nowMs) / 86_400_000));
                    const progressPct = Math.min(100, Math.max(0, ((nowMs - startMs) / totalMs) * 100));
                    const expiringSoon = daysLeft <= 7;

                    return (
                      <div
                        key={sub.id}
                        className={`space-y-2.5 ${subscriptions.length > 1 ? "p-3 rounded-xl bg-white/3 border border-white/5" : ""}`}
                      >
                        {/* Plan label when multiple plans */}
                        {subscriptions.length > 1 && (
                          <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                            <span className="text-xs font-bold text-green-400" style={{ fontFamily: "'Oswald', sans-serif" }}>
                              {sub.plan?.name ?? "—"}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500">
                              ${sub.plan?.price}
                            </span>
                          </div>
                        )}

                        {subscriptions.length === 1 && (
                          <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                            <span className="text-xs text-zinc-500">{t("profile.plan")}</span>
                            <span className="text-sm font-semibold text-green-400">{sub.plan?.name ?? "—"}</span>
                          </div>
                        )}
                        <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                          <span className="text-xs text-zinc-500">{t("profile.start")}</span>
                          <span className="text-xs text-zinc-300">{formatDate(sub.start_date)}</span>
                        </div>
                        <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                          <span className="text-xs text-zinc-500">{t("profile.end")}</span>
                          <span className="text-xs text-zinc-300">{formatDate(sub.end_date)}</span>
                        </div>
                        <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                          <span className="text-xs text-zinc-500">{isRTL ? "متبقي" : "Days Left"}</span>
                          <span className={`text-xs font-semibold ${expiringSoon ? "text-amber-400" : "text-green-400"}`}>
                            {daysLeft} {isRTL ? "يوم" : "days"}
                          </span>
                        </div>

                        {/* Real-time progress bar: green portion = remaining */}
                        <div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${expiringSoon ? "bg-amber-500" : "bg-green-500"}`}
                              style={{ width: `${100 - progressPct}%` }}
                            />
                          </div>
                          <div className={`flex justify-between mt-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <span className="text-[10px] text-zinc-600">{isRTL ? "المتبقي" : "Remaining"}</span>
                            <span className="text-[10px] text-zinc-600">{Math.round(100 - progressPct)}%</span>
                          </div>
                        </div>

                        {/* Divider between multiple plans */}
                        {idx < subscriptions.length - 1 && (
                          <div className="pt-1 border-b border-white/5" />
                        )}
                      </div>
                    );
                  })}

                  {/* Cancel link */}
                  <button
                    onClick={() => alert(
                      isRTL
                        ? "لإلغاء الاشتراك تواصل مع المدرب\nInfo@alshiblawi.com"
                        : "To cancel your subscription, contact the coach:\nInfo@alshiblawi.com"
                    )}
                    className="mt-2 w-full py-2 rounded-lg text-xs font-semibold text-zinc-500 hover:text-red-400 border border-zinc-700/40 hover:border-red-600/40 transition-all"
                  >
                    {isRTL ? "إلغاء الاشتراك" : "Cancel Subscription"}
                  </button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <AlertCircle className="w-8 h-8 text-red-500/50 mx-auto mb-2" />
                  <p className="text-xs text-zinc-600 mb-3">{isRTL ? "لا يوجد اشتراك نشط" : "No active subscription"}</p>
                  <Link
                    href="/plans"
                    className="inline-block px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {isRTL ? "عرض الباقات" : "View Plans"}
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            {/* Personal Info */}
            <div className="glass rounded-2xl p-6 border border-white/5">
              <div className={`flex items-center justify-between mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                <h3 className="text-lg font-semibold text-white">{isRTL ? "المعلومات الشخصية" : "Personal Information"}</h3>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-1.5 text-sm text-red-400 hover:text-red-300 border border-red-600/30 hover:border-red-500/50 rounded-lg transition-all"
                  >
                    {t("profile.edit")}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdits}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-green-700/30 hover:bg-green-700/50 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 text-green-400 animate-spin" /> : <Check className="w-4 h-4 text-green-400" />}
                    </button>
                    <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 transition-colors">
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {[
                  { icon: User, label: isRTL ? "الاسم الكامل" : "Full Name", value: safeProfile.name, editable: true, key: "name" },
                  { icon: Mail, label: isRTL ? "البريد الإلكتروني" : "Email", value: safeProfile.email || user.email, editable: false },
                  { icon: Phone, label: isRTL ? "رقم الهاتف" : "Phone", value: safeProfile.phone, editable: true, key: "phone" },
                  { icon: Calendar, label: isRTL ? "تاريخ الميلاد" : "Birth Date", value: formatDate(safeProfile.birth_date), editable: false },
                ].map((field) => {
                  const Icon = field.icon;
                  return (
                    <div key={field.label} className={`flex items-start gap-4 p-4 rounded-xl glass-light border border-white/5 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div className="w-9 h-9 rounded-lg bg-red-600/15 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-500 mb-1">{field.label}</div>
                        {editing && field.editable ? (
                          <input
                            value={field.key === "name" ? editName : editPhone}
                            onChange={(e) => field.key === "name" ? setEditName(e.target.value) : setEditPhone(e.target.value)}
                            className={`w-full bg-transparent text-sm text-white border-b border-red-500/50 focus:border-red-400 outline-none pb-1 ${isRTL ? "text-right" : ""}`}
                          />
                        ) : (
                          <div className={`text-sm text-zinc-200 truncate ${isRTL ? "text-right" : ""}`}>{field.value || "—"}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Premium Access Banner if no subscription */}
            {!isSubscribed && (
              <div className="glass rounded-2xl p-6 border border-red-600/20 bg-red-950/10">
                <div className={`flex items-start gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <Crown className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">
                      {isRTL ? "احصل على وصول كامل" : "Get Full Access"}
                    </h3>
                    <p className="text-zinc-500 text-sm mb-4">
                      {isRTL
                        ? "اشترك في إحدى باقاتنا للوصول إلى التمارين والمحتوى التدريبي الكامل"
                        : "Subscribe to one of our plans to unlock workouts and full training content"}
                    </p>
                    <Link href="/plans" className="inline-block px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors">
                      {isRTL ? "اختر باقتك" : "Choose a Plan"}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Invoices */}
            <div className="glass rounded-2xl p-6 border border-white/5">
              <div className={`flex items-center gap-3 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                <FileText className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold text-white">{t("profile.invoices")}</h3>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">
                  {isRTL ? "لا توجد فواتير حتى الآن" : "No invoices yet"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        {["#", t("profile.date"), t("profile.plan"), t("profile.amount"), "Status"].map((h) => (
                          <th key={h} className={`py-3 px-2 text-xs font-medium text-zinc-500 uppercase tracking-wider ${isRTL ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/3">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-white/2 transition-colors">
                          <td className={`py-3 px-2 font-mono text-zinc-400 text-xs ${isRTL ? "text-right" : ""}`}>{inv.id}</td>
                          <td className={`py-3 px-2 text-zinc-400 ${isRTL ? "text-right" : ""}`}>{new Date(inv.date).toLocaleDateString()}</td>
                          <td className={`py-3 px-2 text-zinc-300 ${isRTL ? "text-right" : ""}`}>{inv.plan}</td>
                          <td className={`py-3 px-2 text-zinc-300 ${isRTL ? "text-right" : ""}`}>{inv.amount} {t("common.kd")}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              inv.status === "paid"
                                ? "bg-green-900/30 text-green-400 border border-green-700/30"
                                : "bg-yellow-900/30 text-yellow-400 border border-yellow-700/30"
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${inv.status === "paid" ? "bg-green-500" : "bg-yellow-500"}`} />
                              {inv.status === "paid" ? (isRTL ? "مدفوع" : "Paid") : (isRTL ? "معلق" : "Pending")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
