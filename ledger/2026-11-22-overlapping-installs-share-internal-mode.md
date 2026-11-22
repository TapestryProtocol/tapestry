# Two of today's firmware installs at once break each other, because each switches the whole install module into internal mode

**Id:** 2026-11-22-overlapping-installs-share-internal-mode
**Type:** bug
**Opened:** 2026-11-22 (story deploy-safety-gate #4, Architecture; ADR `deploy-safety-gate/0004`, Consequences)
**Status:** OPEN
**Done:** —

**What was found.** This was read in the code, not seen on any instance. `handleFirmwareInstall` (`src/firmware/install.js`) runs an install with state that belongs to the whole module.
- **It switches the module into internal mode.** It sets `_internalMode` and `_internalHandlers` (`enableInternalMode`), so every `apiPost`, `apiGet` and `runCypherApi` call goes straight to the Express routes in the same process. When its install ends, it switches them back.

Two installs at once in one control panel share that state:
- **The second install's start** replaces the first's bridge. That part is harmless: both point at the same app.
- **The first install to end** switches the module back to HTTP mode. The other install's remaining calls then go to `TAPESTRY_API_BASE`, which no container sets, so `http://localhost:80`. nginx forwards them with `X-Forwarded-For`.
- **The auth layer then refuses them, by the code.** It doesn't treat a forwarded call as the trusted local operator (ADR security-auth-exposure/0001), so the other install's writes are refused. The rest of that install fails call by call, and most of its failures are logged and passed over.

**How likely.** Someone has to start two installs at once: the Dashboard's button twice, a loopback call during the first-boot install, or two sessions. Nothing stops it. Story 4's deploy-safety answer counts both installs correctly either way.

**Fix shape, not chosen:**
- refuse a second install while one runs; story 4's in-memory count, `src/firmware/inFlight.js`, already knows when one does;
- or carry the mode with each install instead of with the module.

Related: OPEN.md row `2026-11-21-todays-install-races-seed-firmware` (today's install and seed-firmware at once).

**Pointer:** ADR `deploy-safety-gate/0004` (Consequences, "Found in passing"); `src/firmware/install.js` (`_internalMode`, `enableInternalMode`, `handleFirmwareInstall`).
