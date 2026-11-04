"""Live timeline steps (DETAIL-PLAN section 10) and the employee-safe view of them."""

from engine.risk.types import AutonomyDecision, AutonomyTier, TimelineStep

LABELS: dict[str, str] = {
    "policy.load": "Loading company policy",
    "receipt.analyze": "Checking receipt against policy",
    "shield.injection": "Scanning for hidden instructions",
    "shield.duplicate": "Checking for duplicate receipts",
    "shield.provenance": "Checking where the image came from",
    "shield.arithmetic": "Checking the totals add up",
    "shield.split": "Checking for split claims",
    "totals.aggregate": "Calculating totals",
    "judgment.final": "AI recommendation",
    "autonomy.decide": "Deciding: pay now or ask HR",
    "payout.create": "Sending to PayPal",
}

STEP_IDS: tuple[str, ...] = tuple(LABELS)

SENT_TO_HR = "Sent to HR for review."


def make_step(step: str, status: str, detail: str | None = None) -> TimelineStep:
    return TimelineStep(step=step, label=LABELS[step], status=status, detail=detail)


def employee_safe(step: TimelineStep) -> TimelineStep:
    """The stream goes to the claimant, so shield steps never say what they found.

    Detail is dropped on every shield step, not only on warnings: a detail that
    appears only on clean checks would tell the employee which check fired.
    """
    if not step.step.startswith("shield."):
        return step
    status = "done" if step.status in ("warn", "fail") else step.status
    return step.model_copy(update={"status": status, "detail": None})


def decision_copy(decision: AutonomyDecision, currency: str, amount: float) -> str:
    """Employee copy for autonomy.decide. HR reads decision.explanation instead."""
    if decision.tier == AutonomyTier.AUTO_PAY:
        return f"Approved automatically. Sending {currency} {amount:,.2f} to your PayPal."
    return SENT_TO_HR
