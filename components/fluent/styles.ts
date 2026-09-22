import { makeStyles, tokens } from "@fluentui/react-components";

// One shared style object so every card/table/empty-state across the admin
// area gets the exact same corner radius, shadow depth, and spacing — first
// built for Analytics, now reused everywhere so nothing drifts page to page.
export const useSharedStyles = makeStyles({
  card: {
    boxShadow: tokens.shadow4,
    borderRadius: tokens.borderRadiusXLarge,
  },
  pageHeaderRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
  },
  sectionHeaderRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalM}`,
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
  },
  segmented: {
    display: "flex",
    gap: tokens.spacingHorizontalXXS,
    padding: tokens.spacingHorizontalXXS,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  // Horizontal-scroll wrapper for wide tables at tablet width, instead of
  // letting columns crush together — used by any table with 6+ columns.
  tableScroll: {
    overflowX: "auto",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: tokens.spacingHorizontalL,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: tokens.spacingHorizontalL,
  },
});
