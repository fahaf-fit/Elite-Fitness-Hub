import { Link } from "wouter";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { supabase } from "@/lib/supabase";
import {
  Lock, Dumbbell, Clock, Zap, Crown, CheckCircle,
  ChevronDown, ChevronUp, Loader2,
  CalendarDays, Trophy, Copy, Check,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

/* ════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */

function getWeeksFromPrice(price: number): number {
  if (price <= 5)   return 1;
  if (price <= 60)  return 4;
  if (price <= 150) return 12;
  if (price <= 250) return 25;
  return 50;
}
function getDurationLabel(price: number, ar: boolean): string {
  if (price <= 5)   return ar ? "يوم واحد" : "1 Day";
  if (price <= 60)  return ar ? "شهر واحد" : "1 Month";
  if (price <= 150) return ar ? "3 أشهر"   : "3 Months";
  if (price <= 250) return ar ? "6 أشهر"   : "6 Months";
  return ar ? "سنة كاملة" : "1 Year";
}

/** Days elapsed since subscription start (0-based) */
function daysElapsed(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

/** {week, day} for "today" relative to subscription start */
function todayProgress(startDate: string) {
  const d = daysElapsed(startDate);
  return { week: Math.floor(d / 7) + 1, day: (d % 7) + 1 };
}

/** Compare two {week,day} pairs: -1 past, 0 today, 1 future */
function cmpDay(w: number, d: number, tw: number, td: number): -1 | 0 | 1 {
  if (w < tw || (w === tw && d < td)) return -1;
  if (w === tw && d === td)           return 0;
  return 1;
}

/* ── YouTube / Video ── */
function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
  return m ? m[1] : null;
}
function isDirectVideo(url: string) { return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url); }

/* ── Color map ── */
const GRAD: Record<string, string> = {
  "bg-red-600":     "from-red-700 to-red-500",
  "bg-blue-600":    "from-blue-700 to-blue-500",
  "bg-emerald-600": "from-emerald-700 to-emerald-500",
  "bg-purple-600":  "from-purple-700 to-purple-500",
  "bg-amber-600":   "from-amber-700 to-amber-500",
  "bg-cyan-600":    "from-cyan-700 to-cyan-500",
  "bg-rose-600":    "from-rose-700 to-rose-500",
  "bg-indigo-600":  "from-indigo-700 to-indigo-500",
};
const grad = (c: string) => GRAD[c] ?? "from-red-700 to-red-500";

const DAY_NAMES: Record<number, { en: string; ar: string }> = {
  1: { en: "Monday", ar: "الاثنين" }, 2: { en: "Tuesday", ar: "الثلاثاء" },
  3: { en: "Wednesday", ar: "الأربعاء" }, 4: { en: "Thursday", ar: "الخميس" },
  5: { en: "Friday", ar: "الجمعة" }, 6: { en: "Saturday", ar: "السبت" },
  7: { en: "Sunday", ar: "الأحد" },
};

const PROGRESS_SQL = `create table workout_progress (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  workout_id   uuid not null,
  completed    boolean default true,
  completed_at timestamptz default now(),
  unique (user_id, workout_id)
);
alter table workout_progress enable row level security;
create policy "Users manage own progress"
  on workout_progress for all using (auth.uid() = user_id);`;

/* ════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════ */

function VideoPlayer({ url }: { url: string }) {
  const id = ytId(url);
  if (id) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: "56.25%" }}>
        <iframe
          src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Workout video"
        />
      </div>
    );
  }
  if (isDirectVideo(url)) {
    return <video controls className="w-full rounded-xl bg-black" src={url} />;
  }
  /* Vimeo / other embed */
  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: "56.25%" }}>
      <iframe src={url} className="absolute inset-0 w-full h-full" allowFullScreen title="Workout video" />
    </div>
  );
}

/* ════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════ */

interface PlanRow { id: number; name: string; price: number }

interface DbWorkout {
  id: string; plan_id: number | null;
  week: number; day: number;
  name: string; type: string; exercises: number;
  color: string; video_url: string; description: string;
}

/* ════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════ */

export default function Workouts() {
  const { t, isRTL } = useLang();
  const { user } = useAuth();
  const { isSubscribed, loading: subLoading, subscriptions, isSubscribedToPlan } = useSubscription();

  const [allPlans, setAllPlans]               = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans]       = useState(true);
  const [selectedPlanId, setSelectedPlanId]   = useState<number | null>(null);
  const [dbWorkouts, setDbWorkouts]           = useState<DbWorkout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [selectedWeek, setSelectedWeek]       = useState(1);
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  /* Completion tracking */
  const [completedIds, setCompletedIds]       = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId]           = useState<string | null>(null);
  const [progressMissing, setProgressMissing] = useState(false);
  const [copiedSql, setCopiedSql]             = useState(false);
  /* Today's highlight */
  const todayRef = useRef<HTMLDivElement | null>(null);

  /* ── Load plans ── */
  useEffect(() => {
    supabase.from("plans").select("id, name, price").order("price")
      .then(({ data }) => { setAllPlans(data ?? []); setLoadingPlans(false); });
  }, []);

  /* ── Default plan = highest-price paid ── */
  useEffect(() => {
    if (subscriptions.length > 0 && selectedPlanId === null) {
      const best = subscriptions.reduce((a, b) => (b.plan?.price ?? 0) > (a.plan?.price ?? 0) ? b : a);
      setSelectedPlanId(best.plan_id);
    }
  }, [subscriptions, selectedPlanId]);

  /* ── Fetch workouts for selected plan ── */
  const fetchWorkouts = useCallback(async (planId: number) => {
    setLoadingWorkouts(true);
    setDbWorkouts([]);
    const { data, error } = await supabase
      .from("workouts")
      .select("id, plan_id, week, day, name, type, exercises, color, video_url, description")
      .eq("plan_id", planId)
      .order("week").order("day");
    if (!error && data) {
      setDbWorkouts(data as DbWorkout[]);
      setSelectedWeek(data[0]?.week ?? 1);
      setExpandedId(null);
    }
    setLoadingWorkouts(false);
  }, []);

  useEffect(() => {
    if (selectedPlanId != null) fetchWorkouts(selectedPlanId);
  }, [selectedPlanId, fetchWorkouts]);

  /* ── Load completion states ── */
  const loadCompletions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("workout_progress")
      .select("workout_id")
      .eq("user_id", user.id)
      .eq("completed", true);
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("does not exist") || error.code === "42P01") setProgressMissing(true);
      return;
    }
    if (data) setCompletedIds(new Set(data.map((r: any) => r.workout_id)));
  }, [user]);

  useEffect(() => { loadCompletions(); }, [loadCompletions]);

  /* ── Toggle completion ── */
  const toggleComplete = async (workoutId: string) => {
    if (!user || togglingId) return;
    setTogglingId(workoutId);
    const done = completedIds.has(workoutId);
    if (done) {
      await supabase.from("workout_progress").delete()
        .eq("user_id", user.id).eq("workout_id", workoutId);
      setCompletedIds((prev) => { const s = new Set(prev); s.delete(workoutId); return s; });
    } else {
      const { error } = await supabase.from("workout_progress").upsert(
        { user_id: user.id, workout_id: workoutId, completed: true, completed_at: new Date().toISOString() },
        { onConflict: "user_id,workout_id" }
      );
      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        if (msg.includes("does not exist") || error.code === "42P01") setProgressMissing(true);
      } else {
        setCompletedIds((prev) => new Set([...prev, workoutId]));
      }
    }
    setTogglingId(null);
  };

  /* ════════════════════════════════════════════════
     GATES
  ════════════════════════════════════════════════ */
  if (subLoading || loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="text-center glass rounded-2xl p-12 border border-white/5 max-w-md w-full">
          <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {isRTL ? "تسجيل الدخول مطلوب" : "Login Required"}
          </h2>
          <p className="text-zinc-500 mb-8">{isRTL ? "يرجى تسجيل الدخول للوصول إلى تمارينك" : "Please sign in to access your workouts"}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all red-glow">{t("common.login")}</Link>
            <Link href="/signup" className="px-8 py-3 glass-light text-white font-semibold rounded-xl border border-white/10 transition-all">{t("nav.signup")}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="text-center glass rounded-2xl p-12 border border-red-600/15 max-w-lg w-full">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-900/30 to-red-800/20 flex items-center justify-center mx-auto mb-6 border border-red-600/20">
            <Crown className="w-12 h-12 text-red-400" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {isRTL ? "محتوى مميز" : "Premium Content"}
          </h2>
          <p className="text-zinc-400 mb-3">{isRTL ? "يلزم وجود اشتراك نشط للوصول إلى التمارين." : "An active subscription is required to access workouts."}</p>
          <p className="text-zinc-600 text-sm mb-8">{isRTL ? "اختر باقة مناسبة وابدأ رحلتك اليوم" : "Choose a plan and start your journey today"}</p>
          <Link href="/plans" className="inline-block px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all red-glow hover:scale-105">
            {isRTL ? "عرض الباقات" : "View Plans"}
          </Link>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     DERIVED STATE
  ════════════════════════════════════════════════ */
  const activeSub   = subscriptions.find((s) => s.plan_id === selectedPlanId) ?? null;
  const planPrice   = activeSub?.plan?.price ?? null;
  const totalWeeks  = planPrice ? getWeeksFromPrice(planPrice) : 0;

  /* Today's position within the subscription */
  const todayPos = activeSub
    ? todayProgress(activeSub.start_date)
    : { week: 1, day: 1 };

  /* Available weeks in DB data */
  const availableWeeks = [...new Set(dbWorkouts.map((w) => w.week))].sort((a, b) => a - b);
  const safeWeek = availableWeeks.includes(selectedWeek) ? selectedWeek : (availableWeeks[0] ?? 1);

  /* Workouts for selected week */
  const weekWorkouts = dbWorkouts.filter((w) => w.week === safeWeek);

  /* Today's actual workout */
  const todayWorkout = dbWorkouts.find(
    (w) => w.week === todayPos.week && w.day === todayPos.day
  ) ?? null;

  const phaseLabel = (w: number) => {
    const p = ((w - 1) % 4) + 1;
    return [
      { en: "Foundation", ar: "الأساس" },
      { en: "Build",      ar: "البناء" },
      { en: "Intensity",  ar: "الشدة"  },
      { en: "Peak",       ar: "الذروة" },
    ][p - 1];
  };

  const handleSelectPlan = (plan: PlanRow) => {
    if (!isSubscribedToPlan(plan.id) || plan.id === selectedPlanId) return;
    setSelectedPlanId(plan.id);
  };

  /* ════════════════════════════════════════════════
     WORKOUT CARD (reused for today + accordion)
  ════════════════════════════════════════════════ */
  const WorkoutCard = ({
    workout, forceOpen = false, isToday = false,
  }: {
    workout: DbWorkout; forceOpen?: boolean; isToday?: boolean;
  }) => {
    const isOpen    = forceOpen || expandedId === workout.id;
    const isDone    = completedIds.has(workout.id);
    const isFuture  = cmpDay(workout.week, workout.day, todayPos.week, todayPos.day) === 1;
    const toggling  = togglingId === workout.id;
    const dayName   = DAY_NAMES[workout.day];

    return (
      <div
        ref={isToday ? todayRef : undefined}
        className={`glass rounded-2xl border overflow-hidden transition-all duration-300
          ${isToday    ? "border-red-500/40 ring-1 ring-red-500/20 shadow-lg shadow-red-900/20"
          : isDone     ? "border-green-600/30"
          : isFuture   ? "border-white/5 opacity-70"
          :              "border-white/5 hover:border-white/10"}`}
      >
        {/* ── Card header / toggle ── */}
        <button
          onClick={() => {
            if (forceOpen) return;
            setExpandedId(isOpen ? null : workout.id);
          }}
          disabled={forceOpen}
          className={`w-full flex items-center gap-4 p-5 ${isRTL ? "flex-row-reverse text-right" : "text-left"} ${forceOpen ? "cursor-default" : ""}`}
        >
          {/* Color badge */}
          <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${grad(workout.color)} flex items-center justify-center flex-shrink-0 font-black text-white text-lg shadow-md`}
            style={{ fontFamily: "'Oswald', sans-serif" }}>
            {workout.day}
            {isDone && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white truncate">{workout.name}</span>
              {isToday && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white uppercase tracking-wide">
                  {isRTL ? "اليوم" : "Today"}
                </span>
              )}
              {isFuture && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-500 border border-white/5">
                  <Lock className="w-2.5 h-2.5" />{isRTL ? "قادم" : "Upcoming"}
                </span>
              )}
              {isDone && !isToday && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-900/30 text-green-400 border border-green-600/20">
                  <CheckCircle className="w-2.5 h-2.5" />{isRTL ? "مكتمل" : "Done"}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {dayName && <span>{isRTL ? dayName.ar : dayName.en}</span>}
              {workout.type && <><span>·</span><span>{workout.type}</span></>}
              {workout.exercises > 0 && <><span>·</span><span>{workout.exercises} {isRTL ? "تمارين" : "exercises"}</span></>}
              {!forceOpen && <><span>·</span><span className="text-zinc-600">{isRTL ? `الأسبوع ${workout.week}` : `Week ${workout.week}`}</span></>}
            </div>
          </div>

          {!forceOpen && (
            isOpen
              ? <ChevronUp   className="w-5 h-5 text-zinc-500 flex-shrink-0" />
              : <ChevronDown className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          )}
        </button>

        {/* ── Expanded body ── */}
        {isOpen && (
          <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-4">

            {/* Embedded video */}
            {workout.video_url && <VideoPlayer url={workout.video_url} />}

            {/* Description */}
            {workout.description ? (
              <p className="text-sm text-zinc-400 leading-relaxed">{workout.description}</p>
            ) : !workout.video_url ? (
              <p className="text-sm text-zinc-600 italic">{isRTL ? "لا يوجد وصف." : "No description provided."}</p>
            ) : null}

            {/* Exercise count */}
            {workout.exercises > 0 && (
              <div className={`flex items-center gap-2 text-xs text-zinc-500 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Dumbbell className="w-3.5 h-3.5 text-red-500/60" />
                <span>{workout.exercises} {isRTL ? "تمرين في هذا اليوم" : `exercise${workout.exercises !== 1 ? "s" : ""} in this session`}</span>
              </div>
            )}

            {/* Mark complete button */}
            {!isFuture && (
              <button
                onClick={() => toggleComplete(workout.id)}
                disabled={toggling || progressMissing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50
                  ${completedIds.has(workout.id)
                    ? "bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
                    : "bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-600/25"
                  } ${isRTL ? "flex-row-reverse" : ""}`}
              >
                {toggling
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : completedIds.has(workout.id)
                    ? <><Trophy className="w-4 h-4" />{isRTL ? "تم الإكمال ✓" : "Completed ✓"}</>
                    : <><CheckCircle className="w-4 h-4" />{isRTL ? "تحديد كمكتمل" : "Mark as Completed"}</>
                }
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-transparent pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Page header ── */}
        <div>
          <div className="w-12 h-1 bg-red-600 mb-4 rounded-full" />
          <h1 className="text-4xl font-black text-white mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {t("workouts.title")}
          </h1>
          <p className="text-zinc-500">{t("workouts.subtitle")}</p>
        </div>

        {/* ── progress table missing → SQL banner ── */}
        {progressMissing && (
          <div className="glass rounded-2xl border border-amber-600/30 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300 mb-0.5">
                  {isRTL ? "الإعداد مطلوب لتتبع التقدم" : "One-time setup for progress tracking"}
                </p>
                <p className="text-xs text-zinc-500">
                  {isRTL
                    ? "شغّل هذا SQL في لوحة Supabase لتفعيل تتبع الإنجازات."
                    : "Run this SQL in your Supabase SQL Editor to enable completion tracking."}
                </p>
              </div>
            </div>
            <pre className="text-xs text-green-300 bg-black/40 rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">{PROGRESS_SQL}</pre>
            <button
              onClick={() => { navigator.clipboard.writeText(PROGRESS_SQL).then(() => { setCopiedSql(true); setTimeout(() => setCopiedSql(false), 2000); }); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-zinc-300 border border-white/10 transition-all"
            >
              {copiedSql ? <><Check className="w-3.5 h-3.5 text-green-400" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy SQL</>}
            </button>
          </div>
        )}

        {/* ── Plan selector ── */}
        <div className="glass rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
            {isRTL ? "اختر الباقة" : "Select Plan"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {allPlans.map((plan) => {
              const paid   = isSubscribedToPlan(plan.id);
              const active = plan.id === selectedPlanId;
              const sub    = subscriptions.find((s) => s.plan_id === plan.id);
              return (
                <button key={plan.id} onClick={() => handleSelectPlan(plan)} disabled={!paid}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center
                    ${active  ? "border-red-500/60 bg-red-600/10 ring-1 ring-red-500/40"
                    : paid    ? "border-green-600/30 bg-green-900/10 hover:border-green-500/50 cursor-pointer"
                    :           "border-white/5 opacity-50 cursor-not-allowed"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center
                    ${active ? "bg-red-600" : paid ? "bg-green-700/40" : "bg-zinc-800"}`}>
                    {paid ? <CheckCircle className={`w-4 h-4 ${active ? "text-white" : "text-green-400"}`} />
                           : <Lock className="w-4 h-4 text-zinc-600" />}
                  </div>
                  <span className={`text-sm font-black ${active ? "text-white" : paid ? "text-zinc-200" : "text-zinc-600"}`}
                    style={{ fontFamily: "'Oswald', sans-serif" }}>${plan.price}</span>
                  <span className={`text-xs ${active ? "text-red-300" : paid ? "text-zinc-400" : "text-zinc-700"}`}>
                    {getDurationLabel(plan.price, isRTL)}
                  </span>
                  <span className={`text-xs ${active ? "text-red-400" : paid ? "text-green-500" : "text-zinc-700"}`}>
                    {paid ? (isRTL ? `${getWeeksFromPrice(plan.price)} أسبوع` : `${getWeeksFromPrice(plan.price)} wks`) : (isRTL ? "مقفّل" : "Locked")}
                  </span>
                  {paid && sub && (
                    <span className="text-[10px] text-zinc-600 mt-0.5">
                      {isRTL
                        ? `حتى ${new Date(sub.end_date).toLocaleDateString("ar-KW", { month: "short", day: "numeric" })}`
                        : `exp. ${new Date(sub.end_date).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}`}
                    </span>
                  )}
                  {!paid && (
                    <a href="/plans" onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-red-500 hover:text-red-400 mt-0.5 underline">
                      {isRTL ? "ادفع للفتح" : "Pay to unlock"}
                    </a>
                  )}
                </button>
              );
            })}
          </div>

          {activeSub && (
            <div className={`mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-3 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-400 font-semibold">{activeSub.plan?.name}</span>
                <span className="text-zinc-600 text-xs">·</span>
                <span className="text-zinc-500 text-xs">
                  {isRTL ? `${totalWeeks} أسبوع مفتوح` : `${totalWeeks} week${totalWeeks !== 1 ? "s" : ""} unlocked`}
                </span>
              </div>
              <span className="text-xs text-zinc-600">
                {isRTL
                  ? `ينتهي ${new Date(activeSub.end_date).toLocaleDateString("ar-KW")}`
                  : `Expires ${new Date(activeSub.end_date).toLocaleDateString("en-GB")}`}
              </span>
            </div>
          )}
        </div>

        {/* ── Loading workouts ── */}
        {loadingWorkouts && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        )}

        {!loadingWorkouts && (
          <>
            {dbWorkouts.length === 0 ? (
              /* ── Empty plan ── */
              <div className="glass rounded-2xl border border-white/5 p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-800/60 flex items-center justify-center mx-auto mb-5">
                  <Dumbbell className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-xl font-black text-white mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {isRTL ? "لا توجد تمارين بعد" : "No Workouts Yet"}
                </h3>
                <p className="text-zinc-500 text-sm max-w-sm mx-auto">
                  {isRTL ? "لم يُضف محتوى تدريبي لهذه الباقة بعد. تابعنا قريباً." : "No training content has been added for this plan yet. Please check back soon."}
                </p>
              </div>
            ) : (
              <>
                {/* ══ TODAY'S WORKOUT ══ */}
                {todayWorkout && (
                  <section>
                    <div className={`flex items-center gap-2 mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <CalendarDays className="w-4 h-4 text-red-500" />
                      <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
                        {isRTL ? "تمرين اليوم" : "Today's Workout"}
                      </h2>
                    </div>
                    <WorkoutCard workout={todayWorkout} forceOpen isToday />
                  </section>
                )}

                {/* ══ WEEK SELECTOR ══ */}
                <div className="glass rounded-2xl border border-white/5 p-4">
                  <div className={`flex items-center justify-between mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <span className="text-sm font-semibold text-white">
                      {isRTL ? `الأسبوع ${safeWeek}` : `Week ${safeWeek}`}
                      <span className="text-zinc-500 font-normal"> / {totalWeeks}</span>
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-600/20 text-red-400 font-medium uppercase tracking-wide">
                      {isRTL ? phaseLabel(safeWeek).ar : phaseLabel(safeWeek).en}
                    </span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                    {availableWeeks.map((w) => {
                      const isCurrentWeek = w === todayPos.week;
                      return (
                        <button key={w}
                          onClick={() => { setSelectedWeek(w); setExpandedId(null); }}
                          className={`relative flex-shrink-0 snap-start w-9 h-9 rounded-lg text-sm font-bold transition-all duration-200
                            ${w === safeWeek
                              ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                              : "glass-light text-zinc-400 hover:text-white hover:bg-white/10"
                            }`}
                        >
                          {w}
                          {isCurrentWeek && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-400 border border-black" />
                          )}
                        </button>
                      );
                    })}

                    {totalWeeks > availableWeeks.length && (
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        <div className="w-px h-7 bg-white/10 self-center" />
                        <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-900/60 border border-white/5">
                          <Lock className="w-3 h-3 text-zinc-600" />
                          <span className="text-xs text-zinc-600 font-medium">
                            {isRTL ? `+${totalWeeks - availableWeeks.length} قادمة` : `+${totalWeeks - availableWeeks.length} coming`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ══ STATS ROW ══ */}
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: isRTL ? `${weekWorkouts.length} أيام` : `${weekWorkouts.length} Days`, icon: Zap },
                    { label: isRTL ? "60–75 دقيقة" : "60–75 min", icon: Clock },
                    { label: isRTL ? "متوسط إلى متقدم" : "Intermediate+", icon: Dumbbell },
                    {
                      label: isRTL
                        ? `${completedIds.size} مكتمل`
                        : `${completedIds.size} completed`,
                      icon: Trophy,
                    },
                  ].map((b) => {
                    const Icon = b.icon;
                    return (
                      <div key={b.label} className={`flex items-center gap-2 px-4 py-2 glass rounded-xl border border-white/5 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <Icon className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-zinc-300 font-medium">{b.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* ══ ALL WORKOUTS FOR SELECTED WEEK ══ */}
                {weekWorkouts.length === 0 ? (
                  <p className="text-center text-zinc-600 py-8 text-sm">
                    {isRTL ? "لا توجد تمارين لهذا الأسبوع." : "No workouts for this week yet."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">
                      {isRTL ? `جميع أيام الأسبوع ${safeWeek}` : `All Days — Week ${safeWeek}`}
                    </p>
                    {weekWorkouts.map((w) => (
                      <WorkoutCard key={w.id} workout={w} isToday={w.week === todayPos.week && w.day === todayPos.day} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
