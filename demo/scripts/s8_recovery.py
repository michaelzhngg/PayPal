# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""S8: recover a RM30 overpayment found by the audit.

The story: a seeded employee was auto-paid for a hotel night whose rate already
included breakfast, and also for a RM30 breakfast receipt (demo/receipts/s8_breakfast.jpg).
The audit flags it, HR opens a RM30 recovery, the 5-day dispute window passes, and
HR sends a PayPal sandbox invoice.

The recovery API (DETAIL-PLAN section 9.5) is not built yet. This script calls it
as specified and stops with a clear message on a 404, so it works unchanged once
the routes ship.

    uv run demo/scripts/s8_recovery.py --base-url https://<staging-api> --reim-id <uuid> --dry-run
    uv run demo/scripts/s8_recovery.py --base-url https://<staging-api> --reim-id <uuid>
    uv run demo/scripts/s8_recovery.py --base-url https://<staging-api> --recovery-id <uuid> --execute
"""
import argparse
import json
import os
import sys

import httpx

DEFAULT_PASSWORD = os.environ.get("DEMO_PASSWORD", "password")
AMOUNT = 30.0
REASON = "Breakfast was included in the hotel rate and also claimed separately"


def call(client: httpx.Client, method: str, url: str, headers: dict, body: dict | None = None) -> dict:
    resp = client.request(method, url, headers=headers, json=body)
    if resp.status_code == 404 and "/recoveries" in url:
        sys.exit(f"{method} {url} returned 404: the recovery API is not deployed here yet. "
                 "Use the manual steps in demo/README.md (S8).")
    if resp.status_code == 409:
        sys.exit(f"{method} {url} returned 409 {resp.json().get('detail')}: wait for the dispute window "
                 "to pass, or check whether the employee disputed it.")
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", required=True, help="API origin")
    parser.add_argument("--api-prefix", default="/api/v1", help="API path prefix (default: /api/v1)")
    parser.add_argument("--hr", default="hr@example.com", help="HR account that opens and executes the recovery")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--reim-id", help="auto-paid claim to open a RM30 recovery against")
    target.add_argument("--recovery-id", help="existing recovery (for example the seeded one) to preview or execute")
    parser.add_argument("--execute", action="store_true",
                        help="after the preview, send the invoice or apply the offset (needs the window to have passed)")
    parser.add_argument("--dry-run", action="store_true", help="print the requests without sending them")
    args = parser.parse_args()

    api = args.base_url.rstrip("/") + args.api_prefix
    create_body = {"reim_id": args.reim_id, "amount": AMOUNT, "reason": REASON}

    if args.dry_run:
        print(f"Dry run against {api}, nothing is sent.\n")
        print(f"POST {api}/auth/login  form username={args.hr}")
        if args.reim_id:
            print(f"POST {api}/recoveries  json={json.dumps(create_body)}")
            print("     expect status NOTICE_SENT and dispute_until 120 h from now")
        rid = args.recovery_id or "<recovery_id>"
        print(f"GET  {api}/recoveries/{rid}/invoice-preview  expect the AI-drafted note and a masked email")
        if args.execute:
            print(f"POST {api}/recoveries/{rid}/execute  expect OFFSET or INVOICED (409 while the window is open)")
        return

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(f"{api}/auth/login", data={"username": args.hr, "password": DEFAULT_PASSWORD})
        if resp.status_code != 200:
            sys.exit(f"Login failed for {args.hr}: HTTP {resp.status_code}")
        headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

        recovery_id = args.recovery_id
        if args.reim_id:
            created = call(client, "POST", f"{api}/recoveries", headers, create_body)
            recovery_id = created["recovery_id"]
            print(f"Recovery {recovery_id}: {created['status']}, dispute until {created['dispute_until']}")
            # TODO(Task 2 seed): the seed creates the S8 recovery with dispute_until in the past, so a demo
            # take uses --recovery-id. A recovery opened here cannot be executed for 120 h.

        preview = call(client, "GET", f"{api}/recoveries/{recovery_id}/invoice-preview", headers)
        print(f"Invoice preview: {preview['currency']} {preview['amount']:.2f} to {preview['recipient_email_masked']}")
        print(preview["note"])

        if args.execute:
            done = call(client, "POST", f"{api}/recoveries/{recovery_id}/execute", headers)
            print(f"Executed: {done['status']} invoice={done.get('paypal_invoice_id')} offset={done.get('offset_reim_id')}")


if __name__ == "__main__":
    main()
