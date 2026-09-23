"use client";

import { Fragment, useState } from "react";
import { Receipt, ChevronDown, ChevronRight } from "lucide-react";
import { formatPeso, formatDateTime, cx } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PaidStatusBadge } from "@/components/ui/Badge";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import type { PayrollPayment, Profile, TimeLog } from "@/lib/types";

export interface PayrollRow {
  staff: Profile;
  logs: TimeLog[];
  totalHours: number;
  totalPay: number;
  payment: PayrollPayment | null;
  history: PayrollPayment[];
}

export function PayrollTable({
  rows,
  loading,
  paying,
  grandTotal,
  onMarkPaid,
}: {
  rows: PayrollRow[];
  loading: boolean;
  paying: string | null;
  grandTotal: number;
  onMarkPaid: (row: PayrollRow) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card padding="none">
      <div className="p-5 pb-0">
        <CardHeader icon={<Receipt size={18} />} title="Per-staff breakdown" />
      </div>

      {loading ? (
        <LoadingState label="Loading payroll…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Receipt size={26} />} message="No time logs for this period yet." />
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-char-800/5 text-xs uppercase tracking-wide text-char-700/50 dark:bg-cream/5 dark:text-cream/50">
              <tr>
                {["", "Staff", "Role", "Rate/hr", "Hours", "Pay", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = expanded === r.staff.id;
                return (
                  <Fragment key={r.staff.id}>
                    <tr
                      className="cursor-pointer border-t border-char-700/10 dark:border-cream/10"
                      onClick={() => setExpanded(isOpen ? null : r.staff.id)}
                    >
                      <td className="w-7 px-4 py-3 text-char-700/50 dark:text-cream/50">
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </td>
                      <td className="px-4 py-3 font-semibold text-char-900 dark:text-cream">{r.staff.full_name}</td>
                      <td className="px-4 py-3 capitalize text-char-700/70 dark:text-cream/70">
                        {r.staff.role.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-char-800 dark:text-cream/90">{formatPeso(r.staff.hourly_rate)}</td>
                      <td className="px-4 py-3 text-char-800 dark:text-cream/90">{r.totalHours} hrs</td>
                      <td className="px-4 py-3 font-semibold text-char-900 dark:text-cream">{formatPeso(r.totalPay)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {r.payment ? (
                          <PaidStatusBadge paid label={`Paid ${formatDateTime(r.payment.paid_at)}`} />
                        ) : (
                          <Button
                            size="sm"
                            disabled={paying === r.staff.id || r.totalHours === 0}
                            loading={paying === r.staff.id}
                            onClick={() => onMarkPaid(r)}
                          >
                            Mark as Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-char-800/[0.03] dark:bg-cream/[0.03]">
                        <td colSpan={7} className="px-4 py-4">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                            Shift detail — this period
                          </p>
                          <div className="mb-4 flex flex-col gap-1">
                            {r.logs.length === 0 ? (
                              <p className="text-sm text-char-700/60 dark:text-cream/60">No shifts this period.</p>
                            ) : (
                              r.logs.map((l) => (
                                <div key={l.id}>
                                  <div className="flex justify-between gap-3 text-sm text-char-800 dark:text-cream/90">
                                    <span>
                                      {formatDateTime(l.clock_in)} → {l.clock_out ? formatDateTime(l.clock_out) : "still clocked in"}
                                    </span>
                                    <span>{l.hours_worked ?? "—"} hrs</span>
                                  </div>
                                  {l.cash_diff != null && (
                                    <p
                                      className={cx(
                                        "text-xs",
                                        l.cash_diff === 0
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-ember-600 dark:text-ember-400"
                                      )}
                                    >
                                      Cash count: {formatPeso(l.counted_cash ?? 0)} counted vs {formatPeso(l.expected_cash ?? 0)}{" "}
                                      expected (
                                      {l.cash_diff === 0
                                        ? "balanced"
                                        : l.cash_diff > 0
                                        ? `over ${formatPeso(l.cash_diff)}`
                                        : `short ${formatPeso(Math.abs(l.cash_diff))}`}
                                      )
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                            Payment history — proof of payment
                          </p>
                          {r.history.length === 0 ? (
                            <p className="text-sm text-char-700/60 dark:text-cream/60">No payments recorded yet.</p>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {r.history.map((p) => (
                                <div key={p.id} className="flex justify-between gap-3 text-sm text-char-800 dark:text-cream/90">
                                  <span>
                                    {p.period_start} → {p.period_end} · {p.total_hours} hrs @ {formatPeso(p.hourly_rate)}/hr
                                  </span>
                                  <span className="font-medium">
                                    {formatPeso(p.gross_pay)} — paid {formatDateTime(p.paid_at)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-char-700/20 font-semibold text-char-900 dark:border-cream/20 dark:text-cream">
                <td className="px-4 py-3" colSpan={5}>
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
    </Card>
  );
}
