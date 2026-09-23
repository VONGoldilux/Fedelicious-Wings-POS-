"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Table2, ArrowRight } from "lucide-react";
import type { CategoryItemStat } from "./constants";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

const columns: DataTableColumn<CategoryItemStat>[] = [
  { id: "name", header: "Item", sortValue: (i) => i.name, cell: (i) => i.name },
  { id: "category", header: "Category", sortValue: (i) => i.category, cell: (i) => i.category },
  {
    id: "status",
    header: "Status",
    cell: () => <Badge color="warning">No sales</Badge>,
  },
];

export function DeadStockTable({
  items,
  rangeLabel,
}: {
  items: CategoryItemStat[];
  rangeLabel: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <Card padding="none">
      <div className="p-5 pb-0">
        <CardHeader
          icon={<Table2 size={18} />}
          title={`No sales — ${rangeLabel.toLowerCase()}`}
          description={`${items.length} item${items.length === 1 ? "" : "s"} · candidates for trimming from the menu`}
          action={
            <Link
              href="/admin/products"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ember-500 px-3 text-xs font-semibold text-white hover:bg-ember-600"
            >
              Review menu
              <ArrowRight size={13} />
            </Link>
          }
        />
      </div>

      <div className="px-5 pb-3">
        <div className="relative max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-char-700/40 dark:text-cream/40" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by item or category…"
            className="h-10 w-full rounded-md border border-char-700/20 bg-white pl-9 pr-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-900 dark:text-cream"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-char-700/60 dark:text-cream/60">No items match "{query}".</p>
      ) : (
        <div className="max-h-[360px] overflow-y-auto">
          <DataTable columns={columns} rows={filtered} getRowId={(i) => i.productId} />
        </div>
      )}
    </Card>
  );
}
