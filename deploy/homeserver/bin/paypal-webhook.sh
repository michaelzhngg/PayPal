#!/usr/bin/env bash
# Registers the PayPal sandbox webhook for PUBLIC_URL and saves its ID in ~/reclaim/.env.
# Reads the client ID/secret from .env; nothing secret is printed.
cd ~/reclaim || exit 1
get() { sed -n "s/^$1=//p" .env; }
API=$(get PAYPAL_BASE_URL); HOOK="$(get PUBLIC_URL)/api/v1/paypal/webhook"
TOKEN=$(printf 'user = "%s:%s"\n' "$(get PAYPAL_CLIENT_ID)" "$(get PAYPAL_CLIENT_SECRET)" \
  | curl -sS --config - "$API/v1/oauth2/token" -d grant_type=client_credentials \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
[ -n "$TOKEN" ] || echo "!! could not get an access token: check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET"
EVENTS=$(python3 -c 'import json; print(json.dumps([{"name": n} for n in ["PAYMENT.PAYOUTS-ITEM.SUCCEEDED","PAYMENT.PAYOUTS-ITEM.FAILED","PAYMENT.PAYOUTS-ITEM.RETURNED","PAYMENT.PAYOUTS-ITEM.UNCLAIMED","PAYMENT.PAYOUTS-ITEM.BLOCKED","PAYMENT.PAYOUTS-ITEM.DENIED","PAYMENT.PAYOUTS-ITEM.HELD","PAYMENT.PAYOUTS-ITEM.REFUNDED","PAYMENT.PAYOUTS-ITEM.CANCELED","INVOICING.INVOICE.PAID"]]))')
RESP=$(curl -sS "$API/v1/notifications/webhooks" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"url\": \"$HOOK\", \"event_types\": $EVENTS}")
WID=$(printf '%s' "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')
if [ -n "$WID" ]; then
  sed -i -e "s/^PAYPAL_WEBHOOK_ID=.*/PAYPAL_WEBHOOK_ID=$WID/" -e "s/^PAYPAL_MOCK_MODE=.*/PAYPAL_MOCK_MODE=false/" .env
  echo "webhook created: $WID -> $HOOK"; grep -E '^PAYPAL_(WEBHOOK_ID|MOCK_MODE)=' .env
else
  echo "!! webhook not created. PayPal said:"; printf '%s\n' "$RESP"
fi
unset TOKEN
