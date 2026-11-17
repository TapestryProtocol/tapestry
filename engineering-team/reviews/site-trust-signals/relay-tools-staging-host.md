# Review: attest `brainstorm-staging.relay.tools` as one of the estate's hosts

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Lane:** Doc / one-liner (intake §3 strictness table: Implementer + Reviewer, no story file; this
review is the lane's record)
**Diff:** `git diff e8347ee2...42f6d1d6`, the single commit `42f6d1d6` on `origin/staging`:
`SECURITY.md`, `src/utils/siteTrust.js` and `test/site-trust-signals.test.js`, 7 insertions and 3
deletions. No code path changes. The one runtime effect is the comment block of the served
`security.txt`.
**Epic:** `site-trust-signals` (Done; its story, ADR 0036 and story review are under
`done/site-trust-signals/`).
**Provenance:** the answer on NosFabrica/Brainstorm-UI PR 340
([comment](https://github.com/NosFabrica/Brainstorm-UI/pull/340#issuecomment-6927374433)) to the
question Brainstorm-UI's `docs/estate-audit.md` left open. Claim 1 says what that record shows.

**Why this folder.** The epic's folders are under `done/`, which the README treats as shipped and
read-only, so this review goes in the active `reviews/site-trust-signals/`, in the non-numbered
doc-lane form (0-intake §3). Later work on other Done epics is filed the same way:
`reviews/tag-event-inspector/` holds reviews 2 and 3, written after that book closed and moved
review 1 to `reviews/done/tag-event-inspector/`, and `reviews/security-auth-exposure/` gains
reviews while its epic stays Done. harness-lint's review checks (L1, L4) skip `reviews/done/`, so a
review filed there would never be checked; here it reports as `INFO non-numbered-review`.

## What changed

| File | Change |
|---|---|
| `src/utils/siteTrust.js:41` | `ESTATE_ATTESTATION` lists `brainstorm-staging.relay.tools` under Product UI. |
| `src/utils/siteTrust.js:65-66` | The closing sentence gains an exception: a site that resembles Brainstorm on any other domain is not affiliated with us "unless the list above names it". |
| `SECURITY.md:39` | The Product UI table gains `brainstorm-staging.relay.tools`, role Staging. |
| `SECURITY.md:71-72` | The closing paragraph gains the same exception: "unless a table above names it". |
| `test/site-trust-signals.test.js:54` | `ESTATE_HOSTS`, the suite's spec of what the attestation must name, adds the host. |

## Claims adherence

| # | Claim | Evidence (checked at review, 2026-11-16) | Result |
|---|---|---|---|
| 1 | The owner decided the host is one of ours, closing the item Brainstorm-UI's estate audit left open. | `docs/estate-audit.md:181-184` on Brainstorm-UI `staging`, under "Decisions left open": the chart's arrowhead values file points at the host, the attestation doesn't name it, and "If it is an official deployment, the attestation should list it." On PR 340 a contributor asked the owner directly whether the host, which serves the app and where Assistants verify, should count as one of ours. The reply, at 2026-11-16 19:51 UTC: "Yes, count `brainstorm-staging.relay.tools` as one of ours." | Verified, with the limit below the table |
| 2 | The host serves the Brainstorm app. | `GET https://brainstorm-staging.relay.tools/` answers 200 `text/html` with `<title>Brainstorm - Web of Trust for Nostr</title>`, the title `brainstorm.world` and `brainstorm-staging.nosfabrica.com` serve. It is a separate deployment, not an alias: it resolves to 207.244.244.88, where the other three Product UI hosts share 74.208.86.220, and it serves an older build (`index.html` Last-Modified 2026-09-01; script `index-CYhcrW-B.js`, against `index-C46BxTBv.js` on the other two). | Verified |
| 3 | Brainstorm Assistants verify NIP-05 there. | The provided probe (`assistant_hosts.mjs`: kind-0 search `Brainstorm Assistant include:spam` on `wss://search.brainstorm.world`, one page of 200) returns 200 Assistant profiles, with NIP-05 hosts `brainstorm.world` 160, `brainstorm-staging.nosfabrica.com` 23, `brainstorm-staging.relay.tools` 11, `localhost` 3, `brainstorm.nosfabrica.com` 2 and none 1. The probe reads one page and takes each profile's word, so the Reviewer paged the same search back with `until` until a page came back empty (3 pages, 217 events from 217 authors, the same 200 Assistants and the same tally) and fetched `/.well-known/nostr.json?name=<local>` on the host for each of the 11: all 11 return the profile's own pubkey. | Verified: 11 today (PR 340's question counted 13 on 2026-11-13) |
| 4 | The attestation and `SECURITY.md` name the host with the Product UI hosts; the closing disclaimer no longer disclaims hosts the list names; U6b's intent holds. | Rendered `buildSecurityTxt({ domain: 'tapestry.brainstorm.world' })` and read `SECURITY.md`. The host sits in the Product UI group of both, and each closing sentence carries the exception. Neither file contains "not operated by us"; both apex domains are still claimed; "a current inventory, not an exhaustive claim" is kept. Every non-comment line of the document is an RFC 9116 field. U6b passes. | Verified |
| 5 | `ESTATE_HOSTS` adds the host, and U6 would fail if the attestation dropped it. | On a `git archive` copy of `42f6d1d6` with the host's line deleted from `ESTATE_ATTESTATION`, U6 fails with "missing: brainstorm-staging.relay.tools" (19 passed, 1 failed, 8 skipped, H-class pointed at a closed port). The restored copy: 20 passed, 0 failed, 8 skipped. | Verified |
| 6 | NosFabrica/protocols#18 (ECOSYSTEM.md) and NosFabrica/Brainstorm-UI#358 (`SECURITY.md`, `security.txt`) carry the same host and wording. | #18 adds `brainstorm-staging.relay.tools`, role Staging, to ECOSYSTEM.md's Product UI table (line 66 on `main`); merged 2026-11-16 21:10 UTC. #358 adds the same host, and the same exception in the same words, to Brainstorm-UI's `SECURITY.md` and `client/public/.well-known/security.txt`; merged into `staging` at 23:11 UTC. The canonical file changed first and the copies after, the order ECOSYSTEM.md's "Keeping this map honest" asks for. | Verified |

**The limit on claim 1.** The reply on PR 340 was posted from the team's agent GitHub account,
which answers for the owner throughout that PR, not from the owner's own account. GitHub records
the words, not who decided them; that the decision is the owner's rests on the session's account.
The question was asked about the hosts PR 340's site link treats as ours, and carrying "one of
ours" into the published attestation is the step the estate audit asked for. Claims 2 and 3, and
the team's own chart pointing at the host, agree with the decision.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` on the committed tree, clean at `42f6d1d6`:
  `20261116T231704Z-66109-614c [reviewer-relay-tools-staging-host] started 2026-11-16T23:17:04.880Z on 42f6d1d6 — FAIL, exit 1, 8037 passed, 45 failed, 124 skipped, 346/346 suites`.
  The change causes none of the failures:
  - The 23 failing suites are the 23 the Implementer's run failed, and every one also fails in the
    baseline run on unmodified staging (`20261116T210759Z-8832-df03`: FAIL, 24 suites, 71 tests).
    No suite fails here that passes there.
  - Five tests fail here and not in the baseline, the same five in both runs with the change: the
    hygiene-check sentinels of `break-a-goal-into-pieces`, `attach-the-world`,
    `sessions-read-the-brain`, `the-proposal-loop` and `teach-it-what-matters`. They are H-class
    tests against the local stack on `:7778`, whose hygiene check reports `sound: false` on concept
    `tapestry-owner-goal`, while fixtures in the same suites fail as "already exists". That stack
    runs its own code: its `security.txt` still ends with the old sentence and names no
    `relay.tools` host. Failure counts in these suites move between runs (`attach-the-world`: 6
    in the baseline, 1 in the Implementer's run, 6 here), which is stack state, not code.
  - None of the 23 reads a changed file. The six suites that do (`site-trust-signals`, `llms-txt`,
    `information-for-agents`, `assistant-duty-cards`, `manage-treasure-map-page`,
    `brains-launcher-repo`) pass in all three runs, and so does `harness-lint`.
- [x] `node test/site-trust-signals.test.js`: 28 passed, 0 failed, 0 skipped. Its H-class tests hit
  the local stack on `:7778`, which runs its own code, not this branch.
- [x] The same suite stack-free, on the `git archive` copy: 20 passed, 0 failed, 8 skipped, which is
  what CI's stack-free job (`.github/workflows/test.yml`: `npm ci && npm test` on PRs into
  `staging`) will see.
- [x] Mutation checks on that copy: with the host's line deleted, U6 fails (claim 5); with the
  closing sentence reverted to its old form, every test still passes (finding 2).
- [x] harness-lint: `bash scripts/harness-lint.sh` exits 0 with no violations before and after this
  file was added, and reports this file as `INFO non-numbered-review`. The suite, run through its
  exported `run()`, is 85 passed, 0 failed both times.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._
- The optional independent check (workflow 5) was not applied.

## ADR adherence

- ADR 0036's Consequences name this upkeep: the estate list "must be updated whenever a host is
  added or retired". The change makes it in the two files the ADR names, with the test's spec in
  step. No new dependency, and no code path changes. S4 still passes: the hostnames are in the
  attestation text, where the ADR puts them, not in `Canonical` or the indexing switch.
- The ADR shares the list verbatim with the sibling fleets. Brainstorm-UI's copy now carries the
  same two edits (#358); the other copies are out of reach (Limits, below).

## Concept-graph integrity

No concepts, handles, firmware or `/summaries` reads are touched, so no reinstall.

## Things tests can't catch

- No secrets, debug output or commented-out code.
- Whether the prose is true (OPEN.md row 175) was checked by reading the rendered document and both
  `SECURITY.md` copies against the hosts as they answer today: findings 1 and 3.

## Findings

### Blocking

None.

### Non-blocking

1. **The deployment this change claims has two more hosts on `relay.tools`, and the closing
   sentence still disclaims them.** `https://brainstorm-staging.relay.tools/config.js` sets
   `VITE_API_URL` to `https://brainstorm-api-staging.relay.tools` and `VITE_NIP85_RELAY_URL` to
   `wss://nip85-staging.relay.tools`, and both resolve to the UI host's address. The API serves the
   brainstorm_server API (`/openapi.json` title `brainstorm_api`, 48 paths, against 94 on
   `brainstormserver-staging.nosfabrica.com`); the relay answered 502 Bad Gateway at review. No
   copy names either one, ECOSYSTEM.md included, so the new closing sentence tells a reader that
   anything resembling Brainstorm on another domain that the list doesn't name is not affiliated
   with us. This is not a regression: before the change the sentence disclaimed all three hosts.
   An API host is arguably not "a site that resembles Brainstorm", but the attestation lists API
   and relay hosts as members of the estate, so it reads as complete for `relay.tools` when it
   isn't. Only the owner can say whether the two are ours (OPEN.md row 175), so this doesn't block.
   Suggested follow-up: put the question to the owner. If they are ours, add them to ECOSYSTEM.md
   first, then to both `SECURITY.md` copies, both attestations and `ESTATE_HOSTS`, in one
   follow-up. That pass could also sharpen the role column: "Staging" is shared with
   `brainstorm-staging.nosfabrica.com`, a separate stack (claim 2), and since ECOSYSTEM.md uses the
   same label, the sharper one belongs there first.
2. **No test pins the new exception.** With the closing sentence reverted to "A site that resembles
   Brainstorm on any OTHER domain is not affiliated with us." and the host still listed, all 28
   tests pass. The attestation could go back to disclaiming a host it names with nothing failing,
   which is row 175's shape: presence is tested, truth is not. Optional improvement: a U-test that,
   whenever `ESTATE_HOSTS` names a host outside the two apex domains, requires the closing sentence
   to except the hosts the list names. The lane has no Tester phase, so this doesn't block.
3. **The newly named host serves none of the epic's signals.** On `brainstorm-staging.relay.tools`,
   `/.well-known/security.txt`, `/robots.txt` and `/.env` all answer 200 `text/html`, the SPA shell.
   The attestation says it is "published identically on all of them", which was already untrue for
   most of the estate: of the 17 hosts it now names, 7 serve it today (the three Product UI hosts on
   74.208.86.220 and the four tapestry hosts), the four API hosts answer 404 and the five relays
   answer 200 `text/html`. The new host is one more. The fix is in Brainstorm-UI or the
   brainstorm-k8s chart, outside this repo.

**Limits (outside this change, not defects):**

- The brainstorm-k8s chart's copy of the attestation (a private repo) and the hand-placed copies on
  `nip85.brainstorm.world` and `dcosl.brainstorm.world` don't change here.
- The estate now gives two answers about the host. #358 is live on
  `brainstorm-staging.nosfabrica.com` (checked 23:59 UTC), which claims it, while the four tapestry
  hosts and the two production Product UI hosts still serve the old closing sentence, which
  disclaims it. This branch carries the fix to the tapestry hosts as it is promoted; the production
  Product UI hosts get it with Brainstorm-UI's next promotion to `main`.
- Brainstorm-UI's `docs/estate-audit.md:181-184` still lists the host as a decision left open.
- The copies already disagreed beyond the line this change adds. Brainstorm-UI's attestation still
  names `communities.brainstorm.world` and `curate.brainstorm.world` and gives
  `search.brainstorm.world` a fleet of its own; this repo names neither sandbox (U6c).
  `curate.brainstorm.world` answers again, as a list explorer ("Curate · collaborative lists on
  nostr", served from Cloudflare Pages), and ECOSYSTEM.md lists it as production, so U6c's premise,
  a decommissioned droplet, is out of date for that name. The apex claim covers it, so no copy
  disclaims it. Ledger `2026-09-22-estate-inventory-names-dead-hosts` covers part of this.

### Harness friction

1. `node test/harness-lint.test.js` runs nothing. The file exports `run()` with no `require.main`
   entry, so a direct run prints nothing and exits 0, which reads as clean. 148 of the 349
   `test/*.test.js` files have no `require.main` entry. The suite was run here through
   `require('./test/harness-lint.test.js').run()`.
2. A gate run on a dirty tree records only `dirtyCount`. The Implementer's run
   `20261116T213733Z-40766-4d98` reads `e8347ee2`, dirty with 3 files, and finished 37 seconds
   before `42f6d1d6` was committed, so its record can't by itself be tied to the commit under
   review. The rerun above is on the clean commit.
3. harness-lint's INFO line for a non-numbered review says it "predates the numbering convention".
   0-intake §3 has since made that form the convention for doc-lane reviews, so every new doc-lane
   review, this one included, is described as legacy.

## Verdict

**PASS**

A host added to the ownership attestation and its policy page, backed by a recorded owner decision
and by what the host serves and verifies today. The test's spec gains the host and fails without
it, the companion edits are merged in the canonical inventory and in Brainstorm-UI with the same
words, and the full gate on the commit shows no failure the change could cause. Shipping it brings
the tapestry hosts into line with the copy already live on Brainstorm-UI's staging. The two unnamed
sibling hosts and the untested exception are follow-ups.
