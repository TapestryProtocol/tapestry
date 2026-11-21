# The tapestry image is built on Ubuntu 22.04, whose standard security support ends in April 2027

**Id:** 2026-11-21-tapestry-image-leaves-ubuntu-2204
**Type:** cleanup
**Opened:** 2026-11-21 (story `container-apt-refresh` #1)
**Status:** OPEN
**Done:** —

**What was seen.**
- The `Dockerfile` starts `FROM ubuntu:22.04`.
- Canonical's standard security maintenance for 22.04 LTS ends in April 2027. After that, only Ubuntu Pro (ESM) carries
  fixes, so the weekly package refresh (ADR `container-apt-refresh/0001`) would have nothing new to apply.
- The droplets' hosts already run 24.04.

**Fix shape.** Move the image to `ubuntu:24.04` before April 2027, as a story of its own. It touches:
- package names;
- the Java that Neo4j 5.26 runs on;
- strfry 1.1.0's build against 24.04's libraries, and both patch scripts;
- NodeSource's setup script and the Neo4j apt repository;
- the refresh step's `-o Dir::Etc::SourceParts=-`.

**The trap in that last one.** On 24.04, Ubuntu's own sources live in `/etc/apt/sources.list.d/ubuntu.sources` (deb822),
not in `/etc/apt/sources.list`. So that option would leave Ubuntu itself out. The refresh would then fetch nothing and
upgrade nothing, without an error. The move must point the refresh at `ubuntu.sources` instead, and have it fail when no
Ubuntu list was fetched.

**Pointer:** ADR `container-apt-refresh/0001`; `Dockerfile` (the weekly refresh step); OPERATIONS.md §3.
