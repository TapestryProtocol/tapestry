# A deploy never refreshes the stack's other images: nostr-search's Alpine base, Redis and Meilisearch

**Id:** 2026-11-21-stack-images-never-refresh
**Type:** bug
**Opened:** 2026-11-21 (story `container-apt-refresh` #1, out of scope there)
**Status:** OPEN
**Done:** —

**What was seen.** Story `container-apt-refresh` #1 refreshes the `tapestry` image's Ubuntu packages weekly. The
compose stack's other three services drift the way that image did:
- **`nostr-search-api`** is built from `nostr-search/Dockerfile`, which starts `FROM node:22-alpine`. Its cached base
  and its `npm ci` step change only when a cache goes cold. The brains' search image in `publish-image.yml` builds from
  the same Dockerfile, with a saved cache.
- **`redis:7-alpine` and `getmeili/meilisearch:v1.12`** are pulled once. `docker compose up -d --build` never pulls
  them again, so each server keeps the copy it first pulled, whatever Docker Hub has since published under those tags.

**Fix shape.** A story to weigh:
- `docker compose pull redis nostr-search-meili` at the week's refreshing deploy, or on a schedule;
- a weekly key, or `--pull`, for the nostr-search build.

Meilisearch stays pinned at v1.12 on purpose (OPERATIONS.md §8, #63), so only a patch release under that tag may move.

**Pointer:** `docker-compose.yml`; `nostr-search/Dockerfile`; ADR `container-apt-refresh/0001`, Consequences.
