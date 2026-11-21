# Docker cache checks on the owner's Mac use the legacy builder, so they can't show how the droplets' BuildKit caches

**Id:** 2026-11-21-local-docker-builds-skip-buildkit
**Type:** meta
**Opened:** 2026-11-21 (story `container-apt-refresh` #1, review round 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The Mac.** Its Docker (29.2.1) has no buildx plugin, so `docker build` and `docker compose build` there use the
  deprecated legacy builder. Its output reads `Step n/34` and `Using cache`.
- **The droplets.** Every deploy builds with BuildKit. Staging's log of run 44877650711 reads `#11 CACHED`.
- **How the two caches differ.**
  - The legacy builder's cache is the chain of intermediate images. So `docker image prune -f` removes an old image's
    steps along with the image.
  - BuildKit keeps each step as a build-cache record, which `docker image prune` leaves alone. A later build whose key
    matches an earlier one, such as the same week passed again, reuses it.
- **Why it mattered.** Story `container-apt-refresh` #1's R2 cache check ran on the Mac and passed. It couldn't show
  that a by-hand refresh with a one-off key is undone by the next plain-week deploy on the droplets. The review found
  that from staging's log and Docker's docs (review round 1, blocking 1).

**Fix shape.** Any of these, to decide:
- Install buildx on the Mac, with the owner's yes, so local cache checks use BuildKit.
- Run cache-behaviour checks on a GitHub runner, which has buildx.
- Have the test plan template say that a local Docker cache check must name the builder it ran on.

**Pointer:** `engineering-team/reviews/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md`, blocking 1 and
harness friction 1.
