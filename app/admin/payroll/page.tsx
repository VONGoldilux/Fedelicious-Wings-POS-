"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatPeso } from "@/lib/utils";
import type { PayrollPayment, Profile, TimeLog } from "@/lib/types";

import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatCard } from "@/components/ui/StatCard";
import { PayrollTable, type PayrollRow } from "./PayrollTable";

// Payday is the 15th and last day of each month — periods are always
// 1st–15th or 16th–end of month, never a rolling week.
type Half = "first" | "second";

function periodFor(monthStr: string, half: Half) {
  const [y, m] = monthStr.split("-").map(Number);
  if (half === "first") {
    return {
      start: `${monthStr}-01`,
      end: `${monthStr}-15`,
    };
  }
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
  return {
    start: `${monthStr}-16`,
    end: `${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

function defaultMonthAndHalf(): { month: string; half: Half } {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { month, half: now.getDate() <= 15 ? "first" : "second" };
}

const HALF_OPTIONS: { label: string; value: Half }[] = [
  { label: "1–15", value: "first" },
  { label: "16–end", value: "second" },
];

export default function PayrollPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [staff, setStaff] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [allHistory, setAllHistory] = useState<PayrollPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [{ month, half }, setPeriod] = useState(defaultMonthAndHalf);
  const [paying, setPaying] = useState<string | null>(null);

  const { start: periodStart, end: periodEnd } = periodFor(month, half);

  async function loadData() {
    setLoading(true);
    const rangeStart = new Date(`${periodStart}T00:00:00`);
    const rangeEnd = new Date(`${periodEnd}T00:00:00`);
    rangeEnd.setDate(rangeEnd.getDate() + 1); // inclusive of the last day

    const [{ data: staffData }, { data: logsData }, { data: paymentsData }, { data: historyData }] =
      await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase
          .from("time_logs")
          .select("*")
          .gte("clock_in", rangeStart.toISOString())
          .lt("clock_in", rangeEnd.toISOString())
          .order("clock_in", { ascending: false }),
        supabase
          .from("payroll_payments")
          .select("*")
          .eq("period_start", periodStart)
          .eq("period_end", periodEnd),
        supabase
          .from("payroll_payments")
          .select("*")
          .order("period_start", { ascending: false }),
      ]);

    setStaff(staffData ?? []);
    setLogs(logsData ?? []);
    setPayments((paymentsData as PayrollPayment[]) ?? []);
    setAllHistory((historyData as PayrollPayment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart, periodEnd]);

  const rows: PayrollRow[] = useMemo(() => {
    return staff
      .map((s) => {
        const staffLogs = logs.filter((l) => l.staff_id === s.id);
        const totalHours = staffLogs.reduce(
          (sum, l) => sum + (l.hours_worked ?? 0),
          0
        );
        return {
          staff: s,
          logs: staffLogs,
          totalHours: Math.round(totalHours * 100) / 100,
          totalPay: Math.round(totalHours * s.hourly_rate * 100) / 100,
          payment: payments.find((p) => p.staff_id === s.id) ?? null,
          history: allHistory.filter((p) => p.staff_id === s.id),
        };
      })
      .filter((r) => r.logs.length > 0 || r.payment);
  }, [staff, logs, payments, allHistory]);

  const grandTotal = rows.reduce((sum, r) => sum + r.totalPay, 0);
  const pendingCount = rows.filter((r) => !r.payment && r.totalHours > 0).length;

  async function markPaid(row: PayrollRow) {
    if (!profile || row.payment) return;
    setPaying(row.staff.id);
    const { data, error } = await supabase
      .from("payroll_payments")
      .insert({
        staff_id: row.staff.id,
        period_start: periodStart,
        period_end: periodEnd,
        total_hours: row.totalHours,
        hourly_rate: row.staff.hourly_rate,
        gross_pay: row.totalPay,
        paid_by: profile.id,
      })
      .select()
      .single();

    if (!error && data) {
      const payment = data as PayrollPayment;
      setPayments((prev) => [...prev, payment]);
      setAllHistory((prev) => [payment, ...prev]);
    } else if (error) {
      alert(error.message);
    }
    setPaying(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Payroll"
        subtitle="Paid twice a month — the 15th and the last day of the month."
        action={
          <div className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                Month
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setPeriod({ month: e.target.value, half })}
                className="h-10 rounded-md border border-char-700/20 bg-white px-2.5 text-sm dark:border-cream/15 dark:bg-char-900 dark:text-cream"
              />
            </div>
            <SegmentedControl
              ariaLabel="Pay period half"
              options={HALF_OPTIONS}
              value={half}
              onChange={(v) => setPeriod({ month, half: v })}
            />
          </div>
        }
      />

      <p className="text-sm text-char-700/60 dark:text-cream/60">
        Period: {periodStart} → {periodEnd}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total payroll this period" value={formatPeso(grandTotal)} valueClassName="text-ember-600 dark:text-ember-400" />
        <StatCard
          label="Pending disbursements"
          value={String(pendingCount)}
          badge={pendingCount > 0 ? { text: "Needs payout", color: "warning" } : undefined}
        />
      </div>

      <PayrollTable rows={rows} loading={loading} paying={paying} grandTotal={grandTotal} onMarkPaid={markPaid} />
    </div>
  );
}
