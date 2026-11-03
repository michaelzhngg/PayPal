import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";

// Registered once for every HR grid.
ModuleRegistry.registerModules([AllCommunityModule]);

// Colors from app/globals.css so the grids read as part of the HR portal.
export const hrGridTheme = themeQuartz.withParams({
  accentColor: "#4647d3",
  foregroundColor: "#2c2f31",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#eef1f3",
  headerTextColor: "#595c5e",
  borderColor: "#d9dde0",
  rowHoverColor: "#f5f7f9",
  selectedRowBackgroundColor: "#eef0ff",
  fontFamily: "inherit",
  headerFontWeight: 600,
  fontSize: 13,
  rowHeight: 52,
  headerHeight: 44,
  cellHorizontalPadding: 10,
  wrapperBorderRadius: 12,
});
