import { createLightTheme, createDarkTheme, type BrandVariants, type Theme } from "@fluentui/react-components";

// Shared Fluent UI theme for the whole admin area — originally built for the
// Analytics page redesign, now the single source of truth so Dashboard,
// Transactions, Staff, and Payroll all render with identical tokens instead
// of each page picking its own colors.
//
// Brand ramp interpolated char-950 (#1A1512) -> ember-500 (#F0662B, shade 80 —
// Fluent's convention for "the" primary brand color) -> near-white, matching
// the palette in tailwind.config.ts. Regenerate with Fluent's Theme Designer
// (https://react.fluentui.dev, "Theme Designer" story) if the brand color
// ever changes — this one was hand-interpolated to keep the accent exact.
const brand: BrandVariants = {
  10: "#1A1512",
  20: "#392116",
  30: "#572C19",
  40: "#76381D",
  50: "#944320",
  60: "#B34F24",
  70: "#D15A27",
  80: "#F0662B",
  90: "#F27945",
  100: "#F48B5E",
  110: "#F69E78",
  120: "#F8B192",
  130: "#F9C3AB",
  140: "#FBD6C5",
  150: "#FDE8DE",
  160: "#FFFBF8",
};

// Fluent's default radii are tighter than this app's `rounded-card` (14px).
// Overriding them here means every Fluent component (Card, Button, DataGrid,
// inputs…) picks up the app's actual corner radius instead of Fluent's own.
const radii = {
  borderRadiusMedium: "8px",
  borderRadiusLarge: "10px",
  borderRadiusXLarge: "14px",
};

export const brandLightTheme: Theme = {
  ...createLightTheme(brand),
  ...radii,
  colorNeutralBackground1: "#FFFFFF",
  colorNeutralBackground2: "#FBF4EA", // cream
  colorNeutralBackground3: "#F5EFE4",
  colorNeutralForeground1: "#241D18", // char-900
  colorNeutralForeground2: "#463830", // char-700
  colorNeutralForeground3: "#7A6A58",
  colorNeutralStroke1: "#E5DECF",
  colorNeutralStroke2: "#EFE7D8",
};

export const brandDarkTheme: Theme = {
  ...createDarkTheme(brand),
  ...radii,
  colorNeutralBackground1: "#241D18", // char-900
  colorNeutralBackground2: "#1A1512", // char-950
  colorNeutralBackground3: "#332921", // char-800
  colorNeutralForeground1: "#FBF4EA", // cream
  colorNeutralForeground2: "#C9BFAE",
  colorNeutralForeground3: "#9C8F7C",
  colorNeutralStroke1: "#463830",
  colorNeutralStroke2: "#332921",
};
