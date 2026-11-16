#!/usr/bin/env bash
# The "closed by construction" claims, as assertions. Run on the host with at least two brains up:
#
#   deploy/launcher/test/isolation.sh
#
# If one goes red, brains are no longer isolated from each other the way the design says.
set -uo pipefail

FAILED=0
ok() { printf '  ok: %s\n' "$*"; }
bad() { printf '  FAIL: %s\n' "$*"; FAILED=1; }

TAPESTRIES=()
while read -r name; do TAPESTRIES+=("$name"); done < <(docker ps --format '{{.Names}}' | grep -E '^brain-.+-tapestry$' | sort)
if [ "${#TAPESTRIES[@]}" -lt 2 ]; then
  echo "Needs at least two running brains, found ${#TAPESTRIES[@]}."
  exit 2
fi
slug_of() { local n="${1#brain-}"; echo "${n%-tapestry}"; }

echo "== no brain publishes a port"
while read -r name project; do
  case "$project" in
    brain-*)
      if [ -n "$(docker port "$name" 2>/dev/null)" ]; then bad "$name publishes a port"; else ok "$name"; fi
      ;;
  esac
done < <(docker ps -a --format '{{.Names}} {{.Label "com.docker.compose.project"}}')

echo "== from one brain, another brain cannot be reached"
for a in "${TAPESTRIES[@]}"; do
  for b in "${TAPESTRIES[@]}"; do
    [ "$a" = "$b" ] && continue
    sb="$(slug_of "$b")"
    while read -r name; do
      if docker exec "$a" getent hosts "$name" >/dev/null 2>&1; then bad "$a resolves $name"; else ok "$a cannot resolve $name"; fi
      ip="$(docker inspect -f "{{(index .NetworkSettings.Networks \"brain-${sb}_default\").IPAddress}}" "$name")"
      for port in 80 6379 7474 7687; do
        if docker exec "$a" timeout 3 bash -c "</dev/tcp/$ip/$port" >/dev/null 2>&1; then bad "$a reaches $name at $ip:$port"; fi
      done
    done < <(docker ps --filter "label=com.docker.compose.project=brain-$sb" --format '{{.Names}}')
    # Inside a brain, the short service names must mean that brain's own containers.
    own_net="$(docker inspect -f "{{(index .NetworkSettings.Networks \"brain-$(slug_of "$a")_default\").IPAddress}}" "$a" | cut -d. -f1-2)"
    redis_ip="$(docker exec "$a" getent hosts redis | awk '{print $1}')"
    case "$redis_ip" in
      "$own_net".*) ok "$a's redis is its own" ;;
      *) bad "$a's redis is at $redis_ip, outside $own_net" ;;
    esac
  done
done

echo "== each brain's network holds its own containers, plus edge-caddy"
for t in "${TAPESTRIES[@]}"; do
  s="$(slug_of "$t")"
  for member in $(docker network inspect "brain-${s}_default" -f '{{range .Containers}}{{.Name}} {{end}}'); do
    case "$member" in
      "brain-$s-"*|edge-caddy) ;;
      *) bad "brain-${s}_default holds $member" ;;
    esac
  done
  docker network inspect "brain-${s}_default" -f '{{range .Containers}}{{.Name}} {{end}}' | grep -q edge-caddy \
    && ok "brain-${s}_default" || bad "edge-caddy is not on brain-${s}_default"
done
if docker inspect edge-launcher -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | grep -q 'brain-'; then
  bad "edge-launcher is on a brain's network"
else
  ok "edge-launcher is on no brain's network"
fi

echo "== no volume is shared between stacks, and brains mount nothing from the host"
SEEN="$(mktemp)"
while read -r name project; do
  case "$project" in brain-*) ;; *) continue ;; esac
  while read -r type source; do
    [ -z "$type" ] && continue
    if [ "$type" = "volume" ]; then
      printf '%s %s\n' "$source" "$project" >> "$SEEN"
    elif [ "$type" = "bind" ]; then
      bad "$name mounts $source from the host"
    fi
  done < <(docker inspect "$name" -f '{{range .Mounts}}{{.Type}} {{if eq .Type "volume"}}{{.Name}}{{else}}{{.Source}}{{end}}{{println}}{{end}}')
done < <(docker ps -a --format '{{.Names}} {{.Label "com.docker.compose.project"}}')
DUPES="$(sort -u "$SEEN" | awk '{print $1}' | sort | uniq -d)"
[ -z "$DUPES" ] && ok "no volume in two stacks" || bad "shared: $DUPES"
rm -f "$SEEN"

echo "== the Docker socket is in one container, edge-launcher"
HOLDERS="$(docker ps -a --format '{{.Names}}' | while read -r n; do
  docker inspect "$n" -f '{{range .Mounts}}{{.Source}} {{end}}' | grep -q 'docker.sock' && echo "$n"
done)"
[ "$HOLDERS" = "edge-launcher" ] && ok "only edge-launcher" || bad "held by: $(echo "$HOLDERS" | tr '\n' ' ')"

echo "== the host firewall allows 22, 80 and 443 only"
if command -v ufw >/dev/null 2>&1; then
  ALLOWED="$(ufw status | awk '/ALLOW/ {print $1}' | sed 's#/.*##' | sort -un | tr '\n' ' ')"
  [ "$ALLOWED" = "22 80 443 " ] && ok "ufw: $ALLOWED" || bad "ufw allows: $ALLOWED"
else
  echo "  skipped: no ufw here (fine on a dev machine, not on the droplet)"
fi

if [ "$FAILED" -eq 0 ]; then printf '\nisolation: PASS\n'; else printf '\nisolation: FAIL\n'; exit 1; fi
