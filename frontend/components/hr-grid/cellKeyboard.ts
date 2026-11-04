import type { SuppressKeyboardEventParams } from "ag-grid-community";

const FOCUSABLE = "a[href], button:not([disabled]), summary, input, select, textarea";

/**
 * AG Grid's Tab jumps between cells and skips what's inside them. This lets Tab walk a cell's
 * own links and buttons first, then hands back to the grid, so they work without a mouse.
 */
export function tabThroughCell({ event, eGridCell }: Pick<SuppressKeyboardEventParams, "event"> & { eGridCell?: HTMLElement }): boolean {
  if (event.key !== "Tab") return false;
  const cell = eGridCell ?? (event.target as HTMLElement).closest<HTMLElement>(".ag-cell");
  if (!cell) return false;
  const inside = Array.from(cell.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (inside.length === 0) return false;
  const at = inside.indexOf(document.activeElement as HTMLElement);
  return event.shiftKey ? at > 0 : at < inside.length - 1;
}
