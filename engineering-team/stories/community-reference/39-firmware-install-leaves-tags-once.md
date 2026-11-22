# Story 39: A firmware install leaves each header's tags once

**Status:** Done
**Created:** 2026-11-21
**Type:** Bug

## Background

**What's wrong.** On every instance installed since Story 38 shipped (2026-06-17), six concept headers hold each tag of their letter twice: `tag`, `nostr-user-tag`, `tag-pinning`, `nostr-event-tag`, `tagging-with-specific-tag` and `nostr-relay`. Their `b` tag appears once. These are exactly the six firmware concepts whose manifest entry carries a `communityReference`. The public concept summaries list each of them twice:

| Instance | Summary rows | Distinct headers |
|---|---|---|
| david.tapestry.ninja | 75 | 69 |
| staging.brainstorm.world | 52 | 46 |
| tapestry.brainstorm.world | 51 | 45 |
| avi.tapestry.ninja | 72 | 66 |
| tags.brainstorm.world | 49 | 43 |
| magic-carpet.brainstorm.world | 36 | 36 |

magic-carpet is clean: its headers were signed 2026-04-23, before Story 38, and carry no `b`. Read 2026-11-21 through the public read routes, and Zeus on david.tapestry.ninja.

**Why it happens.** Diagnosed 2026-11-21, reading only:
- **The first import replaces the tags.** Each firmware install re-signs every firmware header from its built-in definition, and imports that letter in a way that replaces the header's tags.
- **The second import adds to them.** For a concept with a community reference, the same install then re-signs the header once more with the community `b` added (Story 38's emitter). The import of that second letter adds its tags beside the first letter's and removes none. The two imports name tag nodes differently, so the sets never merge.
- **Every install repeats it.** Cleaning the data alone would last only until the next reinstall.
- **Evidence:** on david.tapestry.ninja, each of the six headers' tag nodes has an id that rebuilds exactly from one import or the other. On staging and production, both sets' ids answer on the public read route.

**Two more faults in the same install step:**
- **Community copies collect a set of tags per version.** Every install brings in each community header and superset again, adding the new version's tags beside the old ones. Production re-signs its `nostr-relay` header on every install, so staging's copy of it holds 9 versions' tags (61 tags; its superset 63). david.tapestry.ninja's and avi.tapestry.ninja's copies hold 2 versions each.
- **Production is its own community.** The manifest's `nostr-relay` reference names production's own header. So production's header carries a `b` naming itself and a relationship from the header to itself. Its own superset is brought in as if another curator had written it, and holds each tag twice.

**Why it matters.**
- **The summaries are the first call agents make.** They open AGENTS.md's orientation ladder, and their `count` reads as the number of concepts.
- **Owner writes would publish the duplicates.** Writes that rebuild a letter from the graph's tags, such as a JSON or slug change, sign every row they find. On these headers they would publish a letter with each tag twice. That hasn't happened yet: each header's id still matches its second letter. Story 40 guards against it.
- **The general fault is already in the ledger** as "Old tags never cleared" (`ledger/2026-11-20-todays-importers-keep-their-faults.md`). This story fixes it for firmware install's community references, the one place that hits it on every install.

**Who's affected:** anyone reading an instance's concepts (owners, agents, the concept pages), and every later firmware install on every instance.

## User-facing description

As an instance owner, or an agent orienting on an instance, I want each concept header to hold its letter's tags once after a firmware install, however many installs have run, so that the concepts are listed once and nothing built from a header's tags repeats them.

## Acceptance criteria

- [ ] **AC-1 (a header with a community reference holds its letter's tags once).** Given an instance whose firmware manifest gives a concept a `communityReference`, when firmware install runs once or several times in a row, then:
  - that concept's header holds each tag of its current letter exactly once, its `b` included;
  - it holds no tag of an earlier letter;
  - it has exactly one `REFERENCES {source:'b-tag'}` relationship, to the community header its `b` names.
- [ ] **AC-2 (a community copy holds only the tags of the version it holds).** Given a community header or superset that an earlier install brought in, whose curator has since published a newer version, when firmware install runs, then the copy holds each tag of the version it now holds exactly once, and no tag of an earlier version, and holds no `REFERENCES {source:'b-tag'}` or `INHERITS_FROM` that the version it holds doesn't derive. *(Amended at Architecture 2026-11-21, ADR 0035: the relationships clause. Copies follow their letter, which is what clears the self-loop that production's `b` left on other instances' copies.)*
- [ ] **AC-3 (an instance that curates its own reference doesn't point at itself).** Given an instance whose own assistant is the curator a concept's `communityReference` names (production, for `nostr-relay`, today), when firmware install runs, then:
  - that concept's header carries no `b` naming its own address;
  - no relationship runs from the header to itself;
  - its superset holds each tag of its letter exactly once, and no relationship runs from its superset to itself. *(Amended at Architecture 2026-11-21, ADR 0035: the superset clause, for production's `IS_A_SUPERSET_OF` loop found during orientation.)*
- [ ] **AC-4 (today's duplicates clear on the first install with the fix).** Given an instance in today's state (the six headers with two sets of tags, community copies holding several versions' tags, and production's self-pointing `b` and relationship), when firmware install runs once with the fix, then every one of those nodes meets AC-1 to AC-3, with no other step.

## Concepts touched

- **The six concept headers,** at `39998:<that instance's assistant>:<slug>`, slugs `tag`, `nostr-user-tag`, `tag-pinning`, `nostr-event-tag`, `tagging-with-specific-tag` and `nostr-relay`. Each instance has its own assistant. As read 2026-11-21:

  | Instance | Assistant |
  |---|---|
  | staging | `8e901369…` |
  | production | `919ba08a…` |
  | david.tapestry.ninja | `a7173e2c…` |
  | tags | `a68dbf56…` |

  The behavior must hold for whichever assistant an instance has.
- **Their community headers:**
  - `39998:82b75e47…:<slug>` for the five event-tagging concepts. These are ADR 0015's legacy concepts, and three of them are pinned by `knownGoodEventId`.
  - `39998:919ba08a…:nostr-relay` for `nostr-relay`, which is production's own header.
  - Each has its `39999:…:<slug>-superset` where the relay holds one.

_(Architect: the local container is David's private agent-memory instance. Don't orient there. Use staging's public `/api/concept-graph/summaries` and `/node/<handle>`.)_

## Out of scope

- **Two guards against duplicates from any importer,** in story 40 of this book:
  - the summaries list a header once even if it holds a repeated tag;
  - an owner's rewrite of a letter never signs a repeated tag.
- **A reinstall drops a `b` the owner authored on a firmware header.** This is a different fault: what a reinstall must keep. It is queued in `stories/_intake.md`, 2026-11-21.
- **The ledger row's other faults and callers.** The other importers that never clear old tags, and the row's other faults (older versions over newer, the 32-bit tag key, the two `importEventDirect` copies), stay open there.
- **Cleaning instances by hand.** Each instance clears on its first install with the fix (AC-4). The reinstalls are this book's rollout, each on the owner's yes.
- **The local agent-memory container** isn't checked or touched by this book, and **avi.tapestry.ninja** is Avi's to reinstall.

## Open questions

For the Architect:
1. **Where the clearing goes.** Either clear a node's old tags before each import in firmware's community-references step, as `event-update` and `set-b-tag` already do, or move that step onto `import nostr`'s recorder, the ledger row's fix shape. The recorder never writes the instance's own nodes (ADR graph-operations-first-slice/0032 Decision 7.2), so it can't make the `b` seed. ADR 0032 also rejected rewriting the shared importer (its Option B), under D15.
2. **The relationships a `b` made.** When a header's letter is imported again, should relationships derived from an earlier letter's `b` go too, as `set-b-tag` clears them, so that a `b` that's gone leaves no relationship behind?
3. **An older version on the relay.** The community fetch could bring back a version older than the copy holds; three of the six have no `knownGoodEventId`. Today's import takes it anyway (the ledger's "older versions over newer"). Does AC-2 need "the newest version stands" too, or does that stay with the ledger row?
4. **Testing without the local container,** for example on a scratch stack, as earlier live checks did.

## Deviations

- **The two builders share only the tag-uuid function.** As ADR 0035 §1 asks, the tag-uuid expression moved into `tagUuidOf` (`src/api/neo4j/eventSync.js`), which both builders call. `buildPruneCypher` computes the node's uuid, and picks out the `b` tags that derive a relationship, with `buildImportCypher`'s own expressions written again beside it. So `buildImportCypher` changes by that one line. The builder suite (P1–P9) runs the two together, so a drift between them fails it.
- **The log lines.** The self-curated reference logs a line of its own, a `(dry-run)` one in a dry run. The never-clobber line now ends "its tags reconciled", since that path imports and prunes.

## Evidence

**The scoped gate, stack-free (2026-11-21).** It ran on `5d81232c` (the failing tests' commit), with the implementation in the working tree, committed unchanged after it. Every endpoint was dead, as the test plan's "How to run" sets:
- stub `curl` and `docker` first on `PATH`;
- `BRAINSTORM_CONF_PATH` at a conf whose `NEO4J_URI` is a closed port;
- `BRAINSTORM_BASE_URL` and `TAPESTRY_PORT` at a closed port, `TAPESTRY_CONTAINER` unset.

Its 27 suites were derived from the diff: every registered suite that loads or reads `src/api/neo4j/eventSync.js` or `src/firmware/install.js`.
- The story's two, and the four that pin the community-references step: `b-tag-primitive`, `b-tag-seeds`, `community-reference-nostr-relay-stub` and `community-reference-superset-link`.
- Those that exercise `buildImportCypher` or read the step: `community-class-thread-pull`, `b-coverage-audit-and-disposition`, and `operations.test.js`, which runs every suite under `test/operations/` (`tapestry-key-paths`, `cypher-engine` and import nostr's among them).
- Those that load install in a child: `firmware-element-sync`, `firmware-nodes-hold-their-concepts-keys`, `word-elements-fit-the-installed-word-schema`, `schema-save-finds-the-right-header`, `pass-3-finishes-in-minutes` and `graph-rule-firmware`.
- Those that read either file's source, or skip their live parts with no stack: `close-unauth-write-surface`, `relationship-primitives`, `create-concept-duplicate-check`, `store-the-four-when-a-goal-is-captured-or-updated`, `default-deny-mutations`, `dlist-curation-header-endpoint`, `curated-dlist-update-publish`, `nostr-user-tag-hybrid-ea-writer`, `brains-launcher-repo`, `event-less-create-set`, `pin-a-tag` and `profile-tags`.

Two were left out:
- `event-tagging-firmware-seed`, which calls `localhost:7778` whatever the environment says;
- `stack-free-npm-test`, whose G2 runs live tests when a control panel answers. It stays CI's.

**Results:**
- **Overall: PASS, 1727 passed, 0 failed, 85 skipped across 27 suites** (record `tmp/gate-runs/20261121T161645Z-95758-e2ea.json`, which git ignores). The skips are live parts, which need a stack.
- The story's suites gave 9 and 16. The four that pin the step gave 16, 7, 4 and 4, as before.

**Not checked here.** The change touches no concept definition, so there was no concept-graph orientation, and the local container is off-limits. The live check is the book's reinstall of staging, on the owner's yes (ADR 0035, OQ-4).

**After review round 1, on the branch merged with staging (2026-11-21).** The branch merged `origin/staging` (`25078cf9c`), which brought in `lifecycle seed-firmware`. Then came ADR 0035 Amendment 1, its tests, and its fixes, through `f344f1a92`.
- **The scoped gate:** 92 suites, derived from `git diff origin/staging...HEAD`, in the same environment.
- **Result:** run `20261121T180907Z-86999-f4a0`, FAIL, exit 1, with 2126 passed, 3 failed and 132 skipped. All three failures are `router-stream-limit-on-connect` P1–P3, the router patch's GNU `sed -i` on macOS (OPEN.md row `2026-10-09-router-patch-sed-macos`). Staging's own tree fails the same three here.
- **The story's suites** now give 24 tests (`firmware-install-leaves-tags-once`) and 9 (`community-references-prune-builder`). `seed-firmware-target` gives 34, ST33 included.

**On staging (2026-11-21).**
- **The deploy.** TapestryProtocol/tapestry#189 merged at 19:46:39 UTC as `f2e14987`. Deploy run 44942742796 pulled the fix's four source files. The smoke test was clean on tiers 1–3 and 5; no UI changed, so there was no tier 4.
- **Two installs cut off.** Each reinstall ran as the loopback call `POST http://127.0.0.1:7778/api/firmware/install` inside the container, just after `scripts/check-safe-to-merge.sh` answered `safe`. A merge into `staging` followed each of the first two within seconds (#181 at 20:28:09, #190 at 20:51:19), and its deploy recreated the container 1 minute 40 seconds into Pass 1. Ledger row `2026-11-21-deploy-safety-misses-firmware-installs` records why. In between, `tag` and `nostr-relay` held Pass 1's letter: 6 tags and no `b`, with their `REFERENCES` to their community headers intact.
- **The third install finished.** It ran from 22:07:06 to 22:11:46 on `425006cf`, with the owner holding merges. Pass 1 gave 41 concepts and 0 errors, Pass 2 41 enriched, and the log ends "FIRMWARE INSTALL COMPLETE". Read with read-only Cypher just before and after:

  | | Before | After |
  |---|---|---|
  | `tag` and `nostr-relay` | 6 tags, no `b` | 7, one `b` |
  | `nostr-user-tag`, `tag-pinning` and `nostr-event-tag` | 13, one `b` | 7, one `b` |
  | `tagging-with-specific-tag` | 17, one `b` | 9, one `b` |
  | The copies of production's `nostr-relay` header and superset | 61 and 63 | 7 and 7 |
  | The copies of the Mac Studio's five event-tagging headers and three supersets | 6 to 9 each | unchanged |
  | Tag nodes no event holds | 0 | 0 |

- **AC-1.** Each of the six headers has one `REFERENCES {source:'b-tag'}`, to the community header its `b` names.
- **The public routes, after** (ADR 0035 §5). install-status gives 41 of 41 concepts at 1.0.0. The summaries give 46 rows for 46 headers (50 before). The sweep finds none of its 56 nodes holding a repeated tag: the 46 headers and 10 community copies, since two of the Mac Studio's supersets aren't on staging.
- **Three loops are left among them.** Each is on a copy whose letter's `b` names its own address, so the copy derives it (AC-2). `/neighbors` finds them among the same 56 nodes; none of staging's 46 headers has one.
  - **The copy of production's `nostr-relay` header,** as Amendment 1 item 5 expects. It goes at staging's first install after production's.
  - **The copies of the Mac Studio's `nostr-event-tag` and `tagging-with-specific-tag` headers,** which Amendment 1 didn't foresee. Their letters were signed on 2026-07-17 by the Mac Studio's agent-memory instance, their references' curator. They go only after that instance has an install with the fix, which is the owner's word, its new letters reach `wss://dcosl.brainstorm.world`, and staging installs again. Ledger row `2026-11-16-curator-instance-superset-self-loop` says so.
- **The run records** are in the main checkout's `tmp/live-check-39/staging/`, which git ignores. The install's answer is in `/tmp/fw-install-story39-20261121T220706Z.log` on the droplet.

**On production (2026-11-21).**
- **The promotion.** TapestryProtocol/tapestry#193 carried this story with eight other PRs. The container-apt-refresh session cut it at `425006cf`, and merged it at 22:32:48 UTC as `196a475f`, after a safe verdict. Deploy run 44957304980 (22:32:51 to 22:34:46) pulled the fix's four source files. That session's smoke test was clean on tiers 1, 2 and 5.
- **The install** ran from 23:37:29 to 23:41:29, after a safe verdict at 23:36:34, with no PR into main open and that session holding main. Pass 1 gave 41 concepts and 0 errors, Pass 2 41 enriched, and the log ends "FIRMWARE INSTALL COMPLETE". The community step logged "nostr-relay: this instance curates its own reference — skipped, its loops to itself removed". Read with read-only Cypher just before and after:

  | | Before | After |
  |---|---|---|
  | `tag`, `nostr-user-tag`, `tag-pinning` and `nostr-event-tag` | 13 tags, one `b` | 7, one `b` |
  | `tagging-with-specific-tag` | 17, one `b` | 9, one `b` |
  | `nostr-relay`, whose reference production curates | 13, one `b`, naming itself | 6, no `b` |
  | Its superset | 14 | 7 |
  | The copies of the Mac Studio's five event-tagging headers and three supersets | 6 to 9 each | unchanged |
  | Tag nodes no event holds | 0 | 0 |

- **AC-1.** Each of the other five headers has one `REFERENCES {source:'b-tag'}`, to the Mac Studio's header its `b` names.
- **AC-3.** `nostr-relay`'s header carries no `b` naming its own address, and no relationship runs from it to itself. Its superset holds each tag once and is no longer linked to itself. Before the install, the header pointed at itself through its `b` and a `REFERENCES`, and the superset through `IS_A_SUPERSET_OF`.
- **The public routes, after** (ADR 0035 §5). install-status gives 41 of 41 concepts at 1.0.0. The summaries give 45 rows for 45 headers (51 before). The sweep finds none of its 56 nodes holding a repeated tag (7 before). `/neighbors` finds two loops among them: the copies of the Mac Studio's `nostr-event-tag` and `tagging-with-specific-tag` headers, as on staging.
- **Not this story's.** A read-only query for every node linked to itself found `superset-superset -HAS_ELEMENT->` itself after the install, which wasn't there before. `set-superset`'s `HAS_ELEMENT` to itself was there before and after. Staging's `set-superset` lists itself too, but its `superset-superset` doesn't. Ledger row `2026-11-15-reinstall-drops-a-supersets-own-membership` has a note.
- **The run records** are in the main checkout's `tmp/live-check-39/production/`. The install's answer is in `/tmp/fw-install-story39-20261121T233729Z.log` on the droplet.

**On tags (2026-11-22).** tags.brainstorm.world deploys `feat/tags`, which diverged from staging in September.
- **The port.** TapestryProtocol/tapestry#203 (`port/header-tags-once-tags`) brought the fix over, as ADR 0035 §4 asks. See the test plan's and the review's sections "The feat/tags port"; the review gave PASS once its findings were fixed.
  - It merged at 03:15:38 UTC as `73704d7f`, after a safe verdict.
  - Deploy run 44979810348 (03:15:40 to 03:24:27) pulled the port's two source files.
  - The smoke test was clean. Tags' `/api/ready` answers 401, as it did before.
- **The install** started at 03:29:41, after a safe verdict, with no PR into `feat/tags` open.
  - Pass 1 gave 43 concepts and 0 errors, and Pass 2 43 enriched. Pass 3 took most of the time: `feat/tags` doesn't have staging's faster Pass 3.
  - The log ends "FIRMWARE INSTALL COMPLETE" at about 04:09, some 40 minutes in.
  - The script's request gave up at 30 minutes, at 03:59:41, with no answer. Its after-reading was taken then, once the community step had run, and the log was read over SSH at 04:14.
- **It took the seed path,** as the review found it would. Pass 1 signed each of the six headers again, the step seeded each ("pointer-b seeded"), and the copies were brought in.

  | | Before | After |
  |---|---|---|
  | `tag`, `nostr-user-tag`, `tag-pinning`, `nostr-event-tag` and `nostr-relay` | 13 tags, one `b` | 7, one `b` |
  | `tagging-with-specific-tag` | 17, one `b` | 9, one `b` |
  | The copy of production's `nostr-relay` header | 7 tags, one `b`, a `REFERENCES` to itself | production's new letter: 6, no `b`, no loop |
  | The copy of production's `nostr-relay` superset | 7 | 7 |
  | The copies of the Mac Studio's five event-tagging headers and three supersets | 6 to 9 each | unchanged |
  | Tag nodes no event holds | 0 | 0 |
  | The summaries | 49 rows for 43 headers | 43 for 43 |

- **AC-1.** Each of the six headers has one `REFERENCES {source:'b-tag'}`, to the community header its `b` names.
- **The public routes, after.** install-status gives 43 of 43 concepts at 1.0.0. The sweep finds none of its 53 nodes holding a repeated tag: the 43 headers and 10 community copies. `/neighbors` finds two loops among them, on the copies of the Mac Studio's `nostr-event-tag` and `tagging-with-specific-tag` headers, as on staging and production.
- **`dog-breed`'s header was signed again from firmware's file,** as a tags install does for every firmware concept. The `b` and the description added there on 2026-10-01 are gone. That `b` named another instance's header and derived nothing.
- **The two meta-supersets list themselves on tags too,** before and after. Ledger row `2026-11-15-reinstall-drops-a-supersets-own-membership` has a note.
- **The run records** are in the main checkout's `tmp/live-check-39/tags/`. The install's answer, which is empty, is in `/tmp/fw-install-story39-20261122T032941Z.log` on the droplet.

## Linked artifacts

- Book: `engineering-team/audits/header-tags-once/book.md`
- Ledger row: `ledger/2026-11-20-todays-importers-keep-their-faults.md`
- Predecessors:
  - Story 38: `engineering-team/stories/community-reference/38-b-tag-primitive-emitter-derivation.md`
  - Its ADR: `engineering-team/decisions/community-reference/0034-b-tag-primitive-emitter-derivation.md`
  - ADR 0030: `engineering-team/decisions/community-reference/0030-communityreference-seed-not-stub.md`
  - `import nostr`'s ADR: `engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md`
- ADR: `engineering-team/decisions/community-reference/0035-community-references-import-then-prune.md`
- Test plan: `engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.test-plan.md`
- Review: `engineering-team/reviews/community-reference/39-firmware-install-leaves-tags-once.md`
