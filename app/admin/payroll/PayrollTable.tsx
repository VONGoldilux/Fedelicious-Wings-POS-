"use client";

import { Fragment, useState } from "react";
import { Card, CardHeader, Title3, Button, Text, Caption1, tokens } from "@fluentui/react-components";
import { ReceiptMoneyRegular, ChevronDownRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { formatPeso, formatDateTime } from "@/lib/utils";
import { useSharedStyles } from "@/components/fluent/styles";
import { EmptyState, LoadingState } from "@/components/fluent/EmptyState";
import { PaidStatusBadge } from "@/components/fluent/StatusBadge";
import type { PayrollPayment, Profile, TimeLog } from "@/lib/types";

export interface PayrollRow {
  staff: Profile;
  logs: TimeLog[];
  totalHours: number;
  totalPay: number;
  payment: PayrollPayment | null;
  history: PayrollPayment[];
}

const CELL_PAD = `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`;

// Fluent's DataGrid doesn't support a per-row expandable detail panel, which
// this table needs (shift + payment history on click) — so this is a plain
// table styled with the exact same tokens (header shade, cell padding,
// stroke, status badge) as the Transactions DataGrid, rather than forcing
// the expand behavior into a component that doesn't support it.
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
  const styles = useSharedStyles();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card size="large" className={styles.card}>
      <CardHeader
        image={<ReceiptMoneyRegular fontSize={20} style={{ color: tokens.colorBrandForeground1 }} />}
        header={<Title3>Per-staff breakdown</Title3>}
      />

      {loading ? (
        <LoadingState label="Loading payroll…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={ReceiptMoneyRegular} message="No time logs for this period yet." />
      ) : (
        <div className={styles.tableScroll} style={{ marginTop: tokens.spacingVerticalM }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: tokens.colorNeutralBackground3 }}>
                {["", "Staff", "Role", "Rate/hr", "Hours", "Pay", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: CELL_PAD,
                      fontSize: tokens.fontSizeBase200,
                      fontWeight: tokens.fontWeightSemibold,
                      color: tokens.colorNeutralForeground3,
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                    }}
                  >
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
                      style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}`, cursor: "pointer" }}
                      onClick={() => setExpanded(isOpen ? null : r.staff.id)}
                    >
                      <td style={{ padding: CELL_PAD, width: 28, color: tokens.colorNeutralForeground3 }}>
                        {isOpen ? <ChevronDownRegular fontSize={16} /> : <ChevronRightRegular fontSize={16} />}
                      </td>
                      <td style={{ padding: CELL_PAD, fontWeight: tokens.fontWeightSemibold }}>{r.staff.full_name}</td>
                      <td style={{ padding: CELL_PAD, textTransform: "capitalize", color: tokens.colorNeutralForeground2 }}>
                        {r.staff.role.replace("_", " ")}
                      </td>
                      <td style={{ padding: CELL_PAD }}>{formatPeso(r.staff.hourly_rate)}</td>
                      <td style={{ padding: CELL_PAD }}>{r.totalHours} hrs</td>
                      <td style={{ padding: CELL_PAD, fontWeight: tokens.fontWeightSemibold }}>{formatPeso(r.totalPay)}</td>
                      <td style={{ padding: CELL_PAD }} onClick={(e) => e.stopPropagation()}>
                        {r.payment ? (
                          <PaidStatusBadge paid label={`Paid ${formatDateTime(r.payment.paid_at)}`} />
                        ) : (
                          <Button
                            appearance="primary"
                            size="small"
                            disabled={paying === r.staff.id || r.totalHours === 0}
                            onClick={() => onMarkPaid(r)}
                          >
                            {paying === r.staff.id ? "Saving…" : "Mark as Paid"}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ backgroundColor: tokens.colorNeutralBackground3 }}>
                        <td colSpan={7} style={{ padding: CELL_PAD }}>
                          <Caption1
                            style={{
                              display: "block",
                              marginBottom: tokens.spacingVerticalXS,
                              color: tokens.colorNeutralForeground3,
                              textTransform: "uppercase",
                              letterSpacing: "0.02em",
                            }}
                          >
                            Shift detail — this period
                          </Caption1>
                          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, marginBottom: tokens.spacingVerticalM }}>
                            {r.logs.length === 0 ? (
                              <Text style={{ color: tokens.colorNeutralForeground3 }}>No shifts this period.</Text>
                            ) : (
                              r.logs.map((l) => (
                                <div key={l.id}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalM }}>
                                    <Text>
                                      {formatDateTime(l.clock_in)} → {l.clock_out ? formatDateTime(l.clock_out) : "still clocked in"}
                                    </Text>
                                    <Text>{l.hours_worked ?? "—"} hrs</Text>
                                  </div>
                                  {l.cash_diff != null && (
                                    <Caption1
                                      style={{
                                        color:
                                          l.cash_diff === 0
                                            ? tokens.colorPaletteGreenForeground1
                                            : tokens.colorBrandForeground1,
                                      }}
                                    >
                                      Cash count: {formatPeso(l.counted_cash ?? 0)} counted vs {formatPeso(l.expected_cash ?? 0)}{" "}
                                      expected (
                                      {l.cash_diff === 0
                                        ? "balanced"
                                        : l.cash_diff > 0
                                        ? `over ${formatPeso(l.cash_diff)}`
                                        : `short ${formatPeso(Math.abs(l.cash_diff))}`}
                                      )
                                    </Caption1>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          <Caption1
                            style={{
                              display: "block",
                              marginBottom: tokens.spacingVerticalXS,
                              color: tokens.colorNeutralForeground3,
                              textTransform: "uppercase",
                              letterSpacing: "0.02em",
                            }}
                          >
                            Payment history — proof of payment
                          </Caption1>
                          {r.history.length === 0 ? (
                            <Text style={{ color: tokens.colorNeutralForeground3 }}>No payments recorded yet.</Text>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS }}>
                              {r.history.map((p) => (
                                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalM }}>
                                  <Text>
                                    {p.period_start} → {p.period_end} · {p.total_hours} hrs @ {formatPeso(p.hourly_rate)}/hr
                                  </Text>
                                  <Text weight="medium">
                                    {formatPeso(p.gross_pay)} — paid {formatDateTime(p.paid_at)}
                                  </Text>
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
              <tr style={{ borderTop: `2px solid ${tokens.colorNeutralStroke1}`, fontWeight: tokens.fontWeightSemibold }}>
                <td style={{ padding: CELL_PAD }} colSpan={5}>
                  Total payroll this period
                </td>
                <td style={{ padding: CELL_PAD }} colSpan={2}>
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
