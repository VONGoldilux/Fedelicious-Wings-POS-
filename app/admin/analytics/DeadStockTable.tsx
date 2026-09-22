"use client";

import { useMemo, useState } from "react";
import NextLink from "next/link";
import {
  Card,
  CardHeader,
  Title3,
  Caption1,
  Text,
  Badge,
  Button,
  SearchBox,
  DataGrid,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  TableCellLayout,
  createTableColumn,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { DocumentTableRegular, ArrowRightRegular } from "@fluentui/react-icons";
import type { CategoryItemStat } from "./constants";
import { useSharedStyles } from "@/components/fluent/styles";

const columns: TableColumnDefinition<CategoryItemStat>[] = [
  createTableColumn<CategoryItemStat>({
    columnId: "name",
    compare: (a, b) => a.name.localeCompare(b.name),
    renderHeaderCell: () => "Item",
    renderCell: (item) => <TableCellLayout truncate>{item.name}</TableCellLayout>,
  }),
  createTableColumn<CategoryItemStat>({
    columnId: "category",
    compare: (a, b) => a.category.localeCompare(b.category),
    renderHeaderCell: () => "Category",
    renderCell: (item) => <TableCellLayout truncate>{item.category}</TableCellLayout>,
  }),
  createTableColumn<CategoryItemStat>({
    columnId: "status",
    compare: () => 0,
    renderHeaderCell: () => "Status",
    renderCell: () => (
      <TableCellLayout>
        <Badge appearance="tint" color="warning" shape="rounded">
          No sales
        </Badge>
      </TableCellLayout>
    ),
  }),
];

export function DeadStockTable({
  items,
  rangeLabel,
}: {
  items: CategoryItemStat[];
  rangeLabel: string;
}) {
  const styles = useSharedStyles();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <Card size="large" className={styles.card}>
      <CardHeader
        image={<DocumentTableRegular fontSize={20} style={{ color: tokens.colorBrandForeground1 }} />}
        header={<Title3>No sales — {rangeLabel.toLowerCase()}</Title3>}
        description={
          <Caption1>
            {items.length} item{items.length === 1 ? "" : "s"} · candidates for trimming from the menu
          </Caption1>
        }
        action={
          <NextLink href="/admin/products" passHref legacyBehavior>
            <Button as="a" appearance="primary" icon={<ArrowRightRegular />} iconPosition="after" size="small">
              Review menu
            </Button>
          </NextLink>
        }
      />

      <div style={{ marginTop: tokens.spacingVerticalM, marginBottom: tokens.spacingVerticalS }}>
        <SearchBox
          placeholder="Filter by item or category…"
          value={query}
          onChange={(_, data) => setQuery(data.value)}
          style={{ maxWidth: 320, width: "100%" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Text>No items match “{query}”.</Text>
        </div>
      ) : (
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          <DataGrid items={filtered} columns={columns} sortable getRowId={(item) => item.productId} size="small">
            <DataGridHeader>
              <DataGridRow>
                {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody<CategoryItemStat>>
              {({ item, rowId }) => (
                <DataGridRow<CategoryItemStat> key={rowId}>
                  {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
      )}
    </Card>
  );
}
