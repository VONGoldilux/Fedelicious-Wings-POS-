"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cx } from "@/lib/utils";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
}

// A small generic sortable table — covers exactly what the old Fluent
// DataGrid usages needed here (sortable columns + custom cell renderers),
// without pulling in a full data-grid component for three tables.
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  emptyMessage,
  onRowClick,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  emptyMessage?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const [sort, setSort] = useState<{ columnId: string; direction: "asc" | "desc" } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col?.sortValue) return rows;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av).localeCompare(String(bv)) * sign;
    });
  }, [rows, sort, columns]);

  function toggleSort(columnId: string) {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: "asc" };
      if (prev.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });
  }

  if (rows.length === 0 && emptyMessage) {
    return <>{emptyMessage}</>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-char-800/5 text-xs uppercase tracking-wide text-char-700/50 dark:bg-cream/5 dark:text-cream/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                className={cx(
                  "px-4 py-2.5 font-medium",
                  col.align === "right" && "text-right"
                )}
              >
                {col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.id)}
                    className={cx(
                      "inline-flex items-center gap-1 hover:text-char-900 dark:hover:text-cream",
                      col.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {col.header}
                    {sort?.columnId === col.id ? (
                      sort.direction === "asc" ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )
                    ) : (
                      <ChevronsUpDown size={13} className="opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-char-700/10 dark:divide-cream/10">
          {sortedRows.map((row) => (
            <tr
              key={getRowId(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer hover:bg-char-800/[0.03] dark:hover:bg-cream/[0.03]" : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cx(
                    "px-4 py-3 text-char-800 dark:text-cream/90",
                    col.align === "right" && "text-right",
                    col.className
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
