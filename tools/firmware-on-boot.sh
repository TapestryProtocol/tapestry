#!/bin/bash
# Installs firmware on a fresh instance once Neo4j and the control panel answer, so nobody has to press the button.
# Runs only when TAPESTRY_FIRMWARE_ON_BOOT=true (docker/entrypoint.sh). It calls the app directly on loopback, with no
# forwarding header, which is how the app knows the call is the local operator (ADR security-auth-exposure/0001).
#
# The marker records the firmware version this script finished installing. List headers alone do not show that: they are
# written first, so they are there even if an install stopped partway. GET /api/ready reads the marker too. Safe to run on
# every start: the current version, already finished, means nothing happens.

API="http://127.0.0.1:${CONTROL_PANEL_PORT:-7778}"
MARKER="${FIRMWARE_ON_BOOT_MARKER:-/var/lib/brainstorm/firmware-on-boot.installed}"
WAIT_SECONDS="${FIRMWARE_ON_BOOT_WAIT_SECONDS:-5}"
TRIES="${FIRMWARE_ON_BOOT_TRIES:-120}"

for ((try = 1; try <= TRIES; try++)); do
  STATUS="$(curl -s --max-time 30 "$API/api/firmware/install-status" || true)"
  case "$STATUS" in
    *'"success":true'*)
      VERSION="$(printf '%s' "$STATUS" | sed -n 's/.*"activeVersion":"\([^"]*\)".*/\1/p')"
      case "$STATUS" in
        *'"installed":true'*)
          if [ -s "$MARKER" ] && [ "$(cat "$MARKER")" = "$VERSION" ]; then
            echo "[firmware-on-boot] firmware $VERSION is installed"
            exit 0
          fi
          ;;
      esac
      echo "[firmware-on-boot] installing firmware $VERSION (try $try)"
      RESULT="$(curl -s --max-time 900 -X POST -H 'Content-Type: application/json' -d '{}' "$API/api/firmware/install" || true)"
      case "$RESULT" in
        *'"success":true'*) printf '%s' "$VERSION" > "$MARKER" ;;
        *) echo "[firmware-on-boot] the install did not finish, trying again" ;;
      esac
      ;;
  esac
  sleep "$WAIT_SECONDS"
done

echo "[firmware-on-boot] gave up after $TRIES tries"
exit 1
