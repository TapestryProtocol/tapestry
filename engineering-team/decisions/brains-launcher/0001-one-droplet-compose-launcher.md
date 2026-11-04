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
- One brain filling the shared disk affects all of them. The disk floor is checked only before a create.
- Dogfood brains ride `main`, so they update when `staging` is promoted.
- **Firmware reinstall required?** No.

## Implementation notes

Everything new is under `deploy/`: `edge/` (Caddy and launcher), `launcher/` (the service, CLI and tests),
`templates/brain.compose.yml`, `host/` (the systemd timer and Docker daemon config) and `RUNBOOK.md`.
`deploy/launcher/backends/compose.js` is the only file that runs Docker.
