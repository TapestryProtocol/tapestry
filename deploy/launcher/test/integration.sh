#!/usr/bin/env bash
# The launcher against real Docker, on a dev machine: create, ready, memory, blank, destroy, restore, reap, slug free.
#
#   deploy/launcher/test/integration.sh
#
# Uses TEST_IMAGE (default tapestry-brains:local; build it first with `docker build -t tapestry-brains:local .`).
# On a machine with little memory for Docker, the strfry compile can get killed; a copy of the Dockerfile with a lower
# `make -j` gets past that, without changing what is built.
#
# Brings up its own edge stack on ports 18080 and 18443 with Caddy's internal certificates, and a throwaway registry on
# port 15000 so the launcher pulls images the way it does on the droplet. Needs room for two brains: about 5 GB of memory
# for Docker. Removes everything it made when it finishes. It refuses to run if an edge stack is already up, so it cannot
# touch a real one.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEST_IMAGE="${TEST_IMAGE:-tapestry-brains:local}"
REGISTRY=localhost:15000
IMAGE_REPO="$REGISTRY/tapestry-brains"
SEARCH_REPO="$REGISTRY/tapestry-brains-search"
IMAGE_TAG=first
SLUG="${TEST_SLUG:-itest}"
TWO="$SLUG-two"
DOMAIN=tapestry.test
PORT=18443
COMPOSE=(docker compose -f "$REPO/deploy/edge/docker-compose.yml")
WORK="$(mktemp -d "${TMPDIR:-/tmp}/brains-integration.XXXXXX")"
FAILED=0

step() { printf '\n== %s\n' "$*"; }
ok() { printf '  ok: %s\n' "$*"; }
bad() { printf '  FAIL: %s\n' "$*"; FAILED=1; }
die() { printf '  FAIL: %s\n' "$*"; FAILED=1; exit 1; }

if docker ps -a --format '{{.Names}}' | grep -qx edge-launcher; then
  echo "An edge-launcher container already exists. This script will not run beside it."
  exit 2
fi
docker image inspect "$TEST_IMAGE" >/dev/null 2>&1 || { echo "No image $TEST_IMAGE. Build it first."; exit 2; }

remove_brain() {
  local project="brain-$1"
  docker network disconnect "${project}_default" edge-caddy >/dev/null 2>&1 || true
  docker ps -aq --filter "label=com.docker.compose.project=$project" | xargs -r docker rm -f >/dev/null 2>&1 || true
  docker network rm "${project}_default" >/dev/null 2>&1 || true
  docker volume ls -q --filter "label=com.docker.compose.project=$project" | xargs -r docker volume rm >/dev/null 2>&1 || true
}
cleanup() {
  step "cleaning up"
  remove_brain "$SLUG"
  remove_brain "$TWO"
  "${COMPOSE[@]}" down -v --rmi local >/dev/null 2>&1 || true
  docker rm -f brains-itest-registry >/dev/null 2>&1 || true
  docker rmi brains-itest-rolled:latest >/dev/null 2>&1 || true
  docker images --format '{{.Repository}}:{{.Tag}}' | grep "^$REGISTRY/" | xargs -r docker rmi >/dev/null 2>&1 || true
  rm -rf "$WORK"
  if [ "$FAILED" -eq 0 ]; then printf '\nintegration: PASS\n'; else printf '\nintegration: FAIL\n'; exit 1; fi
}
trap cleanup EXIT

mkdir -p "$WORK/brains" "$WORK/launcher/config"
export BRAINS_DIR="$WORK/brains" LAUNCHER_DIR="$WORK/launcher"
export HTTP_PORT=18080 HTTPS_PORT="$PORT" BASE_DOMAIN="$DOMAIN" CADDY_GLOBAL_EXTRA=local_certs

step "pushing the image to a throwaway registry"
docker run -d --name brains-itest-registry -p 127.0.0.1:15000:5000 registry:2 >/dev/null || die "the registry did not start"
sleep 2
publish() { # TAG IMAGE: pushes IMAGE as both the tapestry and the search image
  docker tag "$2" "$IMAGE_REPO:$1" && docker push -q "$IMAGE_REPO:$1" >/dev/null \
    && docker tag "$2" "$SEARCH_REPO:$1" && docker push -q "$SEARCH_REPO:$1" >/dev/null
}
publish "$IMAGE_TAG" "$TEST_IMAGE" || die "could not push the image"
ok "pushed"

step "bringing up the edge stack"
echo '[]' > "$WORK/launcher/config/allowlist.json"
write_launcher_json() { # GRACE_DAYS READY_SECONDS
  cat > "$WORK/launcher/config/launcher.json" <<JSON
{
  "baseDomain": "$DOMAIN",
  "baseUrl": "https://$DOMAIN:$PORT",
  "image": "$IMAGE_REPO",
  "searchImage": "$SEARCH_REPO",
  "imageTag": "$IMAGE_TAG",
  "readyTimeoutSeconds": $2,
  "graceDays": $1
}
JSON
  docker kill -s HUP edge-launcher >/dev/null 2>&1 || true
  sleep 1
}
write_launcher_json 7 600
"${COMPOSE[@]}" up -d --build >/dev/null 2>&1 || die "the edge stack did not come up"
for _ in $(seq 1 30); do docker exec edge-launcher true 2>/dev/null && break; sleep 1; done

read -r SECRET PUBKEY <<<"$(docker exec edge-launcher node sign.js keygen)"
echo "[{\"pubkey\":\"$PUBKEY\",\"label\":\"integration\"}]" > "$WORK/launcher/config/allowlist.json"
docker kill -s HUP edge-launcher >/dev/null
sleep 1

curl_edge() {
  local host="$1" path="$2"; shift 2
  curl -sk --max-time 30 --resolve "$host:$PORT:127.0.0.1" "$@" "https://$host:$PORT$path"
}
api() { # METHOD PATH [BODY]: prints "<http status> <body>"
  local method="$1" path="$2" body="${3:-}" header
  header="$(docker exec edge-launcher node sign.js header "$SECRET" "$method" "https://$DOMAIN:$PORT$path" "$body")"
  local args=(-X "$method" -H "Authorization: $header" -w '\n%{http_code}')
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  curl_edge "$DOMAIN" "$path" "${args[@]}"
}
status_of() { curl_edge "$DOMAIN" "/api/brains/$1/status"; }
wait_for() { # SLUG WORD SECONDS: prints how long it took
  local slug="$1" word="$2" limit="$3" start now s
  start=$(date +%s)
  while :; do
    s="$(status_of "$slug")"
    if printf '%s' "$s" | grep -q "\"status\":\"$word\"" && printf '%s' "$s" | grep -q '"phase":null'; then
      echo $(( $(date +%s) - start )); return 0
    fi
    now=$(date +%s)
    if [ $((now - start)) -gt "$limit" ]; then echo "timeout: $s"; return 1; fi
    printf '%s' "$s" | grep -q '"status":"failed"' && { echo "failed: $s"; return 1; }
    sleep 3
  done
}
field() { printf '%s' "$1" | head -n 1 | sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p"; }

step "the page answers through Caddy, and /ask does not"
curl_edge "$DOMAIN" / | grep -q 'can be read by anyone with its URL' && ok "page" || bad "page"
[ "$(curl_edge "$DOMAIN" "/ask?domain=$SLUG.$DOMAIN" -o /dev/null -w '%{http_code}')" = 404 ] && ok "/ask is 404 from outside" || bad "/ask answered from outside"

step "create"
OUT="$(api POST /api/brains "{\"slug\":\"$SLUG\"}")"
[ "$(printf '%s' "$OUT" | tail -n 1)" = 202 ] && ok "202" || die "create answered: $OUT"
if ELAPSED="$(wait_for "$SLUG" running 600)"; then ok "running in ${ELAPSED}s"; else
  docker exec "brain-$SLUG-tapestry" sh -c 'tail -n 30 /var/log/brainstorm/firmware-on-boot.log; tail -n 20 /var/log/supervisor/brainstorm-error.log' 2>/dev/null
  die "did not reach running: $ELAPSED"
fi
C="brain-$SLUG-tapestry"
docker exec "$C" curl -sf http://localhost/api/ready >/dev/null && ok "/api/ready is 200 inside the container" || bad "/api/ready"

step "memory: heap from the variable, not 40% of the host"
HEAP_MB="$(sed -n 's/^BRAINSTORM_NEO4J_HEAP_MB=//p' "$WORK/brains/$SLUG/.env")"
ARGS="$(docker exec "$C" sh -c 'ps -eo args' | grep CommunityEntryPoint | grep -v grep | grep -o -- '-Xmx[0-9]*[a-zA-Z]*' | head -n 1)"
[ "$ARGS" = "-Xmx$((HEAP_MB * 1024))k" ] && ok "Neo4j has $ARGS for $HEAP_MB MB" || bad "Neo4j has '$ARGS', expected $HEAP_MB MB"
LIMIT="$(docker inspect -f '{{.HostConfig.Memory}}' "$C")"
[ "$LIMIT" = "$((2 * 1024 * 1024 * 1024))" ] && ok "container limit is 2 GiB" || bad "container limit is $LIMIT"

step "blank: no router streams, no ports, search off"
docker exec "$C" sh -c "tr -d ' \n' < /etc/strfry-router-tapestry.config" | grep -q 'streams{}' && ok "router has no streams" || bad "router has streams"
if docker exec "$C" grep -q '"enabled": *true' /var/lib/brainstorm/router-state.json; then bad "a preset is on"; else ok "every preset off"; fi
[ -z "$(docker port "$C")" ] && ok "no ports published" || bad "ports published"
docker ps --format '{{.Names}}' | grep -q "brain-$SLUG-nostr-search" && bad "search is running" || ok "search is off"
docker exec "$C" curl -s http://127.0.0.1:7778/api/publish-policy | grep -q '"allowExternalPublish":false' && ok "publishes to its own relay only" || bad "publishes outside"
ADMINS="$(docker exec "$C" sh -c '. /etc/brainstorm.conf; echo "$BRAINSTORM_OWNER_PUBKEY $BRAINSTORM_ADMIN_PUBKEYS"')"
[ "$ADMINS" = "$PUBKEY $PUBKEY" ] && ok "owner and admin are the signer" || bad "owner and admin: $ADMINS"

step "through Caddy, with a certificate only for a brain that exists"
[ "$(curl_edge "$SLUG.$DOMAIN" /api/ready -o /dev/null -w '%{http_code}')" = 200 ] && ok "$SLUG.$DOMAIN answers" || bad "$SLUG.$DOMAIN"
curl_edge "nothing.$DOMAIN" / -o /dev/null && bad "nothing.$DOMAIN got a certificate" || ok "nothing.$DOMAIN got no certificate"
docker exec "$C" curl -s http://127.0.0.1:7778/api/firmware/install-status | grep -q '"installed":true' && ok "firmware installed" || bad "firmware"
docker exec "$C" test -s /var/lib/brainstorm/firmware-on-boot.installed && ok "the install finished, not just its headers" || bad "no firmware marker"

step "details, and a marker to prove data survives"
DETAIL="$(api GET "/api/brains/$SLUG")"
PW="$(field "$DETAIL" neo4jPassword)"
[ "${#PW}" = 32 ] && ok "owner reads the password" || die "no password in: $DETAIL"
cypher() { docker exec "$C" cypher-shell -u neo4j -p "$PW" --format plain "$1"; }
cypher "CREATE (:IntegrationMarker {v: 'still here'})" >/dev/null || die "could not write a marker"

step "destroy keeps the volumes"
[ "$(api DELETE "/api/brains/$SLUG" | tail -n 1)" = 202 ] && ok "202" || bad "destroy"
wait_for "$SLUG" stopped 120 >/dev/null && ok "stopped" || die "did not stop"
[ -z "$(docker ps -a --format '{{.Names}}' | grep "^brain-$SLUG" || true)" ] && ok "containers gone" || bad "containers remain"
[ -n "$(docker volume ls -q --filter "name=brain-${SLUG}_neo4j")" ] && ok "volumes kept" || bad "volumes gone"
[ "$(api POST /api/brains "{\"slug\":\"$SLUG\"}" | tail -n 1)" = 409 ] && ok "the name stays taken" || bad "the name was free"

step "restore brings the data back"
[ "$(api POST "/api/brains/$SLUG/restore" | tail -n 1)" = 202 ] && ok "202" || bad "restore"
ELAPSED="$(wait_for "$SLUG" running 600)" && ok "running in ${ELAPSED}s" || die "did not come back: $ELAPSED"
cypher "MATCH (m:IntegrationMarker) RETURN m.v" | grep -q 'still here' && ok "marker survived" || bad "marker lost"

step "the roll moves a running brain to a new image and keeps its data"
docker exec edge-launcher node cli.js list | grep -q "$SLUG" && ok "cli list" || bad "cli list"
ROLLED_ID_BEFORE="$(docker inspect -f '{{.Image}}' "$C")"
printf 'FROM %s\nLABEL brains.test=rolled\n' "$IMAGE_REPO:$IMAGE_TAG" | docker build -q -t brains-itest-rolled:latest - >/dev/null || die "could not build the new image"
publish rolled brains-itest-rolled:latest || die "could not push the new image"
docker exec edge-launcher node cli.js roll rolled && ok "roll exits 0" || bad "roll failed"
[ "$(docker inspect -f '{{.Image}}' "$C")" != "$ROLLED_ID_BEFORE" ] && ok "the container is on the new image" || bad "the container did not change"
[ "$(field "$(api GET "/api/brains/$SLUG")" imageTag)" = rolled ] && ok "the registry records the tag" || bad "the registry has the old tag"
docker exec "$C" curl -sf http://localhost/api/ready >/dev/null && ok "ready after the roll" || bad "not ready after the roll"
cypher "MATCH (m:IntegrationMarker) RETURN m.v" | grep -q 'still here' && ok "marker survived the roll" || bad "marker lost in the roll"

step "a second brain: new brains and isolation"
[ "$(api POST /api/brains "{\"slug\":\"$TWO\"}" | tail -n 1)" = 202 ] && ok "202" || die "second create"
ELAPSED="$(wait_for "$TWO" running 600)" && ok "running in ${ELAPSED}s" || die "second brain did not start: $ELAPSED"
"$REPO/deploy/launcher/test/isolation.sh" | grep -E 'FAIL|^isolation:' ; [ "${PIPESTATUS[0]}" -eq 0 ] && ok "isolation.sh is green" || bad "isolation.sh"

step "a roll stops at a brain that does not come back, and leaves the rest"
TWO_IMAGE="$(docker inspect -f '{{.Image}}' "brain-$TWO-tapestry")"
GOOD_PW="$PW"
sed -i.bak 's/^NEO4J_PASSWORD=.*/NEO4J_PASSWORD=wrongwrongwrongwrongwrongwrong12/' "$WORK/brains/$SLUG/.env"
write_launcher_json 7 45
printf 'FROM %s\nLABEL brains.test=rolled-again\n' "$IMAGE_REPO:$IMAGE_TAG" | docker build -q -t brains-itest-rolled:latest - >/dev/null
publish again brains-itest-rolled:latest || die "could not push the third image"
if docker exec edge-launcher node cli.js roll again; then bad "the roll exited 0"; else ok "the roll exits non-zero"; fi
status_of "$SLUG" | grep -q '"status":"failed"' && ok "the broken brain is failed" || bad "the broken brain: $(status_of "$SLUG")"
[ "$(docker inspect -f '{{.Image}}' "brain-$TWO-tapestry")" = "$TWO_IMAGE" ] && ok "the next brain is untouched" || bad "the next brain was changed"
status_of "$TWO" | grep -q '"status":"running"' && ok "the next brain is still running" || bad "the next brain: $(status_of "$TWO")"

step "retry on a failed brain that has run keeps its data"
sed -i.bak "s/^NEO4J_PASSWORD=.*/NEO4J_PASSWORD=$GOOD_PW/" "$WORK/brains/$SLUG/.env"
write_launcher_json 7 600
[ "$(api POST /api/brains "{\"slug\":\"$SLUG\"}" | tail -n 1)" = 202 ] && ok "202" || bad "retry"
ELAPSED="$(wait_for "$SLUG" running 600)" && ok "running in ${ELAPSED}s" || die "retry did not come back: $ELAPSED"
cypher "MATCH (m:IntegrationMarker) RETURN m.v" | grep -q 'still here' && ok "marker survived" || bad "marker lost on retry"

step "memory after all of that"
docker stats --no-stream --format '  {{.Name}}: {{.MemUsage}}' | grep -E "brain-$SLUG|edge-"
for c in "brain-$SLUG-tapestry" "brain-$TWO-tapestry"; do
  OOM="$(docker exec "$c" sh -c "grep -E '^oom_kill ' /sys/fs/cgroup/memory.events | cut -d' ' -f2")"
  [ "$OOM" = 0 ] && ok "$c: nothing killed for memory" || bad "$c: $OOM processes killed for memory"
done

step "destroy the second brain for good"
write_launcher_json 0 600
api DELETE "/api/brains/$TWO" >/dev/null
wait_for "$TWO" stopped 120 >/dev/null || die "the second brain did not stop"
sleep 1
docker exec edge-launcher node cli.js reap | grep -q "$TWO" && ok "reaped" || bad "reap did not name it"

step "reap, once the grace period is over"
api DELETE "/api/brains/$SLUG" >/dev/null
wait_for "$SLUG" stopped 120 >/dev/null || die "did not stop"
sleep 1
docker exec edge-launcher node cli.js reap | grep -q "$SLUG" && ok "reaped" || bad "reap did not name it"
[ -z "$(docker volume ls -q --filter "name=brain-${SLUG}_")" ] && ok "volumes gone" || bad "volumes remain"
[ ! -e "$WORK/brains/$SLUG" ] && ok "directory gone" || bad "directory remains"
[ "$(curl_edge "$DOMAIN" "/api/brains/$SLUG/status" -o /dev/null -w '%{http_code}')" = 404 ] && ok "status is 404" || bad "status"

step "the name is free, and a warm create is quick"
write_launcher_json 7 600
[ "$(api POST /api/brains "{\"slug\":\"$SLUG\"}" | tail -n 1)" = 202 ] && ok "202" || die "the name was not free"
ELAPSED="$(wait_for "$SLUG" running 600)" && ok "running in ${ELAPSED}s (target: under 180)" || die "did not reach running: $ELAPSED"

step "start fresh deletes the data and launches it blank"
C="brain-$SLUG-tapestry"
PW="$(field "$(api GET "/api/brains/$SLUG")" neo4jPassword)"
cypher "CREATE (:IntegrationMarker {v: 'second'})" >/dev/null
api DELETE "/api/brains/$SLUG" >/dev/null
wait_for "$SLUG" stopped 120 >/dev/null || die "did not stop"
[ "$(api POST "/api/brains/$SLUG/fresh" | tail -n 1)" = 202 ] && ok "202" || bad "fresh"
ELAPSED="$(wait_for "$SLUG" running 600)" && ok "running in ${ELAPSED}s" || die "did not come back: $ELAPSED"
PW="$(field "$(api GET "/api/brains/$SLUG")" neo4jPassword)"
cypher "MATCH (m:IntegrationMarker) RETURN count(m)" | tail -n 1 | grep -qx 0 && ok "no marker" || bad "the old data is still there"
