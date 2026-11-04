"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Clock, ShieldCheck, ShieldX, ChevronDown, ZoomIn, CheckCircle2, FileText, ExternalLink, Download, X, Loader2 } from "lucide-react";
import type { ClaimBundle } from "@/lib/api/types";
import { formatClaimRef, formatMoney } from "@/lib/format";
import { SuccessModal, isAwaitingSecondApproval } from "../../hr_components/SuccessModal";
import { useAuth } from "@/context/AuthContext";
import { getHRClaimBundle, updateReimbursementStatus } from "@/lib/actions/hr";
import { approvalErrorMessage } from "@/lib/hr/evidence";

const STATUS_CHIP: Record<string, string> = {
  APPROVED: "bg-success-soft text-success",
  REJECTED: "bg-danger-soft text-danger",
  PARTIAL_APPROVE: "bg-warning-soft text-warning",
  PENDING: "bg-surface-muted text-ink-muted",
};
const CAT: Record<string, string> = { meals: "Meals", transportation: "Transport", accommodation: "Stay", others: "Others" };
const fmt = (n: number | undefined | null) => formatMoney("MYR", n ?? 0);
/** Label/value pairs with empty values dropped, so the page never shows a label with nothing under it. */
function presentFields(pairs: Array<[string, string | null | undefined]>): Array<[string, string]> {
  return pairs.filter((p): p is [string, string] => typeof p[1] === "string" && p[1].trim() !== "");
}

function identityFieldsOf(bundle: ClaimBundle) {
  return presentFields([
    ["Entity", bundle.employee.entity],
    ["Employee Name", bundle.employee.name],
    ["Employee No.", bundle.employee.employee_no],
    ["Position", bundle.employee.position],
    ["Department", bundle.employee.department],
    ["Location", bundle.employee.location],
  ]);
}

function contextFieldsOf(bundle: ClaimBundle) {
  return presentFields([
    ["Destination", bundle.travel_destination],
    ["Purpose", bundle.travel_purpose],
    ["Departure", bundle.departure_date],
    ["Arrival", bundle.arrival_date],
    // Overseas is not recorded yet, so only a real "Yes" is shown.
    ["Overseas Travel", bundle.is_overseas ? "Yes" : null],
  ]);
}


function Card({ title, children, right }: { title: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-surface/80 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-line/15 flex items-center justify-between">
        <h3 className="font-display font-bold text-base text-ink">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold font-display text-ink-muted uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function ClaimFormModal({
  bundle,
  onClose,
}: {
  bundle: ClaimBundle;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalRequested = bundle?.totals?.total_requested || 0;
  const totalApproved = bundle?.totals?.net_approved || 0;
  const totalDeducted = bundle?.totals?.total_deduction || 0;
  const effectiveStatus = (bundle?.overall_judgment || "").replace("_", " ");

  const statusChip: Record<string, string> = {
    APPROVED:             "bg-success-soft text-success",
    PARTIAL_APPROVE: "bg-warning-soft text-warning",
    REJECTED:             "bg-danger-soft text-danger",
    PENDING:              "bg-surface-muted text-ink-muted",
  };
  const statusClass = statusChip[bundle.overall_judgment] || "bg-surface-muted text-ink-muted";

  return (
    <div
      className="fixed inset-0 z-[100] bg-black overflow-auto"
      onClick={onClose}
    >
      <style>{`
        .a4-modal-zoom { zoom: 1; }
        @media (max-width: 850px) {
          .a4-modal-zoom { zoom: calc((100vw - 32px) / 794); }
        }
      `}</style>

      {/* High-visibility fixed close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 md:top-8 md:right-8 z-[200] p-3 bg-ink/60 hover:bg-ink/90 text-white rounded-full shadow-overlay transition-all active:scale-95 border border-white/10"
        aria-label="Close preview"
      >
        <X className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Scrollable canvas region */}
      <div className="min-h-full w-full flex justify-center p-4 md:p-12 pb-24 touch-pan-x touch-pan-y">
        {/* A4 Physical Paper */}
        <div
          className="a4-modal-zoom bg-white rounded-sm shrink-0 border border-line/50"
          style={{ width: "794px", minHeight: "1123px", fontFamily: "sans-serif" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-12 md:p-16 text-ink" style={{ fontSize: "12px" }}>
            {/* Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-ink pb-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                  <span className="text-white font-bold text-xs">R</span>
                </div>
                <span className="font-bold text-xl text-ink tracking-tight">Reclaim Pay</span>
              </div>
              <p className="text-ink-muted text-xs">Automated Reimbursement Management System</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-base text-ink">EXPENSE CLAIM FORM</p>
              <p className="text-ink-muted font-mono text-xs">{formatClaimRef(bundle.id)}</p>
              <p className="text-ink-muted text-xs mt-1">Date: {new Date(bundle.submitted_at).toLocaleDateString()}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${statusClass}`}>
                {effectiveStatus}
              </span>
            </div>
          </div>

          {/* Employee Details */}
          <section className="mb-8">
            <h3 className="font-bold text-xs text-ink-muted uppercase tracking-wider mb-3 border-b border-line pb-1">
              Employee Information
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {presentFields([
                ["Full Name",   bundle.employee.name],
                ["Employee ID", bundle.employee.employee_no],
                ["Department",  bundle.employee.department],
                ["Position",    bundle.employee.position],
              ]).map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">{label}:</span>
                  <span className="font-semibold text-ink">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Claim Context */}
          <section className="mb-8">
            <h3 className="font-bold text-xs text-ink-muted uppercase tracking-wider mb-3 border-b border-line pb-1">
              Claim Context
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {bundle.travel_purpose && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Purpose:</span>
                  <span className="font-semibold">{bundle.travel_purpose}</span>
                </div>
              )}
              {bundle.travel_destination && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Destination:</span>
                  <span className="font-semibold">{bundle.travel_destination}</span>
                </div>
              )}
              {bundle.departure_date && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Departure:</span>
                  <span className="font-semibold">{bundle.departure_date}</span>
                </div>
              )}
              {bundle.arrival_date && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Arrival:</span>
                  <span className="font-semibold">{bundle.arrival_date}</span>
                </div>
              )}
              {bundle.is_overseas && (
                <div className="flex gap-2">
                  <span className="text-ink-muted w-28 shrink-0">Overseas:</span>
                  <span className="font-semibold">Yes</span>
                </div>
              )}
            </div>
          </section>

          {/* Line Items Table */}
          <section className="mb-8">
            <h3 className="font-bold text-xs text-ink-muted uppercase tracking-wider mb-3 border-b border-line pb-1">
              Expense Line Items ({bundle.line_items.length} Receipts)
            </h3>
            <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
              <thead>
                <tr className="bg-surface-muted text-ink-muted uppercase text-[10px] tracking-wider">
                  <th className="text-left py-2 px-3 border border-line font-semibold w-16">Ref</th>
                  <th className="text-left py-2 px-3 border border-line font-semibold">Category / Audit Notes</th>
                  <th className="text-right py-2 px-3 border border-line font-semibold w-28">Requested (RM)</th>
                  <th className="text-right py-2 px-3 border border-line font-semibold w-28">Approved (RM)</th>
                  <th className="text-center py-2 px-3 border border-line font-semibold w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {bundle.line_items.map((item, i) => {
                  return (
                    <tr key={i} className={
                      item.status === "REJECTED" ? "bg-danger-soft"
                    : item.status === "PARTIAL_APPROVE" ? "bg-warning-soft"
                    : item.status === "PENDING"  ? "bg-surface-muted"
                    : "bg-white"
                    }>
                      <td className="py-2 px-3 border border-line font-mono text-[10px] text-ink-muted">
                        {item.document_id.slice(0, 8)}
                      </td>
                      <td className="py-2 px-3 border border-line">
                        {item.category} - {item.description}
                        {item.audit_notes.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {item.audit_notes.map((adj, j) => (
                              <div key={j} className="text-[10px] text-ink-muted flex gap-1">
                                <span className="text-ink-muted">↳</span>
                                <span>{adj.tag} {adj.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 border border-line text-right tabular-nums">
                        {(item.requested_amount || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 border border-line text-right tabular-nums font-semibold">
                        {(item.approved_amount || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 border border-line text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === "APPROVED" ? "bg-success-soft text-success"
                        : item.status === "PARTIAL_APPROVE" ? "bg-warning-soft text-warning"
                        : item.status === "PENDING"  ? "bg-surface-muted text-ink-muted"
                        : "bg-danger-soft text-danger"
                        }`}>
                          {item.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-muted font-bold">
                  <td colSpan={2} className="py-2 px-3 border border-line text-right text-ink">Total Requested</td>
                  <td className="py-2 px-3 border border-line text-right tabular-nums">{totalRequested.toFixed(2)}</td>
                  <td className="py-2 px-3 border border-line text-right tabular-nums text-ink">{totalApproved.toFixed(2)}</td>
                  <td className="py-2 px-3 border border-line" />
                </tr>
                {totalDeducted > 0 && (
                  <tr className="bg-danger-soft">
                     <td colSpan={2} className="py-2 px-3 border border-line text-right text-danger font-semibold">Total Deduction</td>
                     <td className="py-2 px-3 border border-line" />
                     <td className="py-2 px-3 border border-line text-right tabular-nums text-danger font-bold">({totalDeducted.toFixed(2)})</td>
                     <td className="py-2 px-3 border border-line" />
                  </tr>
                )}
                <tr className="bg-accent-soft">
                  <td colSpan={2} className="py-3 px-3 border border-line text-right text-accent font-bold uppercase tracking-wide">NET APPROVED</td>
                  <td className="py-3 px-3 border border-line" />
                  <td className="py-3 px-3 border border-line text-right tabular-nums text-accent font-bold text-base">{totalApproved.toFixed(2)}</td>
                  <td className="py-3 px-3 border border-line" />
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Signature Block */}
          <div className="mt-12 grid grid-cols-2 gap-12 border-t border-line pt-6">
            {["Employee Signature", "HR Authorisation"].map((label) => (
              <div key={label}>
                <div className="h-12 border-b border-line-strong mb-2" />
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="text-xs text-ink-muted mt-0.5">Date: ___________</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-surface-muted flex justify-between text-ink-muted text-[10px]">
            <span>Generated by Reclaim Pay · {formatClaimRef(bundle.id)}</span>
            <span>CONFIDENTIAL — Internal Use Only</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function ViewPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();

  const [bundle, setBundle] = useState<ClaimBundle | undefined | null>(undefined); // undefined = loading
  const [hrDecision, setHrDecision] = useState<"confirm" | "flag" | null>(null);
  const [note, setNote] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [awaitingSecond, setAwaitingSecond] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getHRClaimBundle(id)
      .then((b) => setBundle(b ?? null))
      .catch(() => setBundle(null));
  }, [id]);

  if (bundle === undefined) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3 text-ink-muted">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Loading claim...</span>
    </div>
  );

  if (!bundle) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-ink-muted">This claim couldn&apos;t be loaded. It may not exist: <code className="font-mono">{id}</code></p>
      <button onClick={() => router.push("/hr/dashboard")} className="px-5 py-2 rounded-xl bg-accent text-on-accent text-sm font-semibold">Back to Dashboard</button>
    </div>
  );

  const pct = Math.round(bundle.confidence * 100);
  const identityFields = identityFieldsOf(bundle);
  const contextFields = contextFieldsOf(bundle);

  async function submit() {
    if (!hrDecision) return;
    setSubmitting(true);
    setSubmitError(null);
    const status = hrDecision === "confirm" ? "APPROVED" : hrDecision === "flag" ? "REVIEW" : "REJECTED";
    const res = await updateReimbursementStatus(bundle!.id, status, user!.user_id, {
      hrNote: note || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(res.error ? approvalErrorMessage(res.error) : "Failed to update status.");
      return;
    }

    const awaiting = isAwaitingSecondApproval(res.data);
    setAwaitingSecond(awaiting);
    setShowSuccessModal(true);
    if (!awaiting) router.push("/hr/dashboard");
  }

  return (
    <div className="relative min-h-full p-6 md:p-10 pb-32 lg:pb-10">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[420px] h-[420px] rounded-full bg-success opacity-[0.04] blur-[80px]" />
        <div className="absolute top-40 right-32 w-[260px] h-[260px] rounded-full bg-accent opacity-[0.04] blur-[64px]" />
      </div>

      <div className="relative z-10 mb-8">
        <button onClick={() => router.push("/hr/dashboard")} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-accent mb-4 transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Back to Dashboard
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h2 className="font-display font-bold text-ink" style={{ fontSize: "2rem", letterSpacing: "-0.02em" }}>
            Review AI Approval
          </h2>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-soft text-success border border-success/30 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> Passed AI Review
          </span>
        </div>
        <p className="text-sm text-ink-muted mt-1">
          Claim <span className="font-mono font-semibold">{formatClaimRef(bundle.id)}</span> · Submitted {new Date(bundle.submitted_at).toLocaleString("en-MY")} · <span className="text-success font-semibold">{pct}% confidence</span>
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* ═══ LEFT ═══ */}
        <div className="flex flex-col gap-6">

          {/* Employee Identity */}
          <Card title="Employee Identity">
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {identityFields.map(([l, v]) => <Field key={l} label={l} value={v} />)}
            </div>
          </Card>

          {/* Claim Context: shown only when at least one value was recorded */}
          {contextFields.length > 0 && (
            <Card title="Claim Context">
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {contextFields.map(([l, v]) => <Field key={l} label={l} value={v} />)}
              </div>
            </Card>
          )}

          {/* Official Document */}
          <Card title="Official Document">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-accent/10 rounded-xl shrink-0">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-sm text-ink">Official Claim Form</p>
                  <p className="font-body text-xs text-ink-muted">
                    {formatClaimRef(bundle.id)}_claim_form.pdf
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  id={`view-form-${bundle.id}`}
                  onClick={() => setShowFormModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-accent text-on-accent font-body font-semibold text-sm hover:bg-accent/90 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Official Claim Form
                </button>
                <a
                  id={`download-pdf-${bundle.id}`}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-line/20 text-ink-muted font-body font-semibold text-sm hover:bg-surface-muted transition-colors active:scale-[0.98] cursor-pointer opacity-50"
                  aria-label="Download not yet available"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                </a>
              </div>
            </div>
          </Card>

          {/* Financial Breakdown */}
          <Card title={<>Financial Breakdown <span className="ml-2 text-xs font-body bg-success-soft text-success px-2 py-0.5 rounded-full">{bundle.line_items.length} receipts · All Passed</span></>}>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-muted/60">
                    {["#", "Date", "Category", "Description", "Amount (MYR)", "Status"].map(h => (
                      <th key={h} className="py-3 px-4 text-[10px] font-semibold font-display text-ink-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {bundle.line_items.map((li, idx) => (
                    <tr key={`table-${li.document_id}-${idx}`} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="py-3 px-4 text-ink-muted">
                        {li.receipt_url
                          ? <button onClick={() => setLightbox(li.receipt_url!)} className="flex items-center gap-1 text-accent hover:underline text-xs"><ZoomIn className="w-3 h-3" />{idx + 1}</button>
                          : <span className="text-xs">{idx + 1}</span>}
                      </td>
                      <td className="py-3 px-4 text-ink-muted whitespace-nowrap text-xs">{li.date}</td>
                      <td className="py-3 px-4"><span className="text-xs bg-surface-muted px-2 py-0.5 rounded-full text-ink-muted">{CAT[li.category]}</span></td>
                      <td className="py-3 px-4 text-ink">{li.description}</td>
                      <td className="py-3 px-4 font-semibold tabular-nums text-success whitespace-nowrap">{fmt(li.approved_amount)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CHIP[li.status]}`}>{li.status.replace("_", " ")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden flex flex-col gap-2">
              {bundle.line_items.map((li, idx) => (
                <div key={`mobile-${li.document_id}-${idx}`} className="bg-surface rounded-xl p-4 border border-line/10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {li.receipt_url ? (
                        <button onClick={() => setLightbox(li.receipt_url!)} className="flex items-center gap-1 text-accent hover:underline text-xs">
                          <ZoomIn className="w-3 h-3" />{idx + 1}
                        </button>
                      ) : (
                        <span className="text-xs text-ink-muted font-semibold">#{idx + 1}</span>
                      )}
                      <span className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded-full text-ink-muted">{CAT[li.category]}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CHIP[li.status]}`}>{li.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-ink font-medium mt-2">{li.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-ink-muted">{li.date}</span>
                    <span className="text-sm font-semibold text-success">{fmt(li.approved_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Audit Trail */}
          <Card title={
            <button onClick={() => setAuditOpen(o => !o)} className="w-full flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 font-display font-bold text-base text-ink">
                <Clock className="w-4 h-4 text-ink-muted" strokeWidth={2} /> Audit Trail
                <span className="text-xs bg-surface-muted text-ink-muted px-2 py-0.5 rounded-full">{bundle.audit_log.length}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform ${auditOpen ? "rotate-180" : ""}`} />
            </button>
          }>
            <div className={`overflow-hidden transition-all duration-300 ${auditOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
              <div className="px-6 pb-6 ml-2 pl-6 border-l-2 border-success/40 flex flex-col gap-4">
                {bundle.audit_log.map(e => (
                  <div key={e.id} className="relative">
                    <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-surface border-2 border-success/60" />
                    <p className="text-xs text-ink-muted">{e.timestamp}</p>
                    <p className="text-sm text-ink"><span className="font-semibold">{e.actor}</span> — {e.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ═══ RIGHT ═══ */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:h-fit">

          {/* Approval Summary */}
          <div className="bg-success-soft/80 rounded-xl border border-success/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-success/40 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" strokeWidth={2.5} />
              <h3 className="font-display font-bold text-base text-success">Approval Summary</h3>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold font-display text-success uppercase tracking-wider mb-1">AI Confidence</p>
                  <p className="text-xl font-bold text-success">{pct}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold font-display text-success uppercase tracking-wider mb-1">Receipts</p>
                  <p className="text-xl font-bold text-success">{bundle.line_items.length} / {bundle.line_items.length} passed</p>
                </div>
              </div>
              <div className="rounded-xl bg-success-soft/60 border border-success/50 p-4">
                <p className="text-[10px] font-semibold font-display text-success uppercase tracking-wider mb-1">Total Approved</p>
                <p className="text-2xl font-bold font-display text-success tabular-nums">{fmt(bundle.totals.net_approved)}</p>
              </div>
              <p className="text-xs text-success leading-relaxed">{bundle.summary}</p>
            </div>
          </div>

          {/* AI Analysis */}
          <Card title="AI Analysis">
            <div className="p-6">
              <div className="w-full h-2 rounded-full bg-surface-muted mb-4 overflow-hidden">
                <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-sm text-ink leading-relaxed">{bundle.summary}</p>
            </div>
          </Card>

          {/* HR Confirmation */}
          <Card title={<><span>HR Confirmation</span><span className="text-xs font-normal text-ink-muted ml-2">Verify before finalising</span></>}>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <button id="decision-confirm" onClick={() => setHrDecision("confirm")}
                  className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-semibold font-display transition-all active:scale-[0.98] cursor-pointer border text-left bg-surface ${hrDecision === "confirm" ? "bg-success-soft text-success border-success/30 ring-1 ring-success/30" : "border-line/20 text-ink-muted hover:border-success/30 hover:text-success"}`}>
                  <ShieldCheck className="w-5 h-5 shrink-0" strokeWidth={2} />
                  <div>
                    <p>Confirm & Finalise Approval</p>
                    <p className="text-[11px] font-normal mt-0.5 opacity-70">Approve {fmt(bundle.totals.net_approved)} and notify employee</p>
                  </div>
                </button>
                <button id="decision-flag" onClick={() => setHrDecision("flag")}
                  className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-semibold font-display transition-all active:scale-[0.98] cursor-pointer border text-left bg-surface ${hrDecision === "flag" ? "bg-warning-soft text-warning border-warning/30 ring-1 ring-warning/30" : "border-line/20 text-ink-muted hover:border-warning/30 hover:text-warning"}`}>
                  <ShieldX className="w-5 h-5 shrink-0" strokeWidth={2} />
                  <div>
                    <p>Flag for Re-review</p>
                    <p className="text-[11px] font-normal mt-0.5 opacity-70">Move to Requires Attention queue</p>
                  </div>
                </button>
              </div>

              {hrDecision === "flag" && (
                <div className="flex items-start gap-3 rounded-xl bg-warning-soft/80 border border-warning/60 px-4 py-3">
                  <p className="text-xs text-warning leading-relaxed">This claim will be moved to <span className="font-semibold">Requires Attention</span> for manual HR investigation.</p>
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold font-display text-ink-muted uppercase tracking-wider mb-2 block">
                  HR Note <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <textarea rows={3} placeholder="Add a note for the record…" value={note} onChange={e => setNote(e.target.value)}
                  className="w-full bg-surface-muted rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-muted/50 outline-none ring-1 ring-line/20 focus:ring-accent/40 resize-none transition-all" />
              </div>

              <button id="submit-hr-decision" onClick={submit} disabled={!hrDecision || submitting}
                className={`w-full py-3 rounded-xl text-sm font-semibold font-display transition-all active:scale-[0.97] flex items-center justify-center gap-2 ${
                  hrDecision === "confirm" ? "bg-success text-white hover:bg-success cursor-pointer"
                  : hrDecision === "flag" ? "bg-warning text-white hover:bg-warning cursor-pointer"
                  : "bg-surface-muted text-ink-muted/50 cursor-not-allowed"}`}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {hrDecision === "confirm" ? "Confirm & Finalise Approval" : hrDecision === "flag" ? "Flag for Re-review" : "Select a decision"}
              </button>
              {submitError && (
                <p className="text-xs text-danger text-center font-body mt-1">{submitError}</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Receipt" className="w-full h-full object-contain" />
            <button onClick={() => setLightbox(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-ink/70 text-white flex items-center justify-center">✕</button>
          </div>
        </div>
      )}

      {showFormModal && (
        <ClaimFormModal
          bundle={bundle}
          onClose={() => setShowFormModal(false)}
        />
      )}

      {showSuccessModal && <SuccessModal decision={hrDecision} id={formatClaimRef(bundle.id)} awaitingSecondApproval={awaitingSecond} />}
    </div>
  );
}
