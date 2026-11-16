# Story 9: `tapestry-keys` finishes on a large graph whatever the transaction limit

**Status:** Done
**Created:** 2026-11-15
**Type:** Bug

## Background

Story 8 seeded a scratch stack to staging's shape, to measure a firmware install. To mirror staging, it then tried to add the uniqueness rule `tapestry_key` with story 3's migration, and the migration failed (ledger row `2026-11-15-tapestry-keys-exceeds-transaction-memory`). The scratch stack caps Neo4j's transactions at 512 MB in all (`dbms.memory.transaction.total.max`, `BRAINSTORM_NEO4J_TX_MAX_MB=512` in `scripts/scratch-stack.sh`). Its graph had 3,851,244 nodes, every one already keyed and labelled `TapestryNode`. `tapestry lifecycle migrate --migration tapestry-keys` answered after 7 s, before adding the rule:

> lifecycle migrate failed: The allocation of an extra 2.0 MiB would use more than the limit 512.0 MiB. Currently using 510.0 MiB. dbms.memory.transaction.total.max threshold reached

Story 8's seeder adds the rule itself instead.

**Reproduced on 2026-11-16** on a fresh scratch stack seeded the same way (Neo4j 5.26.10 Community, 512 MB limit, this branch's code):

- **The shape above, with the rule dropped.** The same answer after 6.6 s, with no backup taken. The job failed in its plan, before any change.
- **Which read.** Each query the plan sends was timed where it leaves the migration. Every read passed except the check for keys held by more than one node. It ran for 1.7 s and failed with `Neo.TransientError.General.MemoryPoolOutOfMemoryError`. With no rule in place, that check reads every key in the graph and groups them all at once. Decision 4's scan, the count of nodes with no key, held 2 MB.
- **How much it needs.** Neo4j's own profile of that check, over the first 250,000, 500,000 and 1,000,000 keys, gives 394 bytes per key, exactly in proportion. That is about 1.5 GB for staging's 3.85 million nodes, and about 1.8 GB for production's 4.6 million once all of them are keyed. A 512 MB limit holds about 1.36 million keys.
- **Production's shape.** Half the users, and every card set and card, had no key and no label (2,294,384 nodes); 1,556,860 nodes were keyed and labelled; there was no rule. The migration took its backup first, which takes the graph offline, and then failed at the same check. Nothing changed. On production, the owner would pay the backup's offline window and get no migration.
- **The rest of the migration fits.** The keys pass gave keys and the label to those 2,294,384 nodes in 13 s, with all transactions together peaking at 28 MB. The rule came online over 3.85 million keys in 7 s.

**Why it hasn't shown before.** Story 3's live check ran the migration on 3,003,145 nodes, of which 3,145 had a key. Staging ran it on 2026-11-13, soon after story 3's deploy, with a larger limit. Neither had millions of keys and no rule when it ran.

**Why it matters before production.**

- **Production hasn't run `tapestry-keys`.** It has 4,625,039 nodes (story 8, read-only, 2026-11-15). Story 3's promotion to main brings the run, and OPERATIONS.md §17 tells the owner to run it soon after.
- **More keys arrive every hour after the deploy.** From the deploy on, every node the trust pipeline touches gets a key and the label (story 3, AC5), and the stream touches each follow list's author and everyone they follow. The longer the run waits, the more keys the check holds at once.
- **The limit is shared.** `dbms.memory.transaction.total.max` caps all of the instance's transactions together, not one at a time. While the check holds most of it, the trust pipeline's writes can fail too. Production's limit comes from the entrypoint's formula: half of Neo4j's heap, about 4 GB on its 32 GB droplet unless its `.env` overrides it. The check would take about 1.8 GB of that once production is fully keyed. Nobody has read production's actual value.
- **Every new instance reaches this state.** Its nodes get keys as they are made, so its first `tapestry-keys` run, which only adds the rule (ADR 0003 Decision 4), checks every key in the graph. Hosted instances run on smaller machines, with smaller limits.

**Who is affected:**
- the owner, who runs `tapestry-keys` on production after the promotion, and on any instance that hasn't run it;
- the trust pipeline, and anything else that writes while the migration runs;
- story 8's seeder, which adds the rule itself rather than run the migration.

## User-facing description

As the owner, or an admin agent, I want `tapestry lifecycle migrate --migration tapestry-keys` to finish on a graph of millions of nodes, whatever the instance's transaction limit. Then running it on production is safe, and the instance's other writes don't fail while it runs.

## Acceptance criteria

- [ ] **AC1. Staging's shape, with no rule.**
  - Given: a scratch stack (512 MB transaction limit), seeded to staging's shape (3.85 million nodes, every one keyed and labelled), with the rule `tapestry_key` dropped.
  - When: `tapestry lifecycle migrate --migration tapestry-keys` runs.
  - Then: it answers `done` with no backup taken. Its report says the rule was `added`, and the index `tapestry_node_uuid` was already there or `added`, both online. No key was given and no key is shared. `lifecycle status` reads `tapestry-keys` as applied.
- [ ] **AC2. Production's shape.**
  - Given: the same stack in production's shape. Half the users, and every card set and card, have no key and no `TapestryNode` label, as production's nodes will before its run. The rest are keyed and labelled, as the pipeline leaves them. There is no rule.
  - When: `tapestry-keys` runs.
  - Then: it takes its backup, gives every node without a key one, and gives the label to every node without it. It keeps every key a node already had. It adds the rule and the index, both online, and status reads it applied.
- [ ] **AC3. Shared keys are still found at that size.** Given staging's shape with two keys planted on more than one node, one on two nodes and one on twelve, when `tapestry-keys` runs:
  - **with no rule:** it changes none of those keys and leaves the rule out. Its answer names each shared key with how many nodes hold it and up to ten of those nodes, as it does today on a small graph. Status reads it as not applied.
  - **with the rule in place, and a node without the label holding a labelled node's key:** it leaves that key alone and names it the same way. Status reads `tapestry-keys` as not applied.
- [ ] **AC4. It doesn't depend on the limit.** On the graphs of AC1 and AC2:
  - Neo4j's transaction memory stays under 64 MB throughout the run, all transactions together, as `SHOW TRANSACTIONS` reports it. That is an eighth of the scratch stack's limit; today's check alone needs 1.5 GB on the AC1 graph.
  - The memory doesn't move into the job's own process instead. That process reads what Neo4j sends.
    - **On AC1's graph,** where the job takes no backup, it peaks lower than a backup's count of the same keys. OPERATIONS.md §17 gives that cost as about 400 MB at three million keys.
    - **On AC2's graph,** the job's own backup counts the keys first and sets the job's peak. The check adds no more than 8 bytes a key, plus 64 MB, to the peak the backup leaves. That peak is read when the job moves on to `planning` after its backup.

    *Restated at Review round 1 (2026-11-16), at the owner's ruling. The first wording asked AC2's job, too, to peak no higher than a backup's count run alone. That job includes its own backup, which already peaked at 1.20× that yardstick before the fix, so the first wording couldn't hold there for any code (review `9-tapestry-keys-within-transaction-memory.md`, Blocking 1).*
  - The test plan records the time and memory of each read the migration makes, before the fix and after it.
- [ ] **AC5. Nothing else changes.**
  - Every behaviour story 3's suites check still holds: the passes, the `'{}'` placeholder, the backup first, the rule and index outcomes, the report's fields and its words, and status.
  - `lifecycle status` on the migrated AC1 graph answers about as quickly as it does today.

## Concepts touched

None. No concept definition changes, so there is no firmware reinstall.

## Out of scope

- **Running `tapestry-keys` on production or staging.** That is the owner's call, once the fix is deployed.
- **Raising any instance's limit, or changing the entrypoint's formula.** The fix is that the migration doesn't need either.
- **The backup's own read of every key before the rule exists.** ADR 0003 Amendment 2 already streams it, and OPERATIONS.md §17 gives its cost.
- **Story 8's seeder.** Once this lands it could run the migration instead of adding the rule itself. Whether it should is the test plan's call.
- **Other reads elsewhere that group the whole graph.** Any found while working this become ledger rows of their own.

## Open questions

1. **Production's limit.** May production's `dbms.memory.transaction.total.max` be read, read-only, before the promotion? It says how close today's code would come to failing there, beside the pipeline. The fix doesn't depend on the answer. *Left open at approval (2026-11-16): the owner approved the story without answering it, so nothing on production is read.*

## Deviations

- **One function gives a key's comparison text** (`keyText` in `_migrations.js`), and both `keyHash` and the exact comparison in the second read use it. That way the two can't drift apart: a string is its text, and any other value carries its type, as ADR 0009 Decision 5 says.
- **Key order is the order of that comparison text.** For string keys that is their text. A key of another type, which no path writes, sorts before them. The answer still shows `String(key)`, as before.
- **The second read hashes a row only when there is a hash candidate.** When the only shared keys are held ones (the rule in place), it compares the text alone.
- **The hash array** starts at `max(1024, expected × 1.01)` and doubles when full (`HASHES_MIN`, `HASHES_SLACK`).
- **The ledger row** `2026-11-15-tapestry-keys-exceeds-transaction-memory` flips to `DONE` in the pull request's own commit, once the pull request has a number, since ADR 0009 asks the row to name it.

## Linked artifacts

- Found by: story 8's live check (`engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.test-plan.md`, Test infrastructure), ledger row `ledger/2026-11-15-tapestry-keys-exceeds-transaction-memory.md`. The migration is story 3's (`engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md`, AC1–AC3; ADR `graph-operations-foundation/0003`, Decision 4).
- ADR: `engineering-team/decisions/graph-operations-foundation/0009-shared-keys-from-a-stream-of-hashes.md` (amends ADR `graph-operations-foundation/0003`, Decision 4)
- Test plan: `engineering-team/stories/graph-operations-foundation/9-tapestry-keys-within-transaction-memory.test-plan.md` (suite `test/operations/lifecycle/shared-keys.test.js`)
- Review: `engineering-team/reviews/graph-operations-foundation/9-tapestry-keys-within-transaction-memory.md`
