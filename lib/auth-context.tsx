"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  activeTimeLogId: string | null;
  activeClockIn: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: (cashCount?: { expected: number; counted: number }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin/dashboard",
  cashier: "/cashier/pos",
  kitchen: "/kitchen/queue",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimeLogId, setActiveTimeLogId] = useState<string | null>(null);
  const [activeClockIn, setActiveClockIn] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data ?? null);
      return data ?? null;
    },
    [supabase]
  );

  // Finds an open (no clock_out) time_logs row for this staff member, or
  // creates one — this is the "clock in" side of time tracking, run right
  // after a successful login/session restore.
  const ensureClockedIn = useCallback(
    async (staffId: string) => {
      const { data: openLog } = await supabase
        .from("time_logs")
        .select("id, clock_in")
        .eq("staff_id", staffId)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openLog) {
        setActiveTimeLogId(openLog.id);
        setActiveClockIn(openLog.clock_in);
        return;
      }

      const { data: newLog } = await supabase
        .from("time_logs")
        .insert({ staff_id: staffId })
        .select("id, clock_in")
        .single();

      if (newLog) {
        setActiveTimeLogId(newLog.id);
        setActiveClockIn(newLog.clock_in);
      }
    },
    [supabase]
  );

  const clockOut = useCallback(
    async (cashCount?: { expected: number; counted: number }) => {
      if (!activeTimeLogId) return;
      await supabase
        .from("time_logs")
        .update({
          clock_out: new Date().toISOString(),
          ...(cashCount
            ? { expected_cash: cashCount.expected, counted_cash: cashCount.counted }
            : {}),
        })
        .eq("id", activeTimeLogId);
      setActiveTimeLogId(null);
      setActiveClockIn(null);
    },
    [activeTimeLogId, supabase]
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
        await ensureClockedIn(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session?.user) {
        await loadProfile(session.user.id);
        await ensureClockedIn(session.user.id);
      }
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setActiveTimeLogId(null);
        setActiveClockIn(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error: error.message };

      const loadedProfile = data.user ? await loadProfile(data.user.id) : null;
      if (data.user) await ensureClockedIn(data.user.id);

      if (loadedProfile && !loadedProfile.is_active) {
        await supabase.auth.signOut();
        return { error: "This account has been deactivated. Contact the Super Admin." };
      }

      const home = loadedProfile ? ROLE_HOME[loadedProfile.role] : "/login";
      router.push(home ?? "/login");
      return { error: null };
    },
    [supabase, loadProfile, ensureClockedIn, router]
  );

  const signOut = useCallback(
    async (cashCount?: { expected: number; counted: number }) => {
      await clockOut(cashCount);
      await supabase.auth.signOut();
      router.push("/login");
    },
    [clockOut, supabase, router]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        activeTimeLogId,
        activeClockIn,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
