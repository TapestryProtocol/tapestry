# Today's firmware install and lifecycle seed-firmware, run at the same time, can leave two nodes at one address

**Id:** 2026-11-21-todays-install-races-seed-firmware
**Type:** bug
**Opened:** 2026-11-21 (story graph-operations-first-slice #37, `lifecycle seed-firmware`, review round 1, finding N5)
**Status:** OPEN
**Done:** —

**What was seen.**
- **Neither lock covers today's install.** `lifecycle seed-firmware` holds the lifecycle lock and the concept lock. Today's install (`POST /api/firmware/install`, the Dashboard's button, the install at first start) takes neither, and leaves no flag that it is running.
- **The two can make the same node twice.** Seed-firmware makes a node with no letter by `CREATE` (`src/operations/catalog/graph/_eventless.js`). Today's routes import their letters with a `MERGE` on `NostrEvent`. Run at the same time, these can leave two nodes at one address. No uniqueness rule covers a node with no letter.
- **Unlikely, but not impossible.** Someone would have to start both at once, by hand or with the boot install still running.

**2026-11-21: both installs are on staging and production.** Seed-firmware reached staging with TapestryProtocol/tapestry#182 (06:26 UTC) and production with the promotion #184 (07:23 UTC). david.tapestry.ninja serves it too, after the image publish. Nothing calls it on its own, so the race still needs someone to call it while today's install runs.

**Fix shape.**
- **Today:** BIBLE §7 says not to run them together (ADR graph-operations-first-slice/0037, Amendment 3 item 7).
- **For good:** the race ends when seed-firmware becomes the install and today's install retires (ADR 0043, Decision 1). The other choice, which the owner passed over, is that today's install takes the lifecycle lock, which changes its first-boot path.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/37-seed-firmware.md` (N5); `src/firmware/install.js` (`handleFirmwareInstall`); `src/operations/catalog/lifecycle/seed-firmware.js`.
