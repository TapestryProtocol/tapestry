# Epic: Brains launcher

**Status:** Active
**Book:** `engineering-team/audits/brains-launcher/book.md`

One droplet, one compose stack per brain, and a small launcher that creates them. Everything new lives in `deploy/`.
The repo gains only what a self-hoster could also use: entrypoint memory sizing, a readiness check, firmware on first
boot, and an idle first-boot router config.

## Stories

1. `engineering-team/stories/brains-launcher/1-launch-a-brain.md`
