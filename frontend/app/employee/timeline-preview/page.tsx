import { notFound } from "next/navigation";
import { FIXTURES_ON } from "@/lib/api/fixtures";
import TimelinePreview from "./_components/TimelinePreview";

// Replays the demo scenarios from fixtures. Only exists in fixture mode; it is also the video fallback.
export default function TimelinePreviewPage() {
  if (!FIXTURES_ON) notFound();
  return <TimelinePreview />;
}
