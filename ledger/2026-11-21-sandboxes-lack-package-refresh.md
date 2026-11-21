# feat/tags and feature-magic-carpet don't refresh their containers' packages until they take container-apt-refresh

**Id:** 2026-11-21-sandboxes-lack-package-refresh
**Type:** bug
**Opened:** 2026-11-21 (story `container-apt-refresh` #1, out of scope there)
**Status:** OPEN
**Done:** —

**What was seen.**
- Each sandbox deploys from its own branch's copy of the Dockerfile, the compose file and its workflow. So the weekly
  package refresh (ADR `container-apt-refresh/0001`) reaches tags and magic-carpet only when their branches merge
  `staging`, or take a port.
- On 2026-11-20 both containers' NGINX was `1.18.0-6ubuntu14.22`, below Ubuntu's fix for CVE-2026-123007 and
  CVE-2026-123633, which is `14.23`. That NGINX is reachable only from the host, so the exposure is low, but the rest
  of the image drifts the same way.

**For now.** The story's PR to `staging` carries a refresh by hand for both containers: OPERATIONS.md §3.1, recipe 3.
It runs only on David's yes, and it lasts until each container is next recreated.

**Fix shape.** Port the change to each branch with its owner's approval, or merge `staging` into them. No CI runs on
pull requests into either branch, so a port's tests run locally. The ADR's "Sandbox ports" note says what each needs:
- `feat/tags` takes the hunks as they are, plus the workflow's `export`.
- `feature-magic-carpet` needs its compose `args` block ported by hand, and its workflow gains `set -euo pipefail`.

Ledger row `2026-10-10-sandboxes-got-security-fixes` is the precedent: a security fix that reaches `main` doesn't
reach the sandboxes by itself.

**Pointer:** ADR `container-apt-refresh/0001`, "Sandbox ports"; OPERATIONS.md §3.1.
