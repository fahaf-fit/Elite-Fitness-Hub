import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: number;
  status: "active" | "cancelled" | "expired";
  payment_status: "paid" | "unpaid" | "pending";
  start_date: string;
  end_date: string;
  plan?: { id: number; name: string; price: number };
}

interface SubscriptionContextType {
  subscription: Subscription | null;        // highest-value active plan
  subscriptions: Subscription[];            // all active paid plans
  isSubscribed: boolean;                    // any active plan exists
  isSubscribedToPlan: (planId: number) => boolean;
  loading: boolean;
  subscribe: (planId: number, durationDays?: number) => Promise<{ error: string | null }>;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*, plan:plan_id(id, name, price)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("payment_status", "paid")
      .gte("end_date", today)
      .order("end_date", { ascending: false });

    if (!error && data) {
      setSubscriptions(data as Subscription[]);
    } else {
      setSubscriptions([]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Primary subscription = the one with the highest plan price (most weeks unlocked)
  const subscription: Subscription | null =
    subscriptions.length === 0
      ? null
      : subscriptions.reduce((best, cur) => {
          const bestPrice = best.plan?.price ?? 0;
          const curPrice  = cur.plan?.price  ?? 0;
          return curPrice > bestPrice ? cur : best;
        });

  const isSubscribed = subscriptions.length > 0;

  const isSubscribedToPlan = (planId: number) =>
    subscriptions.some((s) => s.plan_id === planId);

  const subscribe = async (
    planId: number,
    durationDays = 30
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: "You must be logged in to subscribe" };

    // Block only if same plan_id is already active
    if (isSubscribedToPlan(planId)) {
      return { error: "You are already subscribed to this plan" };
    }

    const startDate = new Date();
    const endDate   = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id:        user.id,
        plan_id:        planId,
        status:         "active",
        payment_status: "paid",
        start_date:     startDate.toISOString().split("T")[0],
        end_date:       endDate.toISOString().split("T")[0],
      })
      .select("*, plan:plan_id(id, name, price)")
      .single();

    if (error) return { error: error.message };

    const newSub = data as Subscription;
    setSubscriptions((prev) => [...prev, newSub]);

    // Auto-create invoice for this subscription
    await supabase.from("invoices").insert({
      user_id: user.id,
      date:    startDate.toISOString().split("T")[0],
      plan:    newSub.plan?.name ?? `Plan ${planId}`,
      amount:  newSub.plan?.price ?? 0,
      status:  "paid",
    });

    return { error: null };
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        subscriptions,
        isSubscribed,
        isSubscribedToPlan,
        loading,
        subscribe,
        refresh: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
