# Gate runs from the main checkout fail suites that load `lib/config.js`, because dotenv adds that checkout's local `.env` to `process.env`

**Id:** 2026-11-26-main-checkout-env-fails-gate-runs
**Type:** meta
**Opened:** 2026-11-26 (doc-lane review `security-auth-exposure/bible-14-generic-signer-owner-only`, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** To check that two failures were not the branch's, the reviewer ran the same two suites through the gate engine in the main checkout, clean at `d8b94c10`. Run `20261126T174528Z-60043-1163` failed one extra check in each suite under the engine's hermeticity rule: "left process.env changed after its run (2 keys): added NEO4J_PASSWORD, OWNER_PUBKEY". The keys come from `lib/config.js:23`, `require('dotenv').config()`, which reads the main checkout's local `.env`. A worktree has no `.env`, so the same suites don't fail that way there.

**Why it matters.** Comparing a branch against the main checkout is the usual way to show a failure is not the branch's. In that comparison these failures belong to neither the branch nor `staging`. They belong to the machine. A reviewer who misses that reads them as a difference between the two.

**Fix shape.** Any one of these:
- the engine sets dotenv's path to a file that doesn't exist (`DOTENV_CONFIG_PATH`), or `lib/config.js` skips `.env` under the gate;
- the engine takes its `process.env` snapshot after dotenv has run;
- the Reviewer's workflow says to compare against a clean worktree of `staging`, never the main checkout.

Related: OPEN.md row `2026-11-20-suite-env-changes-reach-every-suite`, which added the hermeticity rule (DONE).

**Pointer:** `engineering-team/reviews/security-auth-exposure/bible-14-generic-signer-owner-only.md`, Quality gates and harness friction 2.
