#!/usr/bin/env bash
# What the launcher refuses, from outside, on the live box:
#
#   deploy/launcher/test/security.sh tapestry.ninja
#
# Takes a little over a minute, because it waits out the signature window. Run it anywhere with curl, on the host, since
# it signs with a throwaway key through the launcher's own container.
set -uo pipefail

DOMAIN="${1:-tapestry.ninja}"
FAILED=0
ok() { printf '  ok: %s\n' "$*"; }
bad() { printf '  FAIL: %s\n' "$*"; FAILED=1; }
code() { curl -s --max-time 30 -o /dev/null -w '%{http_code}' "$@"; }

read -r SECRET _ <<<"$(docker exec edge-launcher node sign.js keygen)"
URL="https://$DOMAIN/api/brains"
HEADER="$(docker exec edge-launcher node sign.js header "$SECRET" GET "$URL")"

[ "$(code -H "Authorization: $HEADER" "$URL")" = 403 ] && ok "a key off the list gets 403" || bad "a key off the list did not get 403"
[ "$(code "$URL")" = 401 ] && ok "no signature gets 401" || bad "no signature did not get 401"

echo "  waiting 61 seconds to replay that signature"
sleep 61
[ "$(code -H "Authorization: $HEADER" "$URL")" = 401 ] && ok "the same event after 60 seconds gets 401" || bad "the replay did not get 401"

[ "$(code "https://$DOMAIN/ask?domain=x.$DOMAIN")" = 404 ] && ok "/ask from outside is 404 for a name that does not exist" || bad "/ask answered"
FIRST="$(docker exec edge-launcher node cli.js list | awk '$2 == "running" {print $1; exit}')"
if [ -n "$FIRST" ]; then
  [ "$(code "https://$DOMAIN/ask?domain=$FIRST.$DOMAIN")" = 404 ] && ok "/ask from outside is 404 for a name that exists" || bad "/ask answered"
fi

if curl -s --max-time 30 -o /dev/null "https://nothing-here-$RANDOM.$DOMAIN/"; then
  bad "a name with no brain got a certificate"
else
  ok "a name with no brain gets no certificate"
fi

if [ "$FAILED" -eq 0 ]; then printf '\nsecurity: PASS\n'; else printf '\nsecurity: FAIL\n'; exit 1; fi
