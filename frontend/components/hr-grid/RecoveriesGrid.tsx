"use client";

import { useCallback, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { RecoveryStatus } from "@/lib/api/reclaim-pay-types";
import { formatClaimRef, formatMoney } from "@/lib/format";
import ClaimLink from "./ClaimLink";
import { tabThroughCell } from "./cellKeyboard";
import { TONE_CLASSES, formatUpdated } from "./ledger";
import {
  RECOVERY_STATUS_META,
  canPreview,
  canWaive,
  disputeHint,
  recoveryOutcomeNote,
  type HRRecovery,
} from "./recoveries";
import { hrGridTheme } from "./theme";

interface RowHandlers {
  onPreview: (recovery: HRRecovery) => void;
  onWaive: (recovery: HRRecovery) => void;
}

function RecoveryStatusPill({ status }: { status: RecoveryStatus }) {
  const meta = RECOVERY_STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${TONE_CLASSES[meta.tone]}`}>
      {meta.label}
    </span>
  );
}

function NoteCell({ recovery }: { recovery: HRRecovery }) {
  const outcome = recoveryOutcomeNote(recovery);
  return (
    <div className="flex flex-col gap-1 py-2 leading-snug whitespace-normal">
      {recovery.dispute_note && (
        <p className="font-medium text-on-surface">Employee replied: {recovery.dispute_note}</p>
      )}
      <p className={recovery.dispute_note ? "text-on-surface-variant" : "text-on-surface"}>{recovery.reason}</p>
      {outcome && <p className="text-on-surface-variant break-words">{outcome}</p>}
    </div>
  );
}

function DisputeUntil({ recovery }: { recovery: HRRecovery }) {
  const hint = disputeHint(recovery);
  return (
    <div className="flex flex-col py-2 leading-snug">
      <span className="tabular-nums">{formatUpdated(recovery.dispute_until)}</span>
      {hint && <span className="text-xs text-on-surface-variant">{hint}</span>}
    </div>
  );
}

const rowBtn =
  "inline-flex items-center justify-center min-h-[44px] px-3 rounded-lg text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer";

function RowActions({ recovery, onPreview, onWaive, wide = false }: { recovery: HRRecovery; wide?: boolean } & RowHandlers) {
  const ref = formatClaimRef(recovery.reim_id);
  const preview = canPreview(recovery.status);
  const waive = canWaive(recovery.status);
  if (!preview && !waive) return <span className="text-on-surface-variant">No action needed</span>;
  return (
    <div className={`flex items-center gap-2 py-1 ${wide ? "[&>button]:flex-1" : ""}`}>
      {preview && (
        <button
          type="button"
          onClick={() => onPreview(recovery)}
          aria-label={`Preview invoice for ${ref}`}
          className={`${rowBtn} border border-outline-variant text-on-surface bg-surface-container-lowest hover:bg-surface-container whitespace-nowrap`}
        >
          Preview invoice
        </button>
      )}
      {waive && (
        <button
          type="button"
          onClick={() => onWaive(recovery)}
          aria-label={`Waive the recovery on ${ref}`}
          className={`${rowBtn} text-on-surface-variant hover:bg-surface-container hover:text-on-surface`}
        >
          Waive
        </button>
      )}
    </div>
  );
}

function RecoveryCard({ recovery, onPreview, onWaive }: { recovery: HRRecovery } & RowHandlers) {
  const hint = disputeHint(recovery);
  return (
    <li className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-on-surface truncate">{recovery.employee_name ?? "Employee"}</p>
          <ClaimLink reimId={recovery.reim_id} />
        </div>
        <p className="font-headline font-bold text-sm text-on-surface tabular-nums shrink-0">
          {formatMoney(recovery.currency, recovery.amount)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs text-on-surface-variant">
        <RecoveryStatusPill status={recovery.status} />
        <span>
          Dispute until {formatUpdated(recovery.dispute_until)}
          {hint && ` (${hint.toLowerCase()})`}
        </span>
      </div>
      <div className="text-sm">
        <NoteCell recovery={recovery} />
      </div>
      <div className="mt-1 text-sm">
        <RowActions recovery={recovery} onPreview={onPreview} onWaive={onWaive} wide />
      </div>
    </li>
  );
}

export default function RecoveriesGrid({ rows, onPreview, onWaive }: { rows: HRRecovery[] } & RowHandlers) {
  // Employee names come from the payout ledger, so hide the column when none matched.
  const showEmployee = rows.some((r) => r.employee_name);

  const columnDefs = useMemo<ColDef<HRRecovery>[]>(
    () => [
      {
        field: "status",
        headerName: "Status",
        width: 112,
        valueFormatter: (p) => (p.value ? RECOVERY_STATUS_META[p.value as RecoveryStatus].label : ""),
        cellRenderer: (p: ICellRendererParams<HRRecovery>) => (p.data ? <RecoveryStatusPill status={p.data.status} /> : null),
      },
      {
        field: "reim_id",
        headerName: "Claim",
        width: 108,
        suppressKeyboardEvent: tabThroughCell,
        cellRenderer: (p: ICellRendererParams<HRRecovery>) => (p.data ? <ClaimLink reimId={p.data.reim_id} /> : null),
      },
      { field: "employee_name", headerName: "Employee", width: 116, hide: !showEmployee, wrapText: true, cellClass: "!leading-snug py-2" },
      {
        field: "amount",
        headerName: "Amount",
        width: 104,
        type: "rightAligned",
        cellClass: "tabular-nums font-semibold",
        valueFormatter: (p) => (p.data ? formatMoney(p.data.currency, p.data.amount) : ""),
      },
      {
        field: "dispute_until",
        headerName: "Dispute until",
        width: 124,
        cellRenderer: (p: ICellRendererParams<HRRecovery>) => (p.data ? <DisputeUntil recovery={p.data} /> : null),
      },
      {
        colId: "note",
        headerName: "Note",
        flex: 1,
        minWidth: 170,
        sortable: false,
        autoHeight: true,
        cellRenderer: (p: ICellRendererParams<HRRecovery>) => (p.data ? <NoteCell recovery={p.data} /> : null),
      },
      {
        colId: "actions",
        headerName: "Actions",
        width: 196,
        sortable: false,
        suppressKeyboardEvent: tabThroughCell,
        cellRenderer: (p: ICellRendererParams<HRRecovery>) =>
          p.data ? <RowActions recovery={p.data} onPreview={onPreview} onWaive={onWaive} /> : null,
      },
    ],
    [showEmployee, onPreview, onWaive],
  );

  const getRowId = useCallback((p: { data: HRRecovery }) => p.data.recovery_id, []);

  return (
    <>
      <div className="hidden sm:block">
        <AgGridReact<HRRecovery>
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
      <ul className="sm:hidden flex flex-col gap-3" aria-label="Recoveries">
        {rows.map((recovery) => (
          <RecoveryCard key={recovery.recovery_id} recovery={recovery} onPreview={onPreview} onWaive={onWaive} />
        ))}
      </ul>
    </>
  );
}
