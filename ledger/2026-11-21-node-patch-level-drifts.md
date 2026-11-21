# The image's Node.js 22.x patch level still moves only when a build cache goes cold

**Id:** 2026-11-21-node-patch-level-drifts
**Type:** cleanup
**Opened:** 2026-11-21 (story `container-apt-refresh` #1, out of scope there)
**Status:** OPEN
**Done:** —

**What was seen.**
- The weekly package refresh reads Ubuntu's own sources only, by design (ADR `container-apt-refresh/0001`).
- So NodeSource's `nodejs` keeps the 22.x release that was current when the image's NodeSource step last ran.
- Node.js ships its security fixes as 22.x patch releases.
- CI's `stack-free` job sets up the newest Node 22 on every run, so production can run an older 22.x than CI tests.

**Fix shape.** Decide between:
- letting the weekly refresh also take NodeSource's 22.x updates, which brings one more source, and its outages, into
  the refresh;
- pinning an exact 22.x in the Dockerfile and bumping it on purpose.

**Pointer:** `Dockerfile` (the NodeSource step and the weekly refresh step); ADR `container-apt-refresh/0001`,
Consequences.
