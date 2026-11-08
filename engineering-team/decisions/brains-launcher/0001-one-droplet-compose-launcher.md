# ADR 0001: One droplet, one compose stack per brain, and a launcher behind a small backend interface

**Status:** Accepted
**Date:** 2026-11-04
**Story:** `engineering-team/stories/brains-launcher/1-launch-a-brain.md`

## Context

Setting up an instance by hand takes the steps in `OPERATIONS.md` section 6. The team wants each member to have their
own instance this month. A brain is a boundary of ownership defined by a keypair, so the design binds ownership to a
signature and treats the hostname as a petname.

Facts from the tree that shape this:

- `docker/entrypoint.sh` already takes `BRAINSTORM_NEO4J_HEAP_MB`, `_CACHE_MB` and `_TX_MAX_MB`. It sizes from
  `/proc/meminfo` otherwise, which in a container reports the host.
- `trust proxy` stays off on purpose. A request counts as local only when its socket peer is loopback and it has no
  forwarding header (ADR `security-auth-exposure/0001`). Cookies are `secure` only under `USE_HTTPS`, and nothing reads
  `X-Forwarded-Proto`.
- Firmware install is a manual step (`POST /api/firmware/install`, owner only or direct local).
- `setup/router-presets.json` has every preset off, but first boot copies an old router config with live streams to
  `/etc/` before the app replaces it, and strfry-router starts first.
- `POST /api/neo4j/query` accepts any plain read with no sign-in, by design. A brain's graph is readable by anyone with
  its URL.

## Options considered

### Option A: Compose on one host, launcher on the same box

One droplet, a compose project per brain, Caddy with on-demand TLS, and a launcher holding the Docker socket. No cloud
API token. Cost per brain is low. Brains are isolated from each other, not from whoever holds root on the host.

### Option B: A droplet per brain

Stronger separation, higher cost, 3 to 5 minutes per create, a DigitalOcean token in the launcher, and a DNS API.

### Option C: Kubernetes

Right for strangers at scale. Far more than three people need now.

## Decision

We chose **Option A**. The launcher knows containers only through one backend file, so Option B or C later is a second
file implementing the same interface.

Decisions inside it that the spec left open or the tree changed:

1. **Memory.** The template sets the existing `BRAINSTORM_NEO4J_*` variables, all three. The entrypoint also honours a
   container memory limit when no override is set.
2. **Trust proxy stays off.** Caddy adds HSTS instead.
3. **Firmware on boot is opt-in** through `TAPESTRY_FIRMWARE_ON_BOOT=true`, set by the template, so existing droplets
   change nothing.
4. **Idle first boot.** First boot writes an empty router config. The app writes the real one from saved state or the
   presets once it starts.
5. **One queue.** Roll, reap and reconcile from the CLI go through the running launcher over a unix socket, so the queue
   and the registry have one writer.
6. **Polling.** The page reads a brain's status with an unsigned request that returns status words only, so a create
   does not ask the signer for a signature every few seconds. Everything else is signed.
7. **A brain that ever ran keeps its grace.** A record carries `everRunning`. Retry and destroy delete volumes at once
   only for a brain that never reached `running`.
8. **Start fresh.** From `stopped`, the owner can delete the kept volumes early and create again under the same slug.

## Consequences

- A self-hoster can run one brain with the template alone. The launcher does nothing they could not do by hand.
- Root on the droplet and the launcher can read every brain.
- A brain's contents are public to anyone with its URL. Making them private is separate work.
- A brain's Neo4j login can be reached through port 443, so that Neo4j Browser can connect, and is protected by the
  brain's own random password. Caddy does this, so other instances are not affected.
- One brain filling the shared disk affects all of them. The disk floor is checked only before a create.
- Dogfood brains ride `main`, so they update when `staging` is promoted. Changed by amendments 1 and 2: they follow `staging`, rolled only by changes they run.
- A first launch takes 8 to 10 minutes on the 8 GB droplet, because the firmware install is real work on a cold Neo4j:
  438 events and over 3,000 nodes, with no waits to remove, and three times the heap made no difference. Each brain signs
  with its own key, so a shared pre-built starting point is separate work. The owner accepted this on 2026-11-04.
- **Firmware reinstall required?** No.

## Implementation notes

Everything new is under `deploy/`: `edge/` (Caddy and launcher), `launcher/` (the service, CLI and tests),
`templates/brain.compose.yml`, `host/` (the systemd timer and Docker daemon config) and `RUNBOOK.md`.
`deploy/launcher/backends/compose.js` is the only file that runs Docker.

## Amendment 1: the brains follow `staging` (2026-11-08)

**Changes:** the consequence "Dogfood brains ride `main`".

The brains are where the team tries what it is building. Vinney's reading views went to them before `main` (PR #27), and
`main` moves only when `staging` is promoted. Riding `main` also meant a promotion would move the brains back onto an
older build than the one they had been tried on.

- A push to `staging` builds the images and rolls every brain, unless the push touches only `engineering-team/`,
  `product-team/` or `ledger/`, which no brain serves.
- A push to `main` no longer rolls them. The workflow can still be run by hand on `main`, and that holds until the next
  push to `staging`.
- A roll still goes one brain at a time and stops at the first brain that does not come back, leaving the rest on their
  old image. It does not wait for `staging`'s tests to pass: the roll's own check is what stops a broken build.
- Other deployments' workflows are unchanged.

**Origin:** Vinney asked about updating the brains from `staging` on every push, 2026-11-08; Avi chose it.

## Amendment 2: only what a brain runs rolls the brains (2026-11-08)

**Changes:** amendment 1's first point, which rolled the brains on every push to `staging` except one touching only
`engineering-team/`, `product-team/` or `ledger/`.

That still rolled them for pushes that change nothing a brain runs: docs, tests, harness tooling, other workflows.
Since 2026-11-01, 23 of 29 pushes to `staging` would have rolled them under amendment 1, and 15 under this one.

- A push to `staging` rolls the brains only when it changes a path in `publish-image.yml`'s `paths` list: the code and
  UI (`src/`, `ui/`, `public/`, `lib/`, `bin/`, `config/`, `customers/`, `setup/`, `firmware/`, `plugins/`, `tools/`), the
  images' own files (`Dockerfile`, `.dockerignore`, `docker/`, `patches/`, `package.json`, `package-lock.json`,
  `index.js`, `nip50-proxy/`, `nostr-search/`), `deploy/` and the workflow itself. Markdown and `*.test.*` files inside
  them don't count, except `docs/information-for-agents.md`, which a brain serves.
- Test W1c lists every other top-level path as one the brains don't run. A new top-level path fails it until it is put
  in one list or the other, so a folder the image starts using can't be missed.
- A roll still restarts only a brain whose image changed, since `compose up` leaves an unchanged container alone. So a
  push that touches only `deploy/` updates the launcher and Caddy without restarting a brain.
- GitHub reads only a push's first 300 changed files for this filter. After a bigger push, run the workflow by hand.

**Origin:** Avi asked for the brains to roll only on changes that bear on them, 2026-11-08.
