import type { ReimbursementRaw } from "@/lib/api/types";
import { formatClaimRef, formatMoney } from "@/lib/format";

/**
 * Same split as the DecisionCard pill: auto-pay takes the brand color and every
 * other tier looks alike, so a color never hints at which check a claim tripped.
 */
export type EventTone = "auto" | "hr" | "paid";

export const TONE_ICON: Record<EventTone, string> = {
  auto: "fa fa-circle-check",
  hr: "fa fa-user-clock",
  paid: "fa fa-money-bill-wave",
};

export const TONE_LABEL: Record<EventTone, string> = {
  auto: "Submitted, approved automatically",
  hr: "Submitted, HR check or decision pending",
  paid: "Paid to you",
};

export interface ClaimCalendarEvent {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  allDay: true;
  reimId: string;
  cls: string;
  iconCls: string;
}

type CalendarRow = Pick<ReimbursementRaw, "reim_id" | "created_at" | "tier" | "payout">;

/** The local calendar day of a timestamp, or null when it is missing or unreadable. */
function localDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return new Date(when.getFullYear(), when.getMonth(), when.getDate());
}

function dayEvent(id: string, name: string, reimId: string, tone: EventTone, day: Date): ClaimCalendarEvent {
  return {
    id,
    name,
    startDate: day,
    endDate: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1),
    allDay: true,
    reimId,
    cls: `claim-event claim-event-${tone}`,
    iconCls: TONE_ICON[tone],
  };
}

/** Only a settled payout counts as paid. Accepted, failed and reversed ones never reached the employee. */
export function buildCalendarEvents(rows: CalendarRow[]): ClaimCalendarEvent[] {
  const events: ClaimCalendarEvent[] = [];
  for (const row of rows) {
    const ref = formatClaimRef(row.reim_id);

    const submitted = localDay(row.created_at);
    if (submitted) {
      const tone: EventTone = row.tier === "AUTO_PAY" ? "auto" : "hr";
      events.push(dayEvent(`submitted-${row.reim_id}`, `Submitted ${ref}`, row.reim_id, tone, submitted));
    }

    const payout = row.payout;
    const paid = payout?.status === "SUCCEEDED" ? localDay(payout.updated_at) : null;
    if (payout && paid) {
      const label = `Paid ${formatMoney(payout.currency, payout.amount)}`;
      events.push(dayEvent(`paid-${row.reim_id}`, label, row.reim_id, "paid", paid));
    }
  }
  return events;
}

export function reimIdFromEventId(eventId: string): string {
  return eventId.replace(/^(submitted|paid)-/, "");
}

/** History opens its claim sidebar from this query param. */
export function historyHref(reimId: string): string {
  return `/employee/history?claimId=${encodeURIComponent(reimId)}`;
}

/** The day the calendar opens on: the newest event, so a quiet current month never looks empty. */
export function latestEventDay(events: ClaimCalendarEvent[]): Date | null {
  if (events.length === 0) return null;
  return events.reduce((latest, e) => (e.startDate > latest ? e.startDate : latest), events[0].startDate);
}
