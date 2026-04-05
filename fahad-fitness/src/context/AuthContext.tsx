import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

/* ════════════════════════════════════════════════
   SINGLE-SESSION ENFORCEMENT
   One row per user in `user_sessions` (user_id PK).
   Login overwrites the row — all other devices see
   a mismatch on their next check and are kicked out.
════════════════════════════════════════════════ */
const SESSION_KEY = "fahad-session-id";

export interface SessionDebug {
  localSid: string | null;
  dbSid: string | null;
  match: boolean | null;
  tableMissing: boolean;
  checkedAt: Date | null;
}

/** Build the correct absolute login URL regardless of base path */
function loginUrl(suffix = "login?kicked=1"): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return `${base}/${suffix}`;
}

/** Generate a new session_id, write it to localStorage AND the DB */
async function setNewSession(userId: string): Promise<void> {
  const sid = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, sid);
  console.log("[session] setNewSession → sid:", sid, "userId:", userId);

  const { error } = await supabase
    .from("user_sessions")
    .upsert(
      { user_id: userId, session_id: sid, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) console.warn("[session] setNewSession DB error:", error.code, error.message);
  else       console.log("[session] setNewSession DB OK — new owner:", sid);
}

/**
 * Fetch the DB session_id and compare to localStorage.
 *
 * Enforcement matrix:
 *  local=none, db=none → enroll (set new session) → valid
 *  local=none, db=SET  → another device owns the seat → INVALID
 *  local=SET,  db=none → DB was wiped; re-enroll → valid
 *  local=SET,  db=SET  → strict compare; mismatch → INVALID
 */
async function checkSession(userId: string): Promise<{
  valid: boolean;
  tableMissing: boolean;
  localSid: string | null;
  dbSid: string | null;
}> {
  const localSid = localStorage.getItem(SESSION_KEY);
  console.log("[session] check START | userId:", userId, "| local:", localSid ?? "(none)");

  const { data, error } = await supabase
    .from("user_sessions")
    .select("session_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    const tableMissing =
      error.code === "42P01" ||
      error.code === "PGRST116" ||
      (msg.includes("relation") && msg.includes("does not exist"));

    console.log(
      tableMissing
        ? "[session] check | TABLE MISSING — enforcement disabled"
        : "[session] check | DB error:" + error.code + " " + error.message
    );
    return { valid: true, tableMissing, localSid, dbSid: null };
  }

  const dbSid = data?.session_id ?? null;
  console.log("[session] check | db:", dbSid ?? "(none)");

  /* local=none, db=none → first use; enroll this device */
  if (!localSid && !dbSid) {
    console.log("[session] check | no sessions anywhere → enrolling");
    await setNewSession(userId);
    return { valid: true, tableMissing: false, localSid: localStorage.getItem(SESSION_KEY), dbSid: null };
  }

  /* local=none, db=SET → another device owns the slot → kick */
  if (!localSid && dbSid) {
    console.log("[session] check | no local session but DB has one → KICK");
    return { valid: false, tableMissing: false, localSid: null, dbSid };
  }

  /* local=SET, db=none → DB row was deleted; re-enroll */
  if (localSid && !dbSid) {
    console.log("[session] check | DB row missing → re-enrolling");
    await setNewSession(userId);
    return { valid: true, tableMissing: false, localSid, dbSid: null };
  }

  /* both present — strict compare */
  const match = localSid === dbSid;
  console.log("[session] check | local:", localSid, "| db:", dbSid, "| match:", match);
  return { valid: match, tableMissing: false, localSid, dbSid };
}

/** Sign out immediately, clear session data, redirect to /login?kicked=1 */
async function forceLogout(): Promise<void> {
  console.log("[session] forceLogout → signing out");
  localStorage.removeItem(SESSION_KEY);
  await supabase.auth.signOut();
  console.log("[session] forceLogout → redirecting to", loginUrl());
  window.location.replace(loginUrl());
}

/* ────────────────────────────────────────────── */

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  photo_url: string | null;
  plan: string;
  subscription_start: string;
  subscription_end: string;
  status: "active" | "expired";
}

interface SignupData {
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  sessionTableMissing: boolean;
  sessionDebug: SessionDebug;
  runSessionCheck: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (data: SignupData) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  uploadProfilePhoto: (file: File) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTableMissing, setSessionTableMissing] = useState(false);
  const [sessionDebug, setSessionDebug] = useState<SessionDebug>({
    localSid: null,
    dbSid: null,
    match: null,
    tableMissing: false,
    checkedAt: null,
  });

  const buildFallbackProfile = (
    userId: string,
    meta: Record<string, string> = {},
    email = ""
  ): UserProfile => ({
    id: userId,
    name: meta.name || meta.full_name || "",
    email: email || meta.email || "",
    phone: meta.phone || "",
    birth_date: meta.birth_date || "",
    photo_url: null,
    plan: "",
    subscription_start: "",
    subscription_end: "",
    status: "expired",
  });

  const fetchProfile = async (
    userId: string,
    email = "",
    meta: Record<string, string> = {}
  ) => {
    try {
      const [{ data: userData }, { data: profileData }] = await Promise.all([
        supabase.from("users").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("profiles")
          .select("avatar_url, phone, full_name, email")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      if (userData) {
        const merged = {
          ...userData,
          name:       profileData?.full_name || userData.name      || meta.name      || "",
          email:      profileData?.email     || userData.email     || email           || "",
          phone:      profileData?.phone     || userData.phone     || meta.phone     || "",
          birth_date: userData.birth_date    || meta.birth_date    || "",
          photo_url:  userData.photo_url     || null,
        };
        setProfile(merged as UserProfile);
      } else {
        const fallback = buildFallbackProfile(userId, meta, email);
        if (profileData) {
          fallback.name  = profileData.full_name || fallback.name;
          fallback.email = profileData.email     || fallback.email;
          fallback.phone = profileData.phone     || fallback.phone;
        }
        setProfile(fallback);
      }
    } catch {
      setProfile(buildFallbackProfile(userId, meta, email));
    }
  };

  /* ── Core check: fetch from DB, compare, update debug state ── */
  const runSessionCheck = useCallback(async (): Promise<void> => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.user) return;

    const result = await checkSession(s.user.id);

    setSessionDebug({
      localSid:     result.localSid,
      dbSid:        result.dbSid,
      match:        result.valid && !result.tableMissing
                      ? (result.localSid === result.dbSid) || result.valid
                      : result.valid,
      tableMissing: result.tableMissing,
      checkedAt:    new Date(),
    });

    if (result.tableMissing) setSessionTableMissing(true);
    if (!result.valid) await forceLogout();
  }, []);

  /* ── onAuthStateChange: single source of truth for auth state ── */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        console.log("[session] onAuthStateChange:", event);

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          localStorage.removeItem(SESSION_KEY);
          setLoading(false);
          return;
        }

        if (sess?.user) {
          /* On page load while already authenticated → verify ownership */
          if (event === "INITIAL_SESSION") {
            const result = await checkSession(sess.user.id);

            setSessionDebug({
              localSid:     result.localSid,
              dbSid:        result.dbSid,
              match:        result.valid,
              tableMissing: result.tableMissing,
              checkedAt:    new Date(),
            });

            if (result.tableMissing) setSessionTableMissing(true);

            if (!result.valid) {
              await forceLogout();
              return;
            }
          }

          /* Session is verified — expose to the rest of the app */
          setSession(sess);
          setUser(sess.user);

          if (
            event === "INITIAL_SESSION" ||
            event === "SIGNED_IN"       ||
            event === "USER_UPDATED"
          ) {
            fetchProfile(
              sess.user.id,
              sess.user.email ?? "",
              (sess.user.user_metadata ?? {}) as Record<string, string>
            );
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /* ── Background enforcement: every 30 s + tab focus ── */
  useEffect(() => {
    const interval = setInterval(runSessionCheck, 30_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.log("[session] tab regained focus — running check");
        runSessionCheck();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [runSessionCheck]);

  /* ── Auth actions ── */
  const login = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    /* Overwrite any existing session — kicks all other devices */
    if (data.user) await setNewSession(data.user.id);
    return { error: null };
  };

  const signup = async (data: SignupData): Promise<{ error: string | null }> => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name:       data.name,
          phone:      data.phone,
          birth_date: data.birth_date,
        },
      },
    });

    if (authError) return { error: authError.message };
    if (!authData.user) return { error: "Signup failed — please try again" };

    const uid = authData.user.id;
    const profilesPayload = { id: uid, full_name: data.name, phone: data.phone, email: data.email };
    const usersPayload    = { id: uid, name: data.name, email: data.email, phone: data.phone, birth_date: data.birth_date, photo_url: null };

    const [{ error: profilesErr }, { error: usersErr }] = await Promise.all([
      supabase.from("profiles").upsert(profilesPayload, { onConflict: "id" }),
      supabase.from("users").upsert(usersPayload,    { onConflict: "id" }),
    ]);

    if (profilesErr) console.error("[signup] profiles upsert FAILED:", profilesErr.message);
    else             console.log("[signup] profiles upsert OK");
    if (usersErr)    console.error("[signup] users upsert FAILED:",    usersErr.message);
    else             console.log("[signup] users upsert OK");

    /* Register this device as the sole active session */
    await setNewSession(uid);
    return { error: null };
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_KEY);
    await supabase.auth.signOut();
    setProfile(null);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;

    const { error: usersErr } = await supabase
      .from("users")
      .upsert({ id: user.id, ...data }, { onConflict: "id" });
    if (usersErr) console.error("[updateProfile] users upsert FAILED:", usersErr.message);

    const profileFields: Record<string, string> = { id: user.id };
    if (data.name  !== undefined) profileFields.full_name = data.name;
    if (data.phone !== undefined) profileFields.phone     = data.phone;
    if (data.email !== undefined) profileFields.email     = data.email;

    if (Object.keys(profileFields).length > 1) {
      const { error: profilesErr } = await supabase
        .from("profiles")
        .upsert(profileFields, { onConflict: "id" });
      if (profilesErr) console.error("[updateProfile] profiles upsert FAILED:", profilesErr.message);
    }

    setProfile((prev) => (prev ? { ...prev, ...data } : prev));
  };

  const uploadProfilePhoto = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const path = `${user.id}/avatar.png`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
    if (uploadError) {
      console.error("Storage upload error:", uploadError.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${urlData.publicUrl}?t=${Date.now()}`;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        sessionTableMissing,
        sessionDebug,
        runSessionCheck,
        login,
        signup,
        logout,
        updateProfile,
        uploadProfilePhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
