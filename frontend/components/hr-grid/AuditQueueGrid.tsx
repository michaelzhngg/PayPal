"use client";

import { useCallback, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { formatMoney } from "@/lib/format";
import ClaimLink from "./ClaimLink";
import { tabThroughCell } from "./cellKeyboard";
import { formatUpdated } from "./ledger";
import { auditAction, type AuditRow } from "./recoveries";
import { hrGridTheme } from "./theme";

const recordBtn =
  "inline-flex items-center justify-center min-h-[44px] px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface bg-surface-container-lowest hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer";

function ActionCell({ row, onRecord }: { row: AuditRow; onRecord: (row: AuditRow) => void }) {
  switch (auditAction(row)) {
    case "record":
      return (
        <button type="button" onClick={() => onRecord(row)} className={recordBtn} aria-label={`Record overpayment on ${row.ref}`}>
          Record overpayment
        </button>
      );
    case "fully_in_recovery":
      return <span className="text-on-surface-variant">Full amount in recovery</span>;
    case "not_paid":
      return <span className="text-on-surface-variant">Not paid yet</span>;
  }
}

function inRecoveryText(row: AuditRow): string {
  return row.inRecovery > 0 ? formatMoney(row.currency, row.inRecovery) : "None";
}

function AuditCard({ row, onRecord }: { row: AuditRow; onRecord: (row: AuditRow) => void }) {
  return (
    <li className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-on-surface truncate">{row.employee}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {row.category} · {row.statusLabel}
          </p>
        </div>
        <p className="font-headline font-bold text-sm text-on-surface tabular-nums shrink-0">
          {formatMoney(row.currency, row.approved)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 mt-2 text-xs text-on-surface-variant">
        <ClaimLink reimId={row.reimId} />
        {row.submittedAt && <span>{formatUpdated(row.submittedAt)}</span>}
      </div>
      {row.inRecovery > 0 && (
        <p className="text-xs text-on-surface-variant mt-2">In recovery: {inRecoveryText(row)}</p>
      )}
      <div className="mt-3 text-sm [&>button]:w-full">
        <ActionCell row={row} onRecord={onRecord} />
      </div>
    </li>
  );
}

export default function AuditQueueGrid({ rows, onRecord }: { rows: AuditRow[]; onRecord: (row: AuditRow) => void }) {
  const columnDefs = useMemo<ColDef<AuditRow>[]>(
    () => [
      {
        field: "ref",
        headerName: "Claim",
        width: 112,
        suppressKeyboardEvent: tabThroughCell,
        cellRenderer: (p: ICellRendererParams<AuditRow>) => (p.data ? <ClaimLink reimId={p.data.reimId} /> : null),
      },
      { field: "employee", headerName: "Employee", flex: 1, minWidth: 130 },
      { field: "category", headerName: "Category", width: 124 },
      {
        field: "approved",
        headerName: "Paid",
        width: 112,
        type: "rightAligned",
        cellClass: "tabular-nums font-semibold",
        valueFormatter: (p) => (p.data ? formatMoney(p.data.currency, p.data.approved) : ""),
      },
      { field: "statusLabel", headerName: "Status", width: 96 },
      {
        field: "inRecovery",
        headerName: "In recovery",
        width: 112,
        type: "rightAligned",
        cellClass: "tabular-nums",
        valueFormatter: (p) => (p.data ? inRecoveryText(p.data) : ""),
      },
      {
        colId: "action",
        headerName: "Action",
        width: 190,
        sortable: false,
        suppressKeyboardEvent: tabThroughCell,
        cellRenderer: (p: ICellRendererParams<AuditRow>) =>
          p.data ? <ActionCell row={p.data} onRecord={onRecord} /> : null,
      },
    ],
    [onRecord],
  );

  const getRowId = useCallback((p: { data: AuditRow }) => p.data.reimId, []);

  return (
    <>
      <div className="hidden sm:block">
        <AgGridReact<AuditRow>
          theme={hrGridTheme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
          getRowId={getRowId}
          domLayout="autoHeight"
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={false}
        />
      </div>
      <ul className="sm:hidden flex flex-col gap-3" aria-label="Claims selected for audit">
        {rows.map((row) => (
          <AuditCard key={row.reimId} row={row} onRecord={onRecord} />
        ))}
      </ul>
    </>
  );
}
