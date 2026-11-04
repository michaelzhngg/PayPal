import type { Recovery, TrustInfo } from "@/lib/api/reclaim-pay-types";
import FastTrackCard, { FastTrackCardSkeleton } from "./FastTrackCard";
import RecoveryNotice from "./RecoveryNotice";

interface Props {
  /** undefined while loading, null when the endpoint failed or is missing. */
  trust: TrustInfo | null | undefined;
  recoveries: Recovery[] | null | undefined;
  className?: string;
}

/**
 * Fast-track card and any overpayment notices, side by side from md up.
 * Renders nothing when neither has data, so a missing endpoint leaves no gap.
 */
export default function AccountStatus({ trust, recoveries, className = "" }: Props) {
  const notices = recoveries ?? [];
  if (trust === null && notices.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 items-start gap-3 md:grid-cols-2 md:gap-6 ${className}`}>
      {notices.map(r => (
        <RecoveryNotice key={r.recovery_id} recovery={r} />
      ))}
      {trust === undefined ? <FastTrackCardSkeleton /> : trust && <FastTrackCard info={trust} />}
    </div>
  );
}
