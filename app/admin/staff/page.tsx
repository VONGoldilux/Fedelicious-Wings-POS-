"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { StaffCard } from "./StaffCard";

// NOTE on adding new staff accounts:
// Creating an auth.users row requires either (a) the person signing up
// themselves once via a sign-up form, or (b) an admin API call using the
// SUPABASE_SERVICE_ROLE_KEY from a secure server-side Route Handler (never
// from the browser). This page manages role/rate/active-status for accounts
// that already exist; see the "Invite a new staff member" panel below for
// the two supported approaches.
export default function StaffPage() {
  const supabase = createClient();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadStaff() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("role")
      .order("full_name");
    setStaff(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateRole(id: string, role: UserRole) {
    setSavingId(id);
    await supabase.from("profiles").update({ role }).eq("id", id);
    await loadStaff();
    setSavingId(null);
  }

  async function updateRate(id: string, hourly_rate: number) {
    setSavingId(id);
    await supabase.from("profiles").update({ hourly_rate }).eq("id", id);
    await loadStaff();
    setSavingId(null);
  }

  async function toggleActive(p: Profile) {
    setSavingId(p.id);
    await supabase
      .from("profiles")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    await loadStaff();
    setSavingId(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Staff Management"
        subtitle="Assign roles and hourly rates. Deactivating an account blocks login without deleting their history."
      />

      {loading ? (
        <LoadingState label="Loading staff…" />
      ) : staff.length === 0 ? (
        <EmptyState message="No staff accounts yet." />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          {staff.map((p) => (
            <StaffCard
              key={p.id}
              staff={p}
              saving={savingId === p.id}
              onUpdateRole={updateRole}
              onUpdateRate={updateRate}
              onToggleActive={toggleActive}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader icon={<UserPlus size={18} />} title="Invite a new staff member" />
        <ol className="ml-5 mt-3 list-decimal space-y-2 text-sm text-char-700/80 dark:text-cream/70">
          <li>
            <span className="font-semibold text-char-900 dark:text-cream">Self sign-up:</span>{" "}
            add a sign-up form (Supabase Auth <code>signUp()</code>) and send the staff member the
            link — a <code>profiles</code> row is created automatically with the default{" "}
            <code>cashier</code> role, which you then change above.
          </li>
          <li>
            <span className="font-semibold text-char-900 dark:text-cream">Admin-created:</span>{" "}
            build a small <code>/app/api/staff/invite/route.ts</code> Route Handler that calls{" "}
            <code>supabase.auth.admin.createUser()</code> using the{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> (server-side only) to create the account and
            send an invite email directly from this page.
          </li>
        </ol>
      </Card>
    </div>
  );
}
