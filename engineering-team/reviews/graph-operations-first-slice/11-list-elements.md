# Review: Story 11 — `graph list-elements`, the elements of a concept or a set, from a point of view

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff 18b5db81...da964c9e`. These are the branch's commits after its story and ADR merged as #71. They merged into staging as PR #72 (`5a27550a`, by the owner, 2026-11-16 01:31:35 UTC) before this review, so whatever this review asks lands in a follow-up on the same branch.

## Quality gates (run by reviewer, not trusted)

- [x] **The full gate:** PR #72's CI, check `stack-free`, passed in 8m15s (run 43785524838) on `da964c9e`, whose tree is `5a27550a`'s. No full `npm test` ran on this Mac, by the owner's rule: the local stack is his agent-memory instance. So there is no local `npm run gate:status` line for this diff (ledger row `2026-11-15-gate-status-shows-another-commits-run`).
- [x] **Run by the Reviewer** on `28b55c6a` (staging with #72 and #73), one at a time, with every endpoint dead:

  | Suite | Result |
  |---|---|
  | `test/operations/graph/list-elements.test.js` | 28 / 28 |
  | `test/operations/reads.test.js` | 15 / 15 |
  | `test/operations/graph/list-elements-agent-through-cli.test.js` | 2 / 2 |
  | `test/operations/graph/history.test.js` | 8 / 8 |

- [x] **Run by the independent checker** on `da964c9e`: the same four, and `test/operations/graph/agent-through-cli.test.js` 1/1.
- [x] _Playwright not applicable: no UI._
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

**The independent check.** A read-only reviewer agent audited the diff, given the story, the ADR, the test plan and the code, but not this review's conclusions. It found nothing blocking, and ten non-blocking findings. Each was checked against the sources here. One is ruled blocking (Finding 1), for the reason it gives. The rest are below as asks or records.

## Spec adherence

- [x] Every acceptance criterion has a passing test:

  | Criterion | Tests |
  |---|---|
  | AC1 | LE1–LE6 |
  | AC2 | LE7, RC4, RC13 |
  | AC3 | LE8–LE11, RC5–RC8 |
  | AC4 | LE12–LE18, RC9–RC12, RC14 |
  | AC5 | LE19–LE22, LE28 |
  | AC6 | LE23–LE26, LX1, LX2 |
  | AC7 | LE27, RC1–RC3, RC15, and `history.test.js` unchanged |

  The live check in the story's Evidence covers AC1–AC6 on a real Neo4j.
- [ ] **No criterion is silently dropped:** AC3 doesn't hold on a graph that still holds the legacy key `'{}'` (Finding 1).
- [x] **No behavior added that isn't in the story.** Amendment 2's card-set refusal comes from ADR 0028 Amendment 3, which the owner approved, and the gate approved this story's Amendment 2 (process note 2).

## ADR adherence

- [x] **Files.** The changed files match the Implementation notes. Nothing on the ADR's "Not changed" list was touched: `history.js`, `changes.js`, `_fields.js`, `_nodes.js`, `graph.js`, `src/api/_shared/pov.js`, the subgraph route, and the test helpers story 16 owns.
- [x] **Statements.** L1–L4 and C2's scores read match the ADR as amended. The four walks are fixed texts, and every input reaches Cypher as a parameter.
- [x] **Contract.** The answer, the node and `pov` follow C1–C3 and Amendment 1. So do the cursor's format and the refusal codes and statuses (400, 404, 409, 409, 400, 400).
- [x] **No new dependencies,** and no firmware change.
- [ ] **One gap:** Decision 2 says the read "lists no node without a tapestryKey", and a `'{}'` key is none (Finding 1).
- [ ] **One stale sentence:** Decision 2's step 3 says "Both checks run before the graph is read", but for the owner's point of view, `resolvePov` reads the scores first (Finding 6).
- [x] **Deviations.** The story logs four small ones and Amendment 2's line.

## Concept-graph integrity

- [x] **Handles** are written `kind:<TA>:slug`. No assistant pubkey is hardcoded: `reads.js` takes it from `getOwnerAssistantPubkey()` at run time.
- [x] **Firmware:** no concept definition changed, so no reinstall is needed. The live check found the image's firmware identical to the branch's.
- [x] **Orientation:** the ADR oriented through `/api/concept-graph/summaries` and the class-thread concept's node.

## Things tests can't catch

- [x] **Secrets:** none in committed files. The live check's keys were made inside the throwaway instance and removed with it.
- [x] **Debug logging:** no debug logging, no `console.log`, no commented-out code. Each call does log `getConfigFromFile`'s lines for the owner's key, as every caller of `getOwnerPubkey` already does.
- [x] **Error paths.** Every refusal names its input and says what to pass instead. A limit past the schema fails with a 500.
- [x] **Concurrency.** The counts and the page are two reads, each at its own moment, as the ADR says. A write between them can make them differ by what it changed.
- [x] **Security.**
  - Only the owner and admins may call it, and the route table and the router's own check both say so (LE23).
  - Every input is checked by its schema.
  - Cypher's text gets only firmware aliases, fixed fragments with checked variable names, and a checked whole-number limit.
  - A cursor's position is checked before it is used as a parameter.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable: the book has an acceptance frame, not a PRD, and the read has no UI.

## Findings

### Blocking

1. **`src/operations/catalog/graph/list-elements.js:139` and `:150`: elements keyed `'{}'` are listed, and the read then refuses its own cursor.**
   - **The convention.** `'{}'` is the legacy placeholder the codebase reads as no key: `src/lib/tapestry-key-cypher.js:24–26`; `lifecycle status`'s `withoutKey`, "'{}' counts as none" (`src/operations/catalog/lifecycle/status.js:92`); and ADR graph-operations-foundation/0003, Context 2: "Some nodes hold `{}` as a key".
   - **What the code does.** Both statements test only `e.tapestryKey IS NOT NULL`, so such a node is listed with `"{}"` as its tapestryKey and counted in `kept`. When it ends a page, the next cursor holds `"{}"` as its position. `:97` accepts only a tapestryKey there, so the next call is refused `invalid-cursor`, and the rest of the list can't be reached.
   - **What it breaks.** AC3 ("passing each page's cursor in turn answers every element exactly once"), and Decision 2's "it lists no node without a tapestryKey". Graphs that `lifecycle migrate --migration tapestry-keys` hasn't yet keyed are affected.
   - **Asked change:**
     - leave `'{}'` out wherever L3 and L4 leave out a null key (`AND e.tapestryKey <> '{}'`), so such a node is neither listed nor counted;
     - a test: an element keyed `'{}'` in the seed is neither listed nor counted, and paging over the concept reaches its last page.

### Non-blocking (asked in the same follow-up, since one is open anyway)

2. **`docs/GRAPH_OPERATIONS_CATALOG.md:15–22`: the Conventions overstate in one place and leave out three facts.**
   - **The overstatement:** "A cursor works only with the read and the list that gave it" isn't true of `graph history`, whose cursor predates C1 and names no list (ADR 0011, C4 and debt 3).
   - **What's left out:**
     - the owner's own pubkey works as `pov`;
     - `address` can be an event id;
     - a node with no author counts as `own`.
   - **Asked:** say those four things.
3. **`src/operations/reads.js:63`: the shared cursor refusal names list-elements' own inputs** ("the same concept or set, the same direct and the same point of view"). A later read that reuses `decodeCursor`, such as `walk`, would name inputs it doesn't take. **Asked:** word it for any read, for example "with the same inputs that made it".
4. **`src/operations/reads.js:120–123`: the owner's key is normalized but the assistant's isn't.** `ownKeys` normalizes the owner's key (`:111–117`) but takes `getOwnerAssistantPubkey()` as it comes, and that returns `TA_PUBKEY` or the key file's pubkey unchecked (`src/utils/assistantKeys.js:53–54`, `:72–73`). If `TA_PUBKEY` held uppercase hex or a trailing newline, every element made here would be judged by score and answered `own: false`. **Asked:** trim, lowercase and check both keys the same way.
5. **The tests don't pin AC4's "above".** No author is scored exactly at the cutoff, so `>=` in place of `>` would pass every suite. **Asked:** a peer scored exactly at the default cutoff, left out.
6. **ADR 0011 :188, Decision 2 step 3, is stale.** It says "Both checks run before the graph is read", but for the owner's point of view, `resolvePov` reads the scores before the cursor is decoded. The Deviations say the scores read comes before the node read, not before the cursor check. **Asked:** correct the record in the ADR, or in the story's Deviations. A cursor that doesn't parse then costs one cheap read before its 400.
7. **The ledger row `2026-11-16-verified-cutoff-two-homes` duplicates an intake item.** That item is `engineering-team/stories/_intake.md`, 2026-06-06, item 2, "Verified-cutoff inconsistency". It records a live `graperank.conf` of 0.01, so the row's "Nothing changes while both stay at 0.05" (`:17`) misstates today. **Asked:**
   - close the row as a duplicate of the intake item, pointing there;
   - add a line to the intake item saying the graph reads (`src/operations/reads.js`) now read the cutoff the same way as the API's readers.

### Non-blocking (recorded, no change asked)

8. **The walk's cost on deep or many-parent class threads is unmeasured.**
   - **The walk:** `IS_A_SUPERSET_OF*0..`, twice a page, with no per-query deadline (`src/operations/graph.js:65–68`). Sets with several parents (story 28) multiply the paths Neo4j follows before `WITH DISTINCT`.
   - **What was measured:** the live check covered breadth only, 10,000 elements under one superset.
   - **For later:** worth measuring on the rebuilt brain (A10.39), and in `walk`'s ADR (A10.14).
9. **The trust test judges only the element's author** (C2), not the authors of the set links on its path.
   - **Why that holds today:** for the owner's own concepts, the links are the owner's. The class-thread pull never makes a link whose parent is in the instance's own part of the graph (BIBLE §23).
   - **Where it won't:** `walk`, which follows chosen relationship types, has to judge edges ("A walk follows only the edges whose authors its point of view trusts", catalog §1).
   - **For later:** a design question for A10.14's ADR, before it reuses `trust`.
10. **`concept-or-set` carries no `input` field.** Its message names both inputs in words, which meets AC5's "naming the input" for a refusal about the pair.
11. **The set walk's `s.uuid IS NOT NULL` (`list-elements.js:41`) can't be reached,** since L1 refuses first. It is defensive, as Amendment 2's item 2 asks.
12. **Two test gaps.** No test follows a set's listing across a cursor, and LE27 checks the catalog's words rather than its numbers. Both are optional.
13. **L2's hint names a superset without checking its address.** ADR 0028 Amendment 3 says every superset has one.

### Process notes

1. **#72 merged before the review.** The owner merged it on 2026-11-16 at 01:31:35 UTC, with CI's full gate green. This review and its follow-up therefore come after the merge, on the same branch.
2. **Amendment 2's approval.**
   - **Where it is:** it sits in the Tester commit `0b10edcb`, beside LE28 and ahead of the code it changed, as story 4's precedent asks.
   - **What it rests on:** the owner's approval of ADR 0028's Amendment 3, which itself passes the reading on to ADR 0011's readers.
   - **The approval:** the owner's "Enter Review" (2026-11-16) answered the Implementation gate whose message said the go-ahead also approved Amendment 2.

### Harness friction

1. **The worktree's `node_modules` link shows as untracked.** A worktree needs `node_modules` to run the suites, and this one, like story 16's, holds a link to the main checkout's. `.gitignore`'s `node_modules/` matches only a directory, so `git status` lists the link as `?? node_modules`, and a `git add -A` would commit it. This commit adds ledger row `2026-11-16-worktree-node-modules-link-untracked` (`meta`).

## Verdict

**CHANGES_REQUESTED**

There is one blocking issue, Finding 1: AC3 and Decision 2 fail on a graph that holds `'{}'` keys. The fix is the two-statement change and a test. Asks 2–7 are small and should land in the same follow-up. Everything else matches the story, the ADR and its two amendments, and the full gate is green. The story stays `Approved` this round.

**CHANGES_REQUESTED**

---

## Round 2 (2026-11-16, on `9d0258c3`)

**Diff:** `git diff 23458b98..9d0258c3`: the Tester commit `bb8bcaff`, then the Implementer commit `9d0258c3`, both on PR #76.

### Quality gates (run by reviewer, not trusted)

- [x] **The full gate:** PR #76's CI, check `stack-free`, passed in 6m25s (run 43789125087) on `9d0258c3`.
- [x] **Run by the Reviewer** on `9d0258c3`, one at a time, with every endpoint dead:

  | Suite | Result |
  |---|---|
  | list-elements | 30 / 30 |
  | reads | 16 / 16 |
  | agent through the external CLI | 2 / 2 |
  | history | 8 / 8 |
  | `test/operations.test.js` | 385 / 385 |

- [x] **The new tests failed first.** On `23458b98`, LE29, RC6 and RC16 failed for the reasons they name, while LE30 passed as a pin (the test plan's Verification).
- [ ] **Not re-checked live.** No scratch stack was booted for this round. The fix adds one string comparison to two statements, and the rest is a message, a key helper the suites cover, and docs.

### Each ask, checked from the tree

Every ask was checked from commands and the tree, not from memory, including the wording round 1 suggested:

| Round 1 | The fix | How it was checked |
|---|---|---|
| 1 (blocking) | L3 and L4 add `AND e.tapestryKey <> '{}'` (`list-elements.js:139`, `:150`) | LE29 failed before and passes after; paging over legacy, one element a page, reaches a null cursor |
| 2 | The catalog's Conventions, `docs/GRAPH_OPERATIONS_CATALOG.md:15`, `:16`, `:20`, `:22` | read against `changes.js`'s cursor and C2–C3 |
| 3 | The shared refusal (`reads.js:63`) says a cursor works only with the inputs that made it | RC6's new check; no "the same concept or set" is left in `reads.js` |
| 4 | `hexKey()` (`reads.js:112`) reads the owner's key (`:120`) and the assistant's (`:126`) | RC16 failed before and passes after |
| 5 | LE30: an author scored exactly 0.05, against `> $cutoff` (`reads.js:149`) | it passes; `>=` would fail it |
| 6 | ADR Amendment 3, item 4 (`:367`) | read against `run`'s order: `resolvePov` at `list-elements.js:95`, the cursor at `:97`, the node at `:101` |
| 7 | The ledger row is DONE with its Done line; `_intake.md:683` gains the line | harness-lint (L15) clean |

**Scope.** Round 2 changed eleven files, all of them the asks above, their tests and the records they name.

### Findings

**Blocking:** none.

**Non-blocking:** none new. Round 1's findings 8–13 stand as records. Finding 9 is for `graph walk`'s ADR (A10.14).

### Verdict

Finding 1 is fixed and tested, every ask landed, the suites pass, and the full gate is green. The story is `Done` in this commit.

**PASS**
