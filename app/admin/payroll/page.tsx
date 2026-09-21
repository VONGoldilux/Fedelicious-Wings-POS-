"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPeso, formatDateTime } from "@/lib/utils";
import type { Profile, TimeLog } from "@/lib/types";

interface PayrollRow {
  staff: Profile;
  logs: TimeLog[];
  totalHours: number;
  totalPay: number;
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function PayrollPage() {
  const supabase = createClient();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeStart, setRangeStart] = useState(() =>
    startOfWeek(new Date()).toISOString().slice(0, 10)
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    const [{ data: staffData }, { data: logsData }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase
        .from("time_logs")
        .select("*")
        .gte("clock_in", new Date(rangeStart).toISOString())
        .lt("clock_in", rangeEnd.toISOString())
        .order("clock_in", { ascending: false }),
    ]);

    setStaff(staffData ?? []);
    setLogs(logsData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart]);

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
        };
      })
      .filter((r) => r.logs.length > 0);
  }, [staff, logs]);

  const grandTotal = rows.reduce((sum, r) => sum + r.totalPay, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900">
            Payroll
          </h1>
          <p className="text-sm text-char-700/70">
            Hours &amp; pay computed from clock-in/out logs × hourly rate.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-char-700/70">
            Week starting
          </label>
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            className="rounded-md border border-char-700/20 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-char-700/60">Loading payroll…</p>
      ) : rows.length === 0 ? (
        <p className="text-char-700/60">No time logs for this week yet.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-char-700/10 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-char-800/5 text-char-700/70">
              <tr>
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Rate/hr</th>
                <th className="px-4 py-3 font-medium">Hours</th>
                <th className="px-4 py-3 font-medium">Pay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.staff.id}>
                  <tr
                    className="cursor-pointer border-t border-char-700/10 hover:bg-char-800/5"
                    onClick={() =>
                      setExpanded(expanded === r.staff.id ? null : r.staff.id)
                    }
                  >
                    <td className="px-4 py-3 font-medium text-char-900">
                      {r.staff.full_name}
                    </td>
                    <td className="px-4 py-3 capitalize text-char-700/70">
                      {r.staff.role.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">{formatPeso(r.staff.hourly_rate)}</td>
                    <td className="px-4 py-3">{r.totalHours} hrs</td>
                    <td className="px-4 py-3 font-semibold text-char-900">
                      {formatPeso(r.totalPay)}
                    </td>
                  </tr>
                  {expanded === r.staff.id && (
                    <tr className="border-t border-char-700/10 bg-char-800/[0.03]">
                      <td colSpan={5} className="px-4 py-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-char-700/50">
                          Shift detail
                        </p>
                        <ul className="space-y-1 text-char-700/80">
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
                                      ? "text-green-700"
                                      : "text-ember-600"
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
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-char-700/20 font-semibold text-char-900">
                <td className="px-4 py-3" colSpan={4}>
                  Total payroll this week
                </td>
                <td className="px-4 py-3">{formatPeso(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
