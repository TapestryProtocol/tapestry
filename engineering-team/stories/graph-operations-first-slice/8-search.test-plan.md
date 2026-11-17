# Test Plan: Story 8 — `graph search`, concepts and elements found by the words in their names and fields, best first, each match with the field it matched in and a passage

**Story:** `engineering-team/stories/graph-operations-first-slice/8-search.md`
**ADR:** `engineering-team/decisions/graph-operations-first-slice/0008-search.md`
**Date:** 2026-11-17

## Coverage map

Every suite is stack-free and lives under `test/operations/`, where `test/operations.test.js` finds and runs it (ADR graph-operations-foundation/0001, Decision 12). None needs a line in `test/registry.js`, and each also runs on its own: `node <file>`.

The requests go through the operations harness (`test/helpers/operationsHarness.js`): the real router, the real central auth middleware and the real command. The graph is a fake (`test/helpers/graphFake.js`), seeded by `test/helpers/searchGraph.js`, which is new in this story. Its full-text index is `test/helpers/fulltextFake.js`, also new: Unicode's words, as the standard analyzer splits them, and a score that is the same each time for the same graph. Where a test says one match scores higher than another, that is the fake's score; on a live stack it is Lucene's.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — Words find concepts and elements | **SR1** a word in a rule's statement finds that rule, with `rule.statement`; a word in a concept's description finds the concept, with its description tag before its JSON · **SR2** whole words only, whatever the case: `og` finds nothing though "dog" is in a statement, `DOG` finds it, `hardcod` finds nothing · **SR3** a field's name is no text: `statement` finds only the rule whose statement says the word (counted as one match), and `strength` and `wordTypes` find nothing, though every rule's JSON names them · **SR4** tag nodes and change entries are never answered, and a word only in a d tag finds nothing · **SR5** no match: an empty list, nothing counted, complete, no cursor · **SR6** stop words left out unless `q` has only them; lowercased, each once; `q` back trimmed; Lucene's syntax in `q` (`+ - ( ) [ ] * ~ " \`) is never syntax and never a word · **SR7** `relays` and `relay` each find both rules; `decide` doesn't find "decided" · **SR8** the word section's boilerplate is no text: `header` and `concept` find nothing | `graph/search.test.js` | integration (route over the fake graph) |
| AC2 — Each match, with where it matched | **SR9** the answer's eleven keys and a match's ten (C3's five facts, `kind`, `concepts`, `field`, `passage`, `words`), and nothing more. The kinds: `concept`, `superset`, `set` (with an address), `node` (a Set with no address among them). A match's concepts by name, through its sets; an element of two concepts names both; a header names none here. `author` and `own` as C3 answers them · **SR10** `field`: `name`, `description`, `rule.statement`, `conceptHeader.description`, `document.description`, `document.headings` (the passage is the one heading that matched); of texts holding as many words, the first in Decision 3's order; `words` in `q`'s order · **SR11** a passage is at most 200 characters, holds a word, starts before it, and is cut from its text with `…` at each cut end, so a 459-character description is never answered whole · **SR12** no match has a path, a depth or a start: search packages no walk (Decision 8) · **SX1** through the external CLI | `graph/search.test.js`, `graph/search-agent-through-cli.test.js` | integration; the real external CLI against a loopback instance |
| AC3 — Best first, a page at a time | **SR13** `tierBoth` holds both words and comes first although `tierAlpha4` scores higher; then the higher score; `tieA` and `tieB` score the same and come by tapestryKey · **SR14** pages of 3, 3 and 1 hold the whole list once each, in its order, with the whole count on every page and a null cursor on the last · **SR15** a limit of 0 or 201 is refused, naming `limit` · **SR16** a cursor is refused `invalid-cursor` for other words, another kind, concept or point of view, another read, or text that isn't one; the same words in another case and with spaces take it · **SR17** a match added between two pages, ranking after the last one read, leaves every other answered once, the new one last · **SR29** pages of 50 by default and 200 at most · **SX2** through the external CLI | `graph/search.test.js`, `graph/search-agent-through-cli.test.js` | integration; the real external CLI |
| AC4 — Narrowed by kind, or to one concept's elements | **SR18** `kind=concept` only headers, `kind=set` only supersets and sets with an address (not the card set); `kind=node` is refused, naming `kind` · **SR19** `concept` keeps the concept's elements, through its sets; an element of two concepts is under each; with `kind=set` too, nothing; the answer gives back `concept` and `kind` (null when not given) · **SR20** a `concept` that isn't a key is `invalid-input`; one naming no node, or a change entry, is `unknown-node` (404); a superset (the message says so) or an element is `not-a-concept` (409); each naming `concept` · **SX2** the agent resolves `rule` to its key, then searches within it | `graph/search.test.js`, `graph/search-agent-through-cli.test.js` | integration; the real external CLI |
| AC5 — From a point of view, the owner's by default | **SR21** the owner's keeps the assistant's, the owner's, the author-less and hi's (0.2), and leaves out lo's (0.01), the one with no influence and the one with no NostrUser: kept 4, left out 3, the same on a page of one; `owner` is the default · **SR22** `everyone` keeps all seven; the owner's pubkey is the owner's view; a stranger's pubkey is `unknown-pov`, naming the two it reads from; `house` is `invalid-input` · **SR23** lo scored 0.3 between two runs is kept in the second, and both runs only read · **SR24** no scores yet: only the instance's own count, `scored: false` | `graph/search.test.js` | integration |
| AC6 — What it refuses | **SR25** no `q` is `missing-input`; spaces only, and punctuation only (saying it holds no word), are `bad-query`; a control character, a text-direction control and an invisible character are `bad-query`, naming the character by its code point; 301 characters are `invalid-input`; 300 answer · **SR26** an input it doesn't take is `unknown-input` · **SR27** an index still filling (45%) or missing answers 409 `search-not-ready`, saying which, how far it has filled and the index's name (409, not the ADR's first 503, since a refusal's status is a 4xx: ADR 0008 Amendment 1, with the owner's approval) · SR15, SR16, SR18, SR20, SR22 above | `graph/search.test.js` | integration |
| AC7 — A read, behind sign-in, that agents can use at the size of Avi's brain | **SR28** a node whose JSON is offloaded is found by its name, and every answer counts such nodes (`offloaded`) · **SR29** the bound: 5,001 matches answer `complete: false`, the 5,000 best counted; 5,000 answer `complete: true` · **SR30** 401 and 403; an admin gets what the owner gets · **SR31** reads only: no write transaction, the same nodes and relationships, no change entry · **SR32** the command answers what the route answers, a refusal included (exit 1) · **SR33** listed for an admin, a GET read for the owner and admins, with its six inputs and its refusals; `/docs` has GET with the six query parameters, `q` required · **SR34** the catalog's §1 row and Paging bullet and `reads.js`'s C1 paragraph say how search answers and pages (Decision 9) · **XI1–XI7** the index made at control-panel start: made once as Decision 1 defines it, logged in one line; nothing written when it is there; `name-taken` for another definition under the name (other properties, analyzer or label); `equivalent-exists` for the same schema under another name; start-up errors waited out, other errors stopping it at once, gone past its window; it never throws or rejects; its writes change no data; `bin/control-panel.js` calls it · **SX1–SX2** an admin agent with its own key, through the external CLI, unchanged · *on a real Neo4j: the live check (below)* | `graph/search.test.js`, `search-index.test.js`, `graph/search-agent-through-cli.test.js` | integration; unit; the real external CLI; live |

## The readings these tests take

The ADR leaves these open, or states them loosely. The tests settle them:

1. **Exact shapes.** The answer is exactly `{ q, words, kind, concept, pov, kept, leftOut, complete, offloaded, matches, cursor }`, and a match exactly `{ tapestryKey, name, address, author, own, kind, concepts, field, passage, words }` (SR9). `kind` and `concept` are null when not given (SR19).
2. **A list's field has no index in its name.** A match in a heading is `document.headings`, and its passage is that one heading (SR10). A text short enough is its own passage, whole (SR10, SX1).
3. **The `…` counts toward the 200.** A cut passage, `…` included, is at most 200 characters, and what lies between its marks is a run of the text it names (SR11).
4. **The cursor names its read and its words.** Its read is `graph search`, and its scope is built from the words searched for, not `q` as typed. So `  EpsilonWord ` takes the cursor `epsilonword` gave (SR16).
5. **`offloaded` counts the instance,** not the matches: every answer gives it (SR28).
6. **What a refusal says.** `bad-query` names the character by its code point, as `textProblem` does (`U+0007`), and says when `q` holds no word. `search-not-ready` names `graph_search_text`, says whether it is missing or filling, and gives the percentage (SR25, SR27).
7. **A field's name is never a match, and never counted.** `statement` counts one match, not the 25 nodes the index finds by the key (SR3).
8. **The bound counts nodes read.** With 5,001 nodes holding the word, the counts are exactly 5,000 (SR29).
9. **The boot hook logs once for each outcome other than `present`,** and nothing for `present` (XI1–XI4). Its three properties may come in any order (XI2).

## The fakes this story adds

Nothing a fake did before changes. `test/operations/graph-fake.test.js` gains F27–F30, which pass, and its F1–F26 still pass.

- **`test/helpers/fulltextFake.js` (new).** A state's `fulltextIndexes` are its full-text indexes, as SHOW FULLTEXT INDEXES answers them. With none, the graph has none.
  - `queryNodes(state, name, query)` reads the subset of Lucene's syntax search writes: quoted phrases joined by OR and grouped by ( ), with `\"` and `\\` escaped. It throws, by name, at anything else, and throws as Neo4j does at a name no index has.
  - `showFulltextIndexes` answers `SHOW FULLTEXT INDEXES [YIELD …] [WHERE col = 'x' | $p] [RETURN …]`.
- **`test/helpers/pathCypherFake.js`:**
  - a first clause `CALL db.index.fulltext.queryNodes(…) YIELD node [AS v], score [AS s]`, and no other procedure;
  - `sum()`;
  - `EXISTS { MATCH … [WHERE …] }`;
  - two speedups that change no answer (F30): a path whose first node is unbound and last bound is matched from its last node back, and a node pattern with one label and a property map is found through an index of both.

  So S1's join of thousands of rows to their tags and authors runs in moments.
- **`test/helpers/graphFake.js`:** `SHOW FULLTEXT INDEXES` goes to the fake index's list, and a statement opening with `CALL` goes to the path reader.

Search's own statements stay within what these run (ADR 0008, Decision 4): S0's SHOW, S1's CALL, OPTIONAL MATCH, CASE, `sum`, EXISTS, the trust fragment, ORDER BY and LIMIT, S2's class-thread read and S3's count.

## Edge cases

- [x] An empty search, and one of punctuation only (SR25).
- [x] Lucene's syntax and quotes in `q` (SR6).
- [x] Control, text-direction and invisible characters (SR25).
- [x] A word that is only a JSON key, or only the word section's boilerplate (SR3, SR8).
- [x] A word only in a tag search doesn't read (SR4).
- [x] Tag nodes and change entries (SR4, SR20).
- [x] A Set with no address (SR9, SR18).
- [x] An element of two concepts, and one under a set (SR9, SR19).
- [x] Equal scores (SR13).
- [x] A change between two pages (SR17).
- [x] The bound's edge, 5,000 and 5,001 (SR29).
- [x] An offloaded JSON (SR28).
- [x] The index missing or still filling (SR27).
- [x] The owner's scores missing (SR24).
- [x] Another index holding the name, or the schema under another name (XI3, XI4).

## Test infrastructure

- **Framework:** the Node runner every suite under `test/operations/` uses (`graphOpsSuite.makeSuite`).
- **On this Mac:** never the full `npm test`. The local tapestry container is the live agent-memory instance, and the full suite writes to it. Run the suites one by one, or through the scoped gate with every endpoint at a dead port (How to run).
- **Concept Graph API:** not used. Every suite is stack-free.
- **Firmware:** none needed. The seeds make their own concepts.
- **Fixtures:**
  - `test/helpers/searchGraph.js`: `seedSearch({ owner, ta, unscored, index })` and `seedSearchBound({ n })`, whose header lists every node and text;
  - `test/helpers/fulltextFake.js`.

**The live check** (ADR 0008, Implementation notes; scratch stack only) covers what no fake can:
- Lucene's real analyzer and scores against the JavaScript check;
- the boot hook against a real Neo4j: the index made on a fresh boot, and again after it is dropped and the control panel restarts, with the counts of nodes, relationships and properties unchanged;
- the time of a search at Avi's size, under a second;
- a real LMDB offload.

## How to run

Each suite alone, with every endpoint dead:

```bash
export NEO4J_URI=bolt://127.0.0.1:9 REDIS_PORT=9 BRAINSTORM_BASE_URL=http://127.0.0.1:9 TAPESTRY_BASE=http://127.0.0.1:9 MEILI_URL_HOST=http://127.0.0.1:9
```

```bash
node test/operations/graph/search.test.js
```

```bash
node test/operations/search-index.test.js
```

```bash
node test/operations/graph/search-agent-through-cli.test.js
```

```bash
node test/operations/graph-fake.test.js
```

Every suite under `test/operations/` through the scoped gate, with the same endpoints dead, and its record read after:

```bash
node -e "const files = require('child_process').execSync('find test/operations -name \"*.test.js\"', { encoding: 'utf8' }).trim().split('\n').sort().map((f) => require('path').relative('test', f)); require('./test/helpers/gateRunner').runGate({ suites: files.map((file) => ({ file })), label: 'a10-8' })"
```

```bash
npm run gate:status -- --label a10-8
```

## Verification

The new tests fail with the current code. Confirmed on 2026-11-17, on branch `A10.8-search` at `090c848e` (staging, with ADR PR #119 merged), with the test changes in place and nothing else changed:

```
=== operations: graph search ===
  FAIL  SR1: a word in an element's field finds it, with that field; a word in a concept's description finds the concept
        src/operations/catalog/graph/search.js does not exist yet (ADR graph-operations-first-slice/0008, Implementation notes)
  …  (SR2–SR34 the same)
operations: graph search: 0 passed, 34 failed, 0 skipped

=== operations: graph search's full-text index ===
  FAIL  XI1: with no index it makes graph_search_text once, as Decision 1 defines it, and says so in one log line
        src/lib/graph-search-index.js does not exist yet (ADR graph-operations-first-slice/0008, Decision 1 and Implementation notes)
  …  (XI2–XI7 the same)
operations: graph search's full-text index: 0 passed, 7 failed, 0 skipped

=== operations: an admin agent searches the graph through the external CLI ===
  FAIL  SX1: …  src/operations/catalog/graph/search.js does not exist yet (ADR graph-operations-first-slice/0008, Implementation notes)
  FAIL  SX2: …  (the same)
operations: an admin agent searches the graph through the external CLI: 0 passed, 2 failed, 0 skipped

=== operations: the fake graph ===
  …  F1–F26 pass, as before; F27–F30 pass
operations: the fake graph: 31 passed, 0 failed, 0 skipped
```

Every other suite under `test/operations/` passes with the fakes' changes in place, update-node's new suites from #120 among them. The scoped gate, label `a10-8-test-design`, ran 60 of 60 suites with every endpoint dead. Its result: 719 passed, 43 failed and 4 skipped. The 43 failures are the new tests above, and the 4 skips are the shared-keys check's, as before:

```
20261117T052708Z-10878-da06 [a10-8-test-design] started 2026-11-17T05:27:08.252Z on 090c848e+dirty — FAIL, exit 1, 719 passed, 43 failed, 4 skipped, 60/60 suites; failed: search-agent-through-cli, search, search-index
```
