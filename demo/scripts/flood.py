# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""S7: submit a burst of suspicious claims so the circuit breaker pauses auto-pay.

Logs in as the demo employees, then for each claim: uploads a receipt, waits for
OCR, runs the compliance analysis and waits for its result. The receipts are the
S4 injection and the S5 duplicate, so every claim carries a HIGH signal; the
breaker trips at 6 HIGH decisions out of the last 20.

    uv run demo/scripts/flood.py --base-url https://<staging-api> --dry-run
    uv run demo/scripts/flood.py --base-url https://<staging-api> --count 8

Run it last in a demo take: it leaves auto-pay paused for 60 minutes. Reset with
`--reset-demo` on the seed script (or the kill switch page) before the next take.

The API rate-limits analysis to 5 per minute per client, so the default 13 s gap
between claims keeps 8 claims under that limit (about 2 minutes in total).
"""
import argparse
import hashlib
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

RECEIPTS = Path(__file__).resolve().parent.parent / "receipts"
DEFAULT_RECEIPTS = ["s4_injection.jpg", "s5_dup.jpg"]
DEFAULT_EMPLOYEES = ["employee@example.com", "employee2@example.com"]
DEFAULT_PASSWORD = os.environ.get("DEMO_PASSWORD", "password")


@dataclass
class Claim:
    number: int
    email: str
    receipt: Path

    @property
    def upload_name(self) -> str:
        # The API stores uploads by file name per user, so each claim gets its own name.
        return f"flood-{self.number:02d}-{self.receipt.name}"


def plan(count: int, employees: list[str], receipts: list[Path]) -> list[Claim]:
    return [Claim(i + 1, employees[i % len(employees)], receipts[i % len(receipts)]) for i in range(count)]


def read_sse(client: httpx.Client, url: str, headers: dict, timeout: float) -> dict:
    """Follow a progress stream until its `complete` event and return that event's data."""
    event = None
    with client.stream("GET", url, headers=headers, timeout=httpx.Timeout(10.0, read=timeout)) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and event in ("complete", "error"):
                data = json.loads(line.split(":", 1)[1])
                if event == "error":
                    raise RuntimeError(f"{url} reported an error: {data}")
                return data
    raise RuntimeError(f"{url} closed without a complete event")


def login(client: httpx.Client, api: str, email: str, password: str) -> dict:
    resp = client.post(f"{api}/auth/login", data={"username": email, "password": password})
    if resp.status_code != 200:
        sys.exit(f"Login failed for {email}: HTTP {resp.status_code} {resp.text[:200]}")
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def submit(client: httpx.Client, api: str, headers: dict, claim: Claim, timeout: float) -> list[dict]:
    with claim.receipt.open("rb") as fh:
        resp = client.post(f"{api}/documents/upload", headers=headers,
                           files={"files": (claim.upload_name, fh, "image/jpeg")})
    resp.raise_for_status()
    ocr = read_sse(client, f"{api}/documents/progress/{resp.json()['task_id']}", headers, timeout)

    resp = client.post(f"{api}/reimbursements/analyze", headers=headers,
                       json={"settlement_id": ocr["settlement_id"], "document_ids": ocr["document_ids"]})
    resp.raise_for_status()
    body = resp.json()
    if "reimbursements" in body:  # cached result
        return body["reimbursements"]
    result = read_sse(client, f"{api}/reimbursements/analyze/progress/{body['task_id']}", headers, timeout)
    return result.get("reimbursements", [])


def breaker_status(client: httpx.Client, api: str, hr_email: str, password: str) -> None:
    headers = login(client, api, hr_email, password)
    resp = client.get(f"{api}/autonomy/status", headers=headers)
    if resp.status_code == 404:
        print("GET /autonomy/status returned 404: the autonomy API is not deployed here yet.")
        return
    resp.raise_for_status()
    status = resp.json()
    print(f"Autonomy status: enabled={status.get('enabled')} breaker_until={status.get('breaker_until')}")
    if not status.get("breaker_until"):
        print("The breaker did not trip. Check that the claims got HIGH signals (see tiers above).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", required=True, help="API origin, e.g. https://reclaim-pay-api.onrender.com")
    parser.add_argument("--api-prefix", default="/api/v1", help="API path prefix (default: /api/v1)")
    parser.add_argument("--count", type=int, default=8, help="number of claims to submit (default: 8)")
    parser.add_argument("--delay", type=float, default=13.0,
                        help="seconds between claims (default: 13, to stay under 5 analyses per minute)")
    parser.add_argument("--employee", action="append", metavar="EMAIL",
                        help=f"employee to submit as; repeat for several (default: {', '.join(DEFAULT_EMPLOYEES)})")
    parser.add_argument("--receipt", action="append", metavar="FILE",
                        help=f"receipt in demo/receipts to cycle through (default: {', '.join(DEFAULT_RECEIPTS)})")
    parser.add_argument("--hr", default="hr@example.com", help="HR account used to read the breaker status")
    parser.add_argument("--timeout", type=float, default=300.0, help="seconds to wait for OCR or analysis")
    parser.add_argument("--dry-run", action="store_true", help="print the requests without sending them")
    args = parser.parse_args()

    api = args.base_url.rstrip("/") + args.api_prefix
    employees = args.employee or DEFAULT_EMPLOYEES
    receipts = [RECEIPTS / name if not Path(name).is_absolute() else Path(name) for name in (args.receipt or DEFAULT_RECEIPTS)]
    for r in receipts:
        if not r.exists():
            sys.exit(f"Missing receipt {r}. Run demo/scripts/make_receipts.py first.")
    claims = plan(args.count, employees, receipts)

    if args.dry_run:
        print(f"Dry run against {api}, nothing is sent.\n")
        for email in employees:
            print(f"POST {api}/auth/login  form username={email} password=<{len(DEFAULT_PASSWORD)} chars>")
        for c in claims:
            digest = hashlib.sha256(c.receipt.read_bytes()).hexdigest()[:12]
            print(f"\nClaim {c.number} as {c.email}")
            print(f"  POST {api}/documents/upload  files={c.upload_name} ({c.receipt.stat().st_size} bytes, sha256 {digest}...)")
            print(f"  GET  {api}/documents/progress/<task_id>  until event: complete")
            print(f"  POST {api}/reimbursements/analyze  json={{settlement_id, document_ids}} from the OCR result")
            print(f"  GET  {api}/reimbursements/analyze/progress/<task_id>  until event: complete")
            if c.number < len(claims):
                print(f"  wait {args.delay:g} s")
        print(f"\nPOST {api}/auth/login  form username={args.hr}")
        print(f"GET  {api}/autonomy/status  expect breaker_until set")
        return

    with httpx.Client(timeout=60.0) as client:
        tokens = {email: login(client, api, email, DEFAULT_PASSWORD) for email in employees}
        for c in claims:
            started = time.monotonic()
            try:
                reims = submit(client, api, tokens[c.email], c, args.timeout)
            except (httpx.HTTPError, RuntimeError, KeyError) as exc:
                print(f"Claim {c.number} ({c.email}, {c.receipt.name}) failed: {exc}")
            else:
                for r in reims:
                    print(f"Claim {c.number} ({c.email}, {c.receipt.name}): status={r.get('status')} "
                          f"tier={r.get('tier', 'n/a')} risk_score={r.get('risk_score', 'n/a')}")
            if c.number < len(claims):
                time.sleep(max(0.0, args.delay - (time.monotonic() - started)))
        breaker_status(client, api, args.hr, DEFAULT_PASSWORD)


if __name__ == "__main__":
    main()
