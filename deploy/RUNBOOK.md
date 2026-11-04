# Brains: the runbook

How to run the launcher at `tapestry.ninja`, and how to run one brain yourself without it. A brain is a Tapestry instance
owned by one nostr key. One droplet holds several, one compose stack each.

**What is in a brain can be read by anyone with its URL.** `POST /api/neo4j/query` takes any plain read with no sign-in,
and the relay at `/relay` is open to read and to write. Put nothing private in one yet. Brains are isolated from each other, not from
the internet, and not from whoever has root on the droplet.

## What was checked in the tree

These are the answers to the questions the design left open, read from the code on 2026-11-04.

| Question | Answer | What was done |
|---|---|---|
| Is there a readiness check under `/api/`? | No. `GET /api/firmware/install-status` is close, but always answers 200, and it counts list headers, which are written first, so it says installed partway through an install. | Added `GET /api/ready`: 200 when Neo4j answers and firmware is in place, 503 otherwise. |
| Does firmware install on its own? | No. It is a manual step. | Added `tools/firmware-on-boot.sh`, run only when `TAPESTRY_FIRMWARE_ON_BOOT=true`. It records the version it finished in `firmware-on-boot.installed` on the data volume, and `/api/ready` reads that. |
| Are relay URLs built from `DOMAIN_NAME`? | The server never reads the request's scheme. `RELAY_URL` stays at its default, as on every droplet, and the code derives `wss://<domain>/relay` for what it advertises. | None for relays. `BRAINSTORM_NEO4J_BROWSER_URL` pointed at a port brains do not publish, so `NEO4J_BROWSER_URL` can now set it. |
| Does Express need `trust proxy`? | No, and it must stay off. A request counts as local only when its peer is loopback and it has no forwarding header (ADR `security-auth-exposure/0001`). Cookies are `secure` only under `USE_HTTPS`. | Caddy adds HSTS instead. |
| Does nginx pass `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`? | The first two. Nothing reads the third. | None. |
| Does anything assume `brainstorm.world`? | Only as a default relay for lists and trust data (`wss://dcosl.brainstorm.world` and friends), and in the estate list in `src/utils/siteTrust.js`. | None. The UI's "is this concept shared?" read still asks `dcosl`. |
| Does the entrypoint size memory from the host? | Yes, from `/proc/meminfo`, unless `BRAINSTORM_NEO4J_*` is set. | The template sets all three. The entrypoint now also honours a container memory limit. |
| Do new brains start blank? | Router presets are all off, but first boot ran an old config with live streams until the app replaced it. | First boot now starts the router idle. |
| Does signing in bring anything in? | It did. The home page is the search page, and it downloaded a person's whole set of scores (kind 30382, 160,359 events on one instance) when the brain had none. The settings page did too. Those scores fill the search index, which brains do not run. | Both pages now check for a search index first. The button on the settings page still fetches them on request. |
| Do new brains publish outside? | By default the UI publishes to public relays too. | The template sets `BRAINSTORM_PUBLISH_LOCAL_ONLY=true`. |
| Do added admins survive a roll? | Yes. They are in `settings.json` on the data volume, and `ADMIN_PUBKEYS` is only the fallback. | None. |

## Run one brain yourself

The launcher does nothing you cannot do by hand. On any box with Docker, in an empty folder:

1. Copy `deploy/templates/brain.compose.yml` to `docker-compose.yml`.
2. Write `.env` beside it:
   ```
   SLUG=mine
   IMAGE_TAG=dogfood
   TAPESTRY_IMAGE=ghcr.io/nousclawds4/tapestry
   SEARCH_IMAGE=ghcr.io/nousclawds4/tapestry-nostr-search
   OWNER_PUBKEY=<your hex pubkey>
   ADMIN_PUBKEYS=<your hex pubkey>
   NEO4J_PASSWORD=<32 random hex characters>
   DOMAIN_NAME=<your domain>
   NEO4J_BROWSER_URL=https://<your domain>/browser/
   BRAINSTORM_NEO4J_HEAP_MB=512
   BRAINSTORM_NEO4J_CACHE_MB=256
   BRAINSTORM_NEO4J_TX_MAX_MB=256
   TAPESTRY_FIRMWARE_ON_BOOT=true
   BRAINSTORM_PUBLISH_LOCAL_ONLY=true
   ```
3. `docker compose up -d`
4. Point a TLS proxy at the container's port 80. The template publishes no ports, so add one, or join the proxy to the
   stack's network.
5. Wait for `docker exec brain-mine-tapestry curl -sf http://localhost/api/ready` to succeed, then sign in with your key.

## Set up the box

Four handovers, in order. Each person can follow theirs with no other context.

### Handover 1: DigitalOcean (whoever has the NosFabrica account)

1. Create a droplet: Basic, Regular, 8 GB / 4 vCPU / 160 GB SSD, Ubuntu 24.04 LTS, region NYC, your SSH key, hostname
   `tapestry-ninja`. Note its public IPv4. It goes to the domain owner and into the GitHub secrets.
2. Harden it before anything else. Bots find port 22 within minutes.
   ```bash
   cat > /etc/ssh/sshd_config.d/99-disable-password.conf <<'CONF'
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   CONF
   sshd -t && systemctl reload ssh

   apt update && apt full-upgrade -y
   apt install -y fail2ban ufw git
   cat > /etc/fail2ban/jail.d/sshd.local <<'CONF'
   [sshd]
   enabled = true
   port = 22
   maxretry = 5
   findtime = 10m
   bantime = 1h
   CONF
   systemctl enable --now fail2ban

   ufw default deny incoming
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw --force enable
   ```
   Reboot if the upgrade installed a new kernel.
3. In the DigitalOcean console, put the droplet behind a Cloud Firewall that allows inbound TCP 22, 80 and 443 and nothing
   else. Add it to `tapestry-web` if the account has one, or create that under Networking, Firewalls. UFW does not stop
   ports Docker publishes (`OPEN.md` row 66), and this is the layer that does.
4. Install Docker from Docker's own repository, never Ubuntu's `docker.io`.
   ```bash
   install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   chmod a+r /etc/apt/keyrings/docker.asc
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
   apt update
   apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```
   No nginx or certbot on this box. Caddy does TLS.
5. Clone the repo, and turn on log rotation so brains' logs cannot fill the disk.
   ```bash
   git clone https://github.com/nousclawds4/tapestry.git /opt/tapestry
   cd /opt/tapestry && git checkout feat/brains-launcher   # or main, once it is merged
   cp deploy/host/daemon.json /etc/docker/daemon.json
   systemctl restart docker
   ```
6. Write the launcher's config.
   ```bash
   mkdir -p /opt/brains /opt/launcher/config
   cat > /opt/launcher/config/allowlist.json <<'JSON'
   [
     { "pubkey": "<hex pubkey>", "label": "Avi" },
     { "pubkey": "<hex pubkey>", "label": "David" },
     { "pubkey": "<hex pubkey>", "label": "Vinney" }
   ]
   JSON
   cat > /opt/launcher/config/launcher.json <<'JSON'
   { "maxBrainsPerOwner": 3, "maxBrainsTotal": 3, "minFreeDiskGb": 10 }
   JSON
   chmod 600 /opt/launcher/config/*.json
   ```
7. Add the deploy key and the GitHub secrets. Adding secrets needs admin on `nousclawds4/tapestry`, so someone with admin
   does this on their own machine, and the private key never leaves it.
   ```bash
   ssh-keygen -t ed25519 -f ./tapestry_ninja -N ""
   ```
   In the repo's Settings, Secrets and variables, Actions, add `DEPLOY_HOST_NINJA` (the IP), `DEPLOY_USER_NINJA` (`root`)
   and `DEPLOY_SSH_KEY_NINJA` (the whole of `./tapestry_ninja`). Delete `./tapestry_ninja`, and pass on what is in
   `./tapestry_ninja.pub`, which is safe to send. Then, on the droplet:
   ```bash
   echo '<the public key>' >> ~/.ssh/authorized_keys
   ```
8. Optional: turn on weekly droplet snapshots in the console (the droplet's Backups tab, about $10 a month at 8 GB).
   Nothing else backs brains up.

### Handover 2: DNS (whoever owns `tapestry.ninja`)

1. In GoDaddy's DNS for `tapestry.ninja`, add two A records, both with TTL 600: name `@` and name `*`, value the droplet's
   IP.
2. Remove any other A, AAAA or CNAME records on the domain. There may be an old relay pointed at it. Leave MX and TXT alone.
3. Check that these both print the IP. They must, before the first brain, because Caddy's certificates depend on it.
   ```bash
   dig +short tapestry.ninja
   dig +short anything.tapestry.ninja
   ```

### Handover 3: start it

```bash
cd /opt/tapestry
docker compose -f deploy/edge/docker-compose.yml up -d --build
cp deploy/host/launcher-reap.service deploy/host/launcher-reap.timer /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now launcher-reap.timer
```

Check that `https://tapestry.ninja` loads with a valid certificate. Then run the publish workflow so the images land on
GHCR, and check that `docker pull ghcr.io/nousclawds4/tapestry:dogfood` works from the droplet.

The first run's last step fails at the pull if the packages are still private, and running the job again after the
change below is all it needs.

New packages on GHCR start private, and changing that is for the owner of the `nousclawds4` account: on each of
`tapestry` and `tapestry-nostr-search`, Package settings, Change visibility, Public. If they must stay private, log the
launcher in with a read-only token after each time it is rebuilt:
`docker exec -i edge-launcher docker login ghcr.io -u <user> --password-stdin < /opt/launcher/config/ghcr.token`.

### Handover 4: the first brain

Sign in at `tapestry.ninja` with a NIP-07 extension, launch `avi`, wait for `running`, open `avi.tapestry.ninja`, sign in,
and confirm you are the owner. Stay on its home page for a minute, then check that signing in brought nothing in. This
should print 0:

```bash
docker exec brain-avi-tapestry strfry scan --count '{"kinds":[30382]}' 2>/dev/null
```

Then run the checks under Tests.

## Day to day

| To | Do |
|---|---|
| See what is there | The page, or `docker exec edge-launcher node cli.js list` |
| Add or remove a person | Edit `/opt/launcher/config/allowlist.json`, then `docker kill -s HUP edge-launcher` |
| Update every brain | Push to `main`, which runs the publish workflow, or run the workflow by hand. By hand on the box: `docker exec edge-launcher node cli.js roll dogfood`. Each brain is down for a minute or two in its turn. |
| Find out why a brain failed | The page's "Details and log", or `/opt/brains/<slug>/create.log`, `docker compose -p brain-<slug> ps`, `docker logs brain-<slug>-tapestry`, `docker logs edge-launcher` |
| Delete a brain's data now | Destroy it, then "Start fresh" on the page, which also launches it again. The reaper deletes the rest daily at 04:00 UTC, 7 days after destroy. |
| Grow the box | Resize in the DigitalOcean console (a few minutes down for everyone), raise `maxBrainsTotal` in `launcher.json`, then `docker kill -s HUP edge-launcher` |
| Reach Neo4j | `<slug>.tapestry.ninja/browser/` with the password on the page, or `docker exec -it brain-<slug>-tapestry cypher-shell -u neo4j -p <password>` |

After a reboot nothing needs doing: brains restart on their own, and the launcher checks them as it starts.

## What can go wrong

- **One brain can fill the disk for all of them.** The floor is only checked before a create. The sync buttons in a brain's
  settings can pull a great deal in (the `userProfiles` preset is millions of profiles), so leave them off for now. A
  brain's relay also takes events from anyone, with no write policy, as every Tapestry relay does today, so a stranger
  could do the same.
- **Destroy loses what a brain's owner did not keep.** The volumes stay for 7 days. After that they are gone, and Neo4j
  holds things that are not nostr events, so relays cannot rebuild it. A brain's Goals page can export its own content.
- **There are no backups** unless the droplet's snapshots are on. There is no monitoring: the page is the dashboard.

## Tests

| What | Where | Run |
|---|---|---|
| Launcher units | `deploy/launcher/test/*.test.js` | `npm test`, as part of the repo's gate, or `node --test "deploy/launcher/test/*.test.js"` |
| Against real Docker, on a dev machine | `deploy/launcher/test/integration.sh` | `docker build -t tapestry-brains:local .` first |
| Isolation, on the droplet with two brains up | `deploy/launcher/test/isolation.sh` | as root |
| What the launcher refuses, on the droplet | `deploy/launcher/test/security.sh tapestry.ninja` | as root |

Also on the droplet: roll with three brains; roll with one broken on purpose (a wrong `NEO4J_PASSWORD` in its `.env`), which
should stop there, mark it `failed` and leave the rest alone; and reboot, after which every brain should answer within five
minutes.

## Memory

Each Tapestry container has a 2 GB limit and Redis has 128 MB. Inside that limit, Neo4j's own overhead (threads, metaspace, the GDS and APOC plugins) comes on top of its heap and page cache, and the other processes need about 550 MB.

| Where | Heap / cache | Load | Container | Result |
|---|---|---|---|---|
| Dev machine, arm64, 2026-11-04 | 768 / 512 MB | Firmware install | about 1.9 GiB, at the limit | Neo4j killed for memory |
| Dev machine, arm64, 2026-11-04 | 512 / 256 MB | Firmware, 2,400 events of 2 KB, repeated reads | 1.63 GiB, stable | Nothing killed |
| Droplet, 4 vCPU | to measure | | | |

Three brains at 1.65 GiB, plus Redis, Caddy and the launcher, come to about 5.5 GB, which leaves room on an 8 GB box, so `maxBrainsTotal` starts at 3. Measure again on the droplet with `docker stats`, with fewer CPUs than the dev machine had, and write the result in the table. A killed process shows up in `oom_kill` in `/sys/fs/cgroup/memory.events` inside the container.
