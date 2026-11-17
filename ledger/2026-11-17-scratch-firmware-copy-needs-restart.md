# Firmware copied into a running scratch stack isn't what its next install installs, until the control panel restarts

**Id:** 2026-11-17-scratch-firmware-copy-needs-restart
**Type:** meta
**Opened:** 2026-11-17 (story graph-operations-first-slice #21, graph update-node, its live check's L3b)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-operations-first-slice/0009's live-check recipe says: install the firmware if its digest differs from the image's. Story 9's and story 21's checks did so by copying the branch's firmware into the running scratch container (`docker cp`), then calling `POST /api/firmware/install`.

The install then ran on the control panel's cached manifest. `src/api/normalize/firmware.js` caches the manifest in `_manifest` on first use, at boot, from the image's firmware. Its report on 2026-11-17:
- it listed 40 concepts;
- the branch's manifest has 41, graph-rule among them;
- the graph rule concept wasn't installed at all.

Element files are read fresh, so most of the branch's firmware did land. A process started afresh, such as `node -e` in the container, read the new manifest. So the instance and its own firmware folder disagreed: 7 of 83 firmware element files had no node at the address install gives them.

After `supervisorctl restart brainstorm` and a second install, the report listed 41 concepts, and all 83 element files had their node.

**Fix shape.** In ADR 0009's recipe, or in `scripts/scratch-stack.sh` as a `firmware <dir>` command:
- copy the branch's firmware in;
- restart the control panel (`supervisorctl restart brainstorm`), so `firmware.js` reads the new manifest;
- then install, and check that the report's concept count matches the manifest's.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/21-update-node.md` (Evidence, the live check's failed checks); `src/api/normalize/firmware.js` (`getManifest`, `clearCache`).
