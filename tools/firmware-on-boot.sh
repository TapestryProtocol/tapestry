#!/bin/bash
# Installs firmware on a fresh instance once Neo4j and the control panel answer, so nobody has to press the button.
# Runs only when TAPESTRY_FIRMWARE_ON_BOOT=true (docker/entrypoint.sh). It calls the app directly on loopback, with no
# forwarding header, which is how the app knows the call is the local operator (ADR security-auth-exposure/0001).
# Safe to run on every start: firmware that is already installed means nothing happens.

API="http://127.0.0.1:${CONTROL_PANEL_PORT:-7778}"
WAIT_SECONDS="${FIRMWARE_ON_BOOT_WAIT_SECONDS:-5}"
TRIES="${FIRMWARE_ON_BOOT_TRIES:-120}"

for ((try = 1; try <= TRIES; try++)); do
  STATUS="$(curl -s --max-time 30 "$API/api/firmware/install-status" || true)"
  case "$STATUS" in
    *'"installed":true'*)
      echo "[firmware-on-boot] firmware is installed"
      exit 0
      ;;
    *'"success":true'*)
      echo "[firmware-on-boot] installing firmware (try $try)"
      RESULT="$(curl -s --max-time 900 -X POST -H 'Content-Type: application/json' -d '{}' "$API/api/firmware/install" || true)"
      case "$RESULT" in
        *'"success":true'*) ;;
        *) echo "[firmware-on-boot] the install did not finish, trying again" ;;
      esac
      ;;
  esac
  sleep "$WAIT_SECONDS"
done

echo "[firmware-on-boot] gave up after $TRIES tries"
exit 1
