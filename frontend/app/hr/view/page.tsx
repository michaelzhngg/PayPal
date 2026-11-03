import { redirect } from "next/navigation";

// Opening the view route without a claim ID sends HR back to the queue instead of a 404.
export default function HRViewIndex() {
  redirect("/hr/dashboard");
}
