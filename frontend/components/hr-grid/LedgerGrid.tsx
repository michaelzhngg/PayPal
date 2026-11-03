"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { Check, Copy } from "lucide-react";
import { formatMoney, type PayoutLedgerRow, type PayoutStatus } from "@/lib/api/reclaim-pay-types";
import { STATUS_META, TONE_CLASSES, formatUpdated, tierLabel } from "./ledger";

ModuleRegistry.registerModules([AllCommunityModule]);

// Colors from app/globals.css so the grid reads as part of the HR portal.
const ledgerTheme = themeQuartz.withParams({
  accentColor: "#4647d3",
  foregroundColor: "#2c2f31",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#eef1f3",
  headerTextColor: "#595c5e",
  borderColor: "#d9dde0",
  rowHoverColor: "#f5f7f9",
  fontFamily: "inherit",
  headerFontWeight: 600,
  fontSize: 13,
  rowHeight: 52,
  headerHeight: 44,
  wrapperBorderRadius: 12,
});

export function StatusPill({ status }: { status: PayoutStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${TONE_CLASSES[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}

export function CopyBatchId({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!value) return <span className="text-on-surface-variant">Not issued yet</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `Copied ${value}` : `Copy PayPal batch ID ${value}`}
      className="inline-flex items-center gap-1.5 min-h-[44px] -my-2 px-1.5 rounded-md font-mono text-xs text-on-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-on-surface-variant shrink-0" aria-hidden="true" />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

function LedgerCard({ row }: { row: PayoutLedgerRow }) {
  return (
    <li className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-on-surface truncate">{row.employee_name}</p>
          <p className="font-mono text-xs text-on-surface-variant mt-0.5">{row.claim_ref}</p>
        </div>
        <p className="font-headline font-bold text-sm text-on-surface tabular-nums shrink-0">
          {formatMoney(row.currency, row.amount)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-xs text-on-surface-variant">
        <StatusPill status={row.status} />
        <span>{tierLabel(row.tier)}</span>
        <span>Attempt {row.attempt}</span>
        <span className="ml-auto">{formatUpdated(row.updated_at)}</span>
      </div>
      <div className="mt-2 text-xs min-w-0">
        <CopyBatchId value={row.provider_batch_id} />
      </div>
    </li>
  );
}

export default function LedgerGrid({ rows }: { rows: PayoutLedgerRow[] }) {
  const columnDefs = useMemo<ColDef<PayoutLedgerRow>[]>(
    () => [
      { field: "claim_ref", headerName: "Claim", width: 130, cellClass: "font-mono text-xs" },
      { field: "employee_name", headerName: "Employee", flex: 1, minWidth: 150 },
      {
        field: "amount",
        headerName: "Amount",
        width: 130,
        type: "rightAligned",
        cellClass: "tabular-nums font-semibold",
        valueFormatter: (p) => (p.data ? formatMoney(p.data.currency, p.data.amount) : ""),
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        cellRenderer: (p: ICellRendererParams<PayoutLedgerRow>) =>
          p.data ? <StatusPill status={p.data.status} /> : null,
      },
      {
        field: "tier",
        headerName: "Route",
        width: 160,
        valueFormatter: (p) => tierLabel(p.value ?? null),
      },
      { field: "attempt", headerName: "Attempt", width: 100, type: "rightAligned" },
      {
        field: "provider_batch_id",
        headerName: "PayPal batch ID",
        flex: 1,
        minWidth: 200,
        sortable: false,
        cellRenderer: (p: ICellRendererParams<PayoutLedgerRow>) => (
          <CopyBatchId value={p.data?.provider_batch_id ?? null} />
        ),
      },
      {
        field: "updated_at",
        headerName: "Updated",
        width: 140,
        sort: "desc",
        valueFormatter: (p) => (p.value ? formatUpdated(p.value) : ""),
      },
    ],
    [],
  );

  const getRowId = useCallback((p: { data: PayoutLedgerRow }) => p.data.payout_id, []);

  return (
    <>
      <div className="hidden sm:block">
        <AgGridReact<PayoutLedgerRow>
          theme={ledgerTheme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
          getRowId={getRowId}
          domLayout="autoHeight"
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={false}
          suppressCellFocus={false}
        />
      </div>
      <ul className="sm:hidden flex flex-col gap-3" aria-label="Payouts">
        {rows.map((row) => (
          <LedgerCard key={row.payout_id} row={row} />
        ))}
      </ul>
    </>
  );
}
