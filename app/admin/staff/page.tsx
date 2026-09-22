"use client";

import { useEffect, useState } from "react";
import { FluentProvider, Card, CardHeader, Title3, Text, tokens } from "@fluentui/react-components";
import { PersonAddRegular } from "@fluentui/react-icons";
import { createClient } from "@/lib/supabase/client";
import { useIsDarkMode } from "@/lib/use-dark-mode";
import type { Profile, UserRole } from "@/lib/types";

import { brandLightTheme, brandDarkTheme } from "@/components/fluent/theme";
import { useSharedStyles } from "@/components/fluent/styles";
import { PageHeader } from "@/components/fluent/PageHeader";
import { EmptyState, LoadingState } from "@/components/fluent/EmptyState";
import { StaffCard } from "./StaffCard";

// NOTE on adding new staff accounts:
// Creating an auth.users row requires either (a) the person signing up
// themselves once via a sign-up form, or (b) an admin API call using the
// SUPABASE_SERVICE_ROLE_KEY from a secure server-side Route Handler (never
// from the browser). This page manages role/rate/active-status for accounts
// that already exist; see the "Invite a new staff member" panel below for
// the two supported approaches.
export default function StaffPage() {
  const isDark = useIsDarkMode();
  return (
    <FluentProvider theme={isDark ? brandDarkTheme : brandLightTheme} style={{ backgroundColor: "transparent" }}>
      <StaffContent />
    </FluentProvider>
  );
}

function StaffContent() {
  const supabase = createClient();
  const styles = useSharedStyles();
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
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXL }}>
      <PageHeader
        title="Staff Management"
        subtitle="Assign roles and hourly rates. Deactivating an account blocks login without deleting their history."
      />

      {loading ? (
        <LoadingState label="Loading staff…" />
      ) : staff.length === 0 ? (
        <EmptyState message="No staff accounts yet." />
      ) : (
        <div className={styles.cardGrid}>
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

      <Card size="large" className={styles.card}>
        <CardHeader
          image={<PersonAddRegular fontSize={20} style={{ color: tokens.colorBrandForeground1 }} />}
          header={<Title3>Invite a new staff member</Title3>}
        />
        <ol
          style={{
            marginTop: tokens.spacingVerticalM,
            paddingLeft: tokens.spacingHorizontalXL,
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacingVerticalS,
            color: tokens.colorNeutralForeground2,
          }}
        >
          <li>
            <Text weight="semibold">Self sign-up:</Text>{" "}
            <Text>
              add a sign-up form (Supabase Auth <code>signUp()</code>) and send the staff member the link — a{" "}
              <code>profiles</code> row is created automatically with the default <code>cashier</code> role, which you
              then change above.
            </Text>
          </li>
          <li>
            <Text weight="semibold">Admin-created:</Text>{" "}
            <Text>
              build a small <code>/app/api/staff/invite/route.ts</code> Route Handler that calls{" "}
              <code>supabase.auth.admin.createUser()</code> using the <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              (server-side only) to create the account and send an invite email directly from this page.
            </Text>
          </li>
        </ol>
      </Card>
    </div>
  );
}
