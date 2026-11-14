# After the move to nousclawds4/tapestry: the new repo has no branch protection, the old one can still deploy, and public pointers name the old repo

**Id:** 2026-10-28-repo-move-follow-ups
**Type:** ops
**Opened:** 2026-10-28 (the review of `chore/skills-repo-nousclawds4`, the deploy skills' repo fix)
**Status:** OPEN
**Done:** —

**What was seen.** Since the move of 2026-10-23, the droplets are meant to follow `github.com/nousclawds4/tapestry`. The
old `github.com/nous-clawds4/tapestry` is kept as a mirror, and the owner wants the two in sync. The skills fix repointed
every `gh` command. These items remain:

1. **The new repo has no rulesets** (read 2026-10-28; the old repo has both).
   - Nothing on `main` or `staging` restricts deletions, requires a PR, or requires the `stack-free` and
     `main-source-guard` checks.
   - So `/cycle-prod`'s stop on a `BLOCKED` merge state (`.claude/skills/cycle-prod/SKILL.md`, error handling) never
     fires, and nor does the wait-for-`CLEAN` habit (OPEN.md row 209). A merge seconds after a promotion PR opens would
     go through.
   - OPERATIONS §4, §9.2 and §15 still describe the old repo's protections.
   - **Owner action:** recreate the rulesets on the new repo, then re-check OPEN.md row 14.
2. **The old repo can still deploy.** All its workflows are active, and it still holds the droplets' deploy secrets
   (names read; not whether the keys still log in). It also holds other secrets that no longer belong on a mirror.
   - Until that changes, its deploy branches must not be pushed there (`/cycle-staging`, OPERATIONS §9.1).
   - Its `main` and `staging` stay behind as a result: 8 and 9 commits on 2026-10-28.
   - **Owner action:** disable the old repo's Actions, or at least its deploy workflows, and remove its secrets. Then
     mirror its deploy branches.
3. **Public pointers still name the old repo.** They are content, not targeting, so the skills fix left them:
   - `README.md` and `docs/QUICKSTART.md` clone URLs;
   - `SECURITY.md`'s advisory link and repository heading;
   - `docs/information-for-agents.md`;
   - `src/api/openapi.yaml`'s info URL;
   - `src/utils/siteTrust.js`, whose served text `test/llms-txt.test.js:60-69` pins, so the two change together;
   - `ui/src/pages/developers/Hub.jsx:54` and `OpenRanking.jsx:162`;
   - `docs/INTEGRATION_GUIDE_event-tagging-for-external-clients.md:35,74,82`.

   The CLIs stay under `nous-clawds4` (BIBLE §3).

**Seen again on 2026-10-29** (tagging-edges story 6's promotion, PR nousclawds4/tapestry#11):
- **Item 1 in practice.** While the PR's Test ran, its merge state read `UNSTABLE`, not `BLOCKED`. Nothing stopped
  an early merge. It waited for `CLEAN` only because the session did (OPEN.md row
  `2026-10-29-cycle-prod-skips-trial-merge`).
- **The droplets' origin, now shown for two of four.**
  - The first production deploy run on the new repo (run `40973212957`) logged
    "From https://github.com/nousclawds4/tapestry" and "Updating b764663d..62b1ad7a".
  - Staging's first (run `40434357530`, 2026-10-27) logged the same repo.
  - Tags and magic-carpet have not deployed from it yet, so theirs is still unverified.

**Seen again on 2026-11-11** (the repo moved to `TapestryProtocol/tapestry`; GitHub redirects `nousclawds4/tapestry`):
- **Moved with it:** all four deploy branches, and the 15 `DEPLOY_*` secrets the workflows name (names read; not
  whether the keys still log in, which the first run of each deploy shows).
- **Did not move:** the GHCR images stay under `ghcr.io/nousclawds4/`. The publish workflow and the launcher now name
  `ghcr.io/tapestryprotocol/`. New packages start private, so an org owner makes both Public after the first publish
  and reruns the job (`deploy/RUNBOOK.md`, Handover 3).
- **Still open:**
  - Item 1 holds: the new repo has no rulesets, and an org owner has to create them (admin). Their definitions are now in `.github/rulesets/` (OPERATIONS §4), with the commands.
  - The droplets' `origin` still names the old address, which redirects. Set it to the new one when convenient.
  - Loom's `config/repos.json` and the roadmap's `repo:` lines still name the old repo.
  - Item 3 holds: the public pointers still name the old repo.
  - OPERATIONS §9.1 describes a remote layout that a checkout cloned from ngit does not have (there GitHub is the
    `github` remote, and `origin` is ngit).
  - Never create a new `nousclawds4/tapestry`: it would end the redirect.

**Seen again on 2026-11-14** (the merge of TapestryProtocol/tapestry#55 into `staging`):
- **Staging's `origin` still names the old address.** The deploy run for the merge (run `43606611349`) logged
  "From https://github.com/nousclawds4/tapestry" and "Updating fef86880..66240a92". Staging is the only server whose
  deploy log has been read since the move.
- **The old address still leads to this repo.** Read through the API the same day, `nousclawds4/tapestry` answered as
  `TapestryProtocol/tapestry` (repository id 1430501166).
- **What GitHub says about a transferred repo's old name** (its docs page "Transferring a repository", read the same
  day):
  - A new repository or fork created at the old location deletes the redirect for good. That is the warning that ends
    the list above.
  - GitHub retires the old owner and name for good, so that nothing can be created there, when the repo had "more
    than 100 clones" in the week before the transfer.
  - It recommends pointing existing clones at the new address, with `git remote set-url`.
- **The clones GitHub counted for this repo, by day** (traffic API, read 2026-11-14). The API keeps 14 days, so the
  days before the move are gone from it by 2026-11-25:
  - Oct 31: 92 · Nov 1: 7 · Nov 2: 85 · Nov 3: 47 · Nov 4: 78 · Nov 5: 78 · Nov 6: 114
  - Nov 7: 84 · Nov 8: 170 · Nov 9: 103 · Nov 10: 128 · Nov 11: 26 · Nov 12: 31 · Nov 13: 57

  Any seven days in a row before 2026-11-11 hold between 493 and 755 clones.
- **What the counts show, and what they don't.** By GitHub's rule the old name was retired at the move, so a
  repository cannot be created there. Nothing reads that state back. The only test is to try to create one, which
  stays forbidden: if the name were not retired, the try itself would end the redirect.
- **Still open:** set each server's `origin` to the new address, in `/opt/tapestry`:
  `git remote set-url origin https://github.com/TapestryProtocol/tapestry.git`. Until then a server follows whatever
  the old address leads to. **Owner action,** on each of the four servers that deploy by `git pull`.

**Pointer:** `.claude/skills/cycle-staging/SKILL.md` ("The old repo"); OPERATIONS §9.1;
`engineering-team/reviews/harness-self-improvement/skills-repo-nousclawds4-2026-10-28.md`.
