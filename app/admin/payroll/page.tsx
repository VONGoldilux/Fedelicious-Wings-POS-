"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatPeso, formatDateTime } from "@/lib/utils";
import type { PayrollPayment, Profile, TimeLog } from "@/lib/types";

interface PayrollRow {
  staff: Profile;
  logs: TimeLog[];
  totalHours: number;
  totalPay: number;
  payment: PayrollPayment | null;
  history: PayrollPayment[];
}

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

export default function PayrollPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [staff, setStaff] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [allHistory, setAllHistory] = useState<PayrollPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [{ month, half }, setPeriod] = useState(defaultMonthAndHalf);
  const [expanded, setExpanded] = useState<string | null>(null);
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
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
            Payroll
          </h1>
          <p className="text-sm text-char-700/70 dark:text-cream/70">
            Paid twice a month — the 15th and the last day of the month.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-char-700/70 dark:text-cream/70">
              Month
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setPeriod({ month: e.target.value, half })}
              className="rounded-md border border-char-700/20 dark:border-cream/15 bg-white dark:bg-char-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-1 rounded-md border border-char-700/20 dark:border-cream/15 bg-white dark:bg-char-900 p-1">
            <button
              onClick={() => setPeriod({ month, half: "first" })}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                half === "first"
                  ? "bg-ember-500 text-white"
                  : "text-char-700/70 dark:text-cream/70 hover:bg-char-800/5 dark:hover:bg-cream/5"
              }`}
            >
              1–15
            </button>
            <button
              onClick={() => setPeriod({ month, half: "second" })}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                half === "second"
                  ? "bg-ember-500 text-white"
                  : "text-char-700/70 dark:text-cream/70 hover:bg-char-800/5 dark:hover:bg-cream/5"
              }`}
            >
              16–end
            </button>
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-char-700/60 dark:text-cream/60">
        Period: {periodStart} → {periodEnd}
      </p>

      {loading ? (
        <p className="text-char-700/60 dark:text-cream/60">Loading payroll…</p>
      ) : rows.length === 0 ? (
        <p className="text-char-700/60 dark:text-cream/60">No time logs for this period yet.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-char-800/5 dark:bg-cream/5 text-char-700/70 dark:text-cream/70">
              <tr>
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Rate/hr</th>
                <th className="px-4 py-3 font-medium">Hours</th>
                <th className="px-4 py-3 font-medium">Pay</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.staff.id}>
                  <tr className="border-t border-char-700/10 dark:border-cream/10 hover:bg-char-800/5 dark:hover:bg-cream/5">
                    <td
                      className="cursor-pointer px-4 py-3 font-medium text-char-900 dark:text-cream"
                      onClick={() =>
                        setExpanded(expanded === r.staff.id ? null : r.staff.id)
                      }
                    >
                      {r.staff.full_name}
                    </td>
                    <td className="px-4 py-3 capitalize text-char-700/70 dark:text-cream/70">
                      {r.staff.role.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">{formatPeso(r.staff.hourly_rate)}</td>
                    <td className="px-4 py-3">{r.totalHours} hrs</td>
                    <td className="px-4 py-3 font-semibold text-char-900 dark:text-cream">
                      {formatPeso(r.totalPay)}
                    </td>
                    <td className="px-4 py-3">
                      {r.payment ? (
                        <span className="rounded-full bg-green-100 dark:bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                          Paid {formatDateTime(r.payment.paid_at)}
                        </span>
                      ) : (
                        <button
                          onClick={() => markPaid(r)}
                          disabled={paying === r.staff.id || r.totalHours === 0}
                          className="rounded bg-ember-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ember-600 disabled:opacity-50"
                        >
                          {paying === r.staff.id ? "Saving…" : "Mark as Paid"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === r.staff.id && (
                    <tr className="border-t border-char-700/10 dark:border-cream/10 bg-char-800/[0.03] dark:bg-cream/[0.03]">
                      <td colSpan={6} className="px-4 py-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                          Shift detail — this period
                        </p>
                        <ul className="mb-4 space-y-1 text-char-700/80 dark:text-cream/80">
                          {r.logs.map((l) => (
                            <li key={l.id}>
                              <div className="flex justify-between">
                                <span>
                                  {formatDateTime(l.clock_in)} →{" "}
                                  {l.clock_out
                                    ? formatDateTime(l.clock_out)
                                    : "still clocked in"}
                                </span>
                                <span>{l.hours_worked ?? "—"} hrs</span>
                              </div>
                              {l.cash_diff != null && (
                                <p
                                  className={`text-xs ${
                                    l.cash_diff === 0
                                      ? "text-green-700 dark:text-green-400"
                                      : "text-ember-600 dark:text-ember-400"
                                  }`}
                                >
                                  Cash count: {formatPeso(l.counted_cash ?? 0)}{" "}
                                  counted vs {formatPeso(l.expected_cash ?? 0)}{" "}
                                  expected (
                                  {l.cash_diff === 0
                                    ? "balanced"
                                    : l.cash_diff > 0
                                    ? `over ${formatPeso(l.cash_diff)}`
                                    : `short ${formatPeso(Math.abs(l.cash_diff))}`}
                                  )
                                </p>
                              )}
                            </li>
                          ))}
                          {r.logs.length === 0 && (
                            <li className="text-char-700/50 dark:text-cream/50">No shifts this period.</li>
                          )}
                        </ul>

                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                          Payment history — proof of payment
                        </p>
                        {r.history.length === 0 ? (
                          <p className="text-char-700/50 dark:text-cream/50">No payments recorded yet.</p>
                        ) : (
                          <ul className="space-y-1 text-char-700/80 dark:text-cream/80">
                            {r.history.map((p) => (
                              <li key={p.id} className="flex justify-between">
                                <span>
                                  {p.period_start} → {p.period_end} ·{" "}
                                  {p.total_hours} hrs @ {formatPeso(p.hourly_rate)}/hr
                                </span>
                                <span className="font-medium text-char-900 dark:text-cream">
                                  {formatPeso(p.gross_pay)} — paid{" "}
                                  {formatDateTime(p.paid_at)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-char-700/20 dark:border-cream/15 font-semibold text-char-900 dark:text-cream">
                <td className="px-4 py-3" colSpan={4}>
                  Total payroll this period
                </td>
                <td className="px-4 py-3" colSpan={2}>
                  {formatPeso(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
