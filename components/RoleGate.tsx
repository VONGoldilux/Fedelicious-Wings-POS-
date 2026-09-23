"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppHeader from "@/components/AppHeader";
import { LoadingState } from "@/components/ui/EmptyState";
import type { UserRole } from "@/lib/types";

// Client-side guard as a second layer on top of middleware.ts — redirects
// away if the signed-in profile's role isn't in `allow`. Renders the shared
// header + children once authorized.
export default function RoleGate({
  allow,
  children,
}: {
  allow: UserRole[];
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile && !allow.includes(profile.role)) {
      router.replace("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, profile]);

  if (loading || !profile || !allow.includes(profile.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream dark:bg-char-950">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-char-950">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
