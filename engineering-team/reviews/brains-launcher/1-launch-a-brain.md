# Review: Story 1, a team member launches their own brain

**Date:** 2026-11-05
**Inputs:** story `stories/brains-launcher/1-launch-a-brain.md`, ADR `decisions/brains-launcher/0001-one-droplet-compose-launcher.md`, acceptance frame in `audits/brains-launcher/book.md`
**Reviewed by:** two independent reads, one up to `6180d429` and one of everything after it plus every shared file, and the checks below run by the implementer on the live droplet.

**Not final.** One acceptance item is still open, so the story stays In progress: see Open items.

## Quality gates

- `npm test` at `6014fd28`: 6,604 passed, 4 failed, 576 skipped. The 4 are `event-tagging-firmware-seed` (needs a live stack at `:8877`) and `router-stream-limit-on-connect` (macOS `sed`). Both fail the same way on plain `staging` on the same machine.
- `bash scripts/harness-lint.sh`: clean.
- `deploy/launcher/test/integration.sh` at `5a4b8f46`: 56 checks passed, 1 failed. The failure was a check added that day for `www`, which cannot pass under the test's `local_certs`, because Caddy then leaves `www` to the on-demand site. It was removed and moved to the droplet checks, where it passes. The whole script was not run again after that one-line change.

## Acceptance, on the droplet

| Item | Result |
|---|---|
| The owner launches `avi` from the page | Running in 6m52s. The owner accepted 8 to 10 minutes over the spec's three, once the firmware install was timed at 402 to 487 seconds. |
| The owner signs in and is the owner | Confirmed by the owner. Router presets are off. The lists hold firmware's own headers and items, with nothing from outside: 438 events and 0 scores after a real sign-in, and the access log shows the search-index check ran and no sync started. |
| Two more people launch theirs, and they are owners | Done, confirmed by the owner. |
| One roll takes all three forward | Done, one at a time, about a minute each. Node, edge and event counts identical before and after, including one brain with events added by hand. |
| Destroy and restore keep data | Done on a throwaway brain, restored in 69 seconds with a marker intact. |
| Memory with three brains idle | 5.2 of 7.8 GiB used, with no kills. |
| `isolation.sh` | Green with two brains and again with three. |
| `security.sh` | Green. |
| A roll with one brain broken on purpose | Stopped there, marked it `failed`, and restarted nothing else. |
| Reboot | Launcher page back in 32 seconds, a brain ready in 100, with the data intact. |
| The owner adds an agent as admin | **Open.** |

## What the checks found, fixed in this branch

- A first launch failed at the original 5-minute limit. The limit is now 15 minutes, and the page says how long to expect.
- Signing in on the home page or the settings page downloaded a person's whole score set (160,359 events on one instance). Both now check for a search index first.
- The launcher stayed down after a reboot, which left brains on TLS errors. `docker kill -s HUP` marks a container as manually stopped, so `unless-stopped` did not restart it. It now uses `restart: always`, and reloads send the signal from inside the container. Proved by a second reboot with the flag set on purpose.
- `www` had no certificate, because Caddy leaves names under a wildcard site to that site. It now uses `tls force_automate`.
- Each roll left the old image on disk. The workflow now prunes.
- The owner's npub read "unassigned" on every container, because `nostr-tools` does not resolve from `/`.
- The spec's 768/512 MB got Neo4j killed under the 2 GiB limit. It is 512/256/256, measured on the droplet.

## Other instances

The second read went through every shared file with their variables unset and found no defect. What changes there: a fresh volume's router now starts idle rather than on old streams until the app replaces them, `/api/ready` is new and public and runs the same queries as the public `install-status`, and `/api/owner-info` reports the real npub.

## Accepted, not changed

- Anyone with write access to the repo can read the droplet's root key from a branch workflow, and `appleboy/ssh-action@v1` is a third-party tag that can move. Sibling deploy workflows have the same exposure.
- Re-running an old workflow run moves every brain back to old code. The runbook warns about it.
- A brain's contents are public to anyone with its URL, as the ADR says.

## Open items

- The owner adds an agent's npub on `/pages/manage/manage-administrators.html`, and the agent signs in as admin. The page answers on a live brain. Adding one is not tried.
- Neo4j Browser at `/browser/` connects through Caddy, which sends a websocket at a brain's root to its port 7687. This needed no change to the config other instances share. A raw Bolt handshake through HTTPS got an answer from Neo4j on all three brains. A real login in Neo4j Browser is not tried yet.
