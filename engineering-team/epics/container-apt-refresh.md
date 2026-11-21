# Epic: container-apt-refresh

**Created:** 2026-11-21
**Status:** Done (epic retired 2026-11-21 at the container-apt-refresh book close: story 1 Done, on `staging` via TapestryProtocol/tapestry#188; `main` takes it at its next promotion, and the sandbox branches when they take `staging`)
**Book:** `engineering-team/audits/container-apt-refresh/book.md` (acceptance frame, Standard; Bug lane)
**Provenance:** The 2026-11-20 check of David's droplets for CVE-2026-123007 and CVE-2026-123633. It found the
container's NGINX on tags and magic-carpet below Ubuntu's fix, while every host's NGINX was patched. The session that
found it proposed this work, and David started it on 2026-11-21.

## Goal

Every build of the tapestry image, whether a server deploy or the brains' image for tapestry.ninja, brings its Ubuntu
packages up to date at least once a week. Neo4j, strfry and Node's major version stay where they are, and no deploy is
unexpectedly slow.

## Stories

`stories/done/container-apt-refresh/`:
1. `1-deploys-refresh-ubuntu-packages.md`: the weekly refresh in every build path, the docs, and the operator note for
   tags and magic-carpet. Bug, Standard.
