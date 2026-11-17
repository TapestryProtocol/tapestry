# ADR 0008: `graph search` — one full-text index over every node's names and its letter's texts, made when the control panel starts; each match checked against the values of its fields, best first, within a bound

**Status:** Accepted
**Date:** 2026-11-16
**Story:** `engineering-team/stories/graph-operations-first-slice/8-search.md`
**Loom:** A10.8 — https://loom.brainstorm.world/t/A10.8

## Context

The story (Loom A10.8) asks for one graph read. Its criteria, in short:

- **AC1:** words find concepts and elements. Each word matches only as a whole word, ignoring case, in a node's name and the values of its fields. The owner sets nothing up first. Tag nodes and change entries are never answered.
- **AC2:** each match gives the five facts, its kind, its concepts, the field its words were in and a passage of at most 200 characters. A node that a walk reached comes with its path instead of a passage.
- **AC3:** best first: every word before some, then how well it matches, then tapestryKey. Pages use `limit` and a cursor.
- **AC4:** `kind` (`concept` or `set`) and `concept` (a concept's elements, through its class thread).
- **AC5:** the owner's point of view by default, tested at read time. The counts cover the whole list.
- **AC6:** what search refuses.
- **AC7:** a read behind sign-in, listed for agents, in `/docs` and in the internal CLI. An agent uses it through the external CLI at the size of Avi's brain, and each search answers in under a second.
  - Anything new in Neo4j is made when an instance upgrades or first starts.
  - Nothing in the graph is removed or rewritten to make it.

How search finds its matches is this ADR's main decision, and the owner's to make at its gate (the story's For Architecture).

Nine facts shape the design.

1. **Where a node's text lives.**
   - A node's name is a property of the node: `name`, and `tapestryValue` once the new writes set it (D11).
   - Everything else is in the tag nodes of its letter. Its `json` tag holds the word wrapper: a `word` section, plus one section for each concept the node belongs to, holding that concept's fields. Most imported nodes also have `name` and `description` tags.
   - Tag nodes are TapestryNodes too, labelled `NostrEventTag`, each with a key.
   - A `json` tag's value can be an LMDB reference, `lmdb:<tapestryKey>`, in place of the JSON. The owner's offload routes write these (`POST /api/tapestry-key/…`, `src/api/tapestry-key/index.js:240–270`), and `src/lib/tapestry-resolve.js` resolves them. None on the local instance are offloaded.
2. **Neo4j has full-text indexes, and the graph has none.** Neo4j 5.26.10 Community ships Lucene 9.11's full-text indexes. Measured on a scratch stack:
   - Neo4j keeps one full-text index per label and property list. `CREATE FULLTEXT INDEX … IF NOT EXISTS` silently makes nothing when an index of the same schema exists under another name.
   - Querying an index that doesn't exist fails with `Neo.ClientError.Procedure.ProcedureCallFailed`.
   - A query made the moment an index was created raised no error. So a query can't be relied on to say that an index is still filling.
3. **Indexes reach every instance when the control panel starts.**
   - `src/lib/tapestry-node-index.js` makes `tapestry_node_uuid` and the change entries' two indexes, called from `bin/control-panel.js:362–376`.
   - The calls aren't awaited, are retried through the graph's start-up errors, never reject and never drop anything. They never make an index whose name another definition already holds.
   - That runs alike on an existing instance after a deploy and on a fresh one at its first start. `setup/neo4jConstraintsAndIndexes.sh` holds none of these indexes.
4. **The words the index sees.**
   - The standard analyzer (`standard-no-stop-words`, Neo4j's default) splits text by Unicode's word rules (UAX #29) and lowercases it.
   - JavaScript's `Intl.Segmenter`, at word granularity, follows the same rules. A probe on the scratch stack found the two agreeing on every case tried:
     - `A10.8` is one word;
     - `d-tag`, `kind:39999` and `NIP-51` are two words each;
     - `wss://relay.damus.io` is `wss` and `relay.damus.io`;
     - `graph_change_at` and `tapestryKey` are one word each.
   - So `og` never matches "dog", and `relay` doesn't match `relay.damus.io`.
   - The `english` analyzer adds Porter stemming, possessives and stop words, which JavaScript has no built-in equal of.
5. **The index reads JSON keys too.** It indexes a `json` tag's whole text, so a field's name is a word in it. At Avi's size, the word `statement` hits 3,579 nodes. That is every rule, since a rule's field is named `statement`, and only 21 of them hold the word in a value. A check against the values keeps AC1 true.
6. **What each way of searching costs, measured.**
   - **The setup.** A scratch stack (1 GB heap, 512 MB page cache) was seeded by raw Cypher with a brain of Avi's shape, made from this repo's own markdown: documents with a title, a description and headings; rules with a statement and a strength; decision records with a status and a date; each with its source fields.
     - At his size: 946 documents, 3,576 rules and 300 decision records. That is 4,822 elements and 22,532 nodes, with 5.3 million characters of tag values.
     - At about four and a half times that: 21,597 elements and 89,644 nodes.
     - Medians of three to five runs, in milliseconds. The index's figures are the chosen design's whole read, with stop words dropped (Decision 2). The scan's figures keep stop words.

   | Search | Scan, Avi's size | Index, Avi's size | Scan, 4.5× | Index, 4.5× |
   |---|---|---|---|---|
   | `hardcode TA pubkey` | 374 | 43 | 1,559 | 133 |
   | `d-tag unique` | 375 | 75 | 1,545 | 252 |
   | `is it decided and still in force` | — | 23 | — | 89 |
   | `firmware reinstall`, `concept` = rule | 23 | 14 | — | 32 |
   | `must` | 219 | 220 | 570 | 373, stopped at the bound |
   | `rule` | 277 | 290 | 1,305 | 559, stopped at the bound |
   | `statement` (a field's name) | — | 245 | — | 398, stopped at the bound |

   - **The scan's cost** follows the graph's whole text, not the matches. A short word is a substring of nearly every node (`ta` is in "tapestry" and "statement"), so the scan reads up to 16 MB at 4.5×.
   - **The index's cost:**
     - Made over existing data, an index over the tags' values came online in 0.5 s at Avi's size, and the chosen index (Decision 1) in 1.5 s at 4.5×.
     - With two such indexes live, writing 16,775 more elements took 4.9 s.
     - Three such indexes took 11 MB on disk at 4.5×.
   - **The two-step:**
     - Matching the 55 concept headers by their names and descriptions took 3 to 30 ms. Words such as "the", "about" and "list" in their descriptions made `rules about the trusted list` match 42 of the 55.
     - Reading and ranking the rule concept's elements took 251 ms.
     - A search whose words name no concept found nothing.
7. **Walk is built for search to call** (ADR graph-operations-first-slice/0014, Decision 3).
   - Its engine merged into staging with TapestryProtocol/tapestry#115 (2026-11-17).
   - Its bound counts the rows it reads toward nodes it hasn't met yet, not every relationship it expands. No dense cluster was timed (memo 122 on A10.8).
8. **The pieces already built that search uses:**
   - the read conventions C1–C6 (`src/operations/reads.js`);
   - the declaration layer's own refusals (`src/operations/declaration.js:46–54`): `unknown-input`, `missing-input`, `invalid-input`, `sign-in-required` and `not-allowed`;
   - the text check every name input shares (`textProblem`, `src/lib/conceptNames.js:125`);
   - resolve's rule for a node's kind (`candidateOf`, `src/operations/resolve.js:251–257`);
   - the read of the concepts that reach a node (`conceptsOfNodes`, `src/operations/catalog/graph/_fields.js:386`);
   - a `json` tag read, its LMDB references resolved (`readJson`, `_fields.js:100`).
9. **Principles.** These run alongside principle 3's preference for scanning at read time.
   - A text index isn't a point of view's answer. It is the same for every point of view, and Neo4j keeps it in step with every write by any route. So it is the measured exception that principle 3 allows.
   - The point of view still filters at read time, inside the read's own query (principles 1–3).
   - An index changes no node, relationship or property (principle 4, BIBLE §30). Losing it loses nothing that the next control-panel start doesn't make again.

## Options considered

### Option A — A full-text index over every node's names and its letter's texts, each match checked against its fields' values (chosen)

- **The index.** One index, `graph_search_text`, on TapestryNode over `name`, `tapestryValue` and `value`. Because tag nodes are TapestryNodes, it covers node names and tag values alike. The control panel makes it at start, as it makes the change entries' indexes.
- **The read.** Search asks it for any of `q`'s words and maps each hit on a tag to the tag's node. It applies `kind`, `concept` and the point of view in the same statement, and reads the best 5,000 nodes by Lucene's score.
- **The check.** JavaScript checks each node read against its name and the values of its fields, which drops the nodes that hold a word only as a JSON key. It cuts the passage and orders the matches.
- **Pros:**
  - fast at both sizes measured, and fastest where search is used most: a question's words, at 23–252 ms;
  - Lucene's ranking (BM25);
  - Neo4j keeps the index current on every write by any route, the import and today's routes included;
  - nothing for the owner to set up, and no node rewritten.
- **Cons:**
  - every hit is checked in JavaScript;
  - a word that names a field reads many nodes for few matches;
  - the bound makes a very broad search stop short on a big graph (4.5×);
  - offloaded JSON is found by its name only;
  - a new index on every instance.

### Option B — A search text that the writes keep on each node, under a full-text index

- **Sketch.** A neo4j-only property, of the firmware's set "for metadata such as search strings", holds a node's name and its fields' values, with no keys. A full-text index covers it.
- **Pros:**
  - the text is exact, so Lucene's counts and ranks need no check and no bound;
  - offloaded JSON stays searchable.
- **Cons:**
  - every write must keep the property up to date. The new operations could, but the import and today's routes don't, and D15 leaves the old tools as they are. So it goes stale until a catch-up job runs.
  - it is one more stored copy of what each node's JSON says, a copy that can drift;
  - it needs the most code: a hook in every write path, the catch-up job and the index.

### Option C — No index: scan every node's text at read time

- **Sketch.** A substring filter in Cypher, then whole words, ranking and passages in JavaScript.
- **Pros:**
  - exact and complete;
  - nothing new in Neo4j;
  - principle 3's default.
- **Cons:** its cost follows the graph's whole text. That was under 0.4 s at Avi's size, but 1.6 s and up to 16 MB read at 4.5×, past AC7's second, and Avi's brain has already grown past the frame's snapshot (his second comment).

### Option D — The owner's two-step: concept headers by keyword, then a walk

- **Sketch.**
  - First, match each concept header's names and description against `q`.
  - Second, walk out from the headers that match, with walk's engine: `IS_THE_CONCEPT_FOR`, `IS_A_SUPERSET_OF` and `HAS_ELEMENT`, outward, up to 6 steps.
  - Answer the elements reached that hold the other words, each with its path.
- **Pros:**
  - the first step is cheap (55 headers);
  - a question that names a concept reaches its elements.
- **Cons:**
  - it can't stand alone. It finds no element whose concept the words don't name, and round 3's hits came from rule statements and headings (AC1).
  - stop words in the headers' descriptions match most of them (42 of 55);
  - its second step is Option C narrowed to one concept;
  - walk's bound stops it short on a concept with more than 10,000 elements;
  - it adds walk's engine, and walk's bound, to every search whose words name a concept.

### The mixes

- **A with D packaged in it** (a matched concept leads to its elements and its near concepts) adds paths and a second ranking, and gains little:
  - `concept` does the useful half explicitly ("rules only", or a concept an agent found first);
  - no relationship type joins related concepts yet, so the "closely related, but not identical, concepts" walk has nothing to follow.
- **A with C as its fallback** (a scan when the index is missing or still being made) doubles the code for a window of seconds after a deploy.

## Decision

We chose **Option A**. Its `concept` input is the useful half of the owner's two-step, and no walk is packaged yet. It is the only option that:

- meets AC7's second at both sizes measured;
- keeps AC1 exact with no copy of the text to maintain;
- and needs nothing from the owner.

Its costs are a new index on every instance, a check of every hit, and a bound that a very broad search on a big graph reaches. That bound is walk's trade too (ADR 0014).

### 1. The index, `src/lib/graph-search-index.js`

```cypher
CREATE FULLTEXT INDEX graph_search_text IF NOT EXISTS
FOR (n:TapestryNode) ON EACH [n.name, n.tapestryValue, n.value]
OPTIONS { indexConfig: { `fulltext.analyzer`: 'standard-no-stop-words', `fulltext.eventually_consistent`: false } }
```

- **Whose:** it covers every TapestryNode's name and every tag's value, since a tag node is a TapestryNode with its text in `value`. Search filters out the tags it doesn't read (Decision 4).
- **Consistent:** with `eventually_consistent` false, a write's own transaction updates the index, so a search right after a write sees it.
- **Made at control-panel start**, by `ensureSearchIndexOnBoot({ runWrite, runRead, log, sleep, windowMs })`, called beside `ensureChangeIndexesOnBoot` in `bin/control-panel.js`.
  - It is not awaited and never rejects, and it retries the graph's start-up errors as `tapestry-node-index.js` does.
  - It reads `SHOW FULLTEXT INDEXES` first. The answer is:
    - `present` when `graph_search_text` is there with this label, these three properties and this analyzer;
    - `name-taken` when the name is held by another definition, in which case it makes nothing and logs one line;
    - `equivalent-exists` when an index under another name covers the same label and properties, in which case it makes nothing and logs that index's name, since Neo4j would make nothing;
    - `created` otherwise.
- **Where it applies:** it runs alike on an existing instance after a deploy and on a fresh one at its first start (AC7). The index changes no node, relationship or property, and it fills in the background: in under 2 s on both brains measured (fact 6).

### 2. The words

`words(q)` gives the words search looks for:

- **Splitting.** It splits `q` into Unicode word segments (`Intl.Segmenter`, word granularity, `isWordLike`), lowercases them and drops repeats. These are the words the index's analyzer makes (fact 4). Both sides split on the same rules, so a word in `q` matches only a whole word in the text, ignoring case.
- **Stop words.** The 33 English stop words of Lucene's English analyzer (a, an, and, are, as, at, be, but, by, for, if, in, into, is, it, no, not, of, on, or, such, that, the, their, then, there, these, they, this, to, was, will, with) are left out when `q` has any other word, and searched when it has only those.
  - That keeps "is it decided and still in force" to `decided`, `still` and `force`. At Avi's size that gave 220 matches, 201 of them kept from the owner's point of view, in 23 ms.
  - So "every word" in AC3 means every word searched for.
- **Plurals.** A word of three letters or more, letters only, also matches its plain English plural or singular. A word that doesn't end in `s` adds `s` and `es`; one ending in `s` (not `ss`) drops it; one ending in `es` drops that too. So `rule` finds "rules", and `relays` finds "relay". No other form of a word matches: `decided` doesn't find "decide".
- **The Lucene query.** It is the words, each with its forms, each form in double quotes with `"` and `\` escaped, joined by `OR`. Quoting makes every form a phrase, so `kind:39999` and `a*b` reach Lucene as words, never as syntax. Tried on the scratch stack: `kind:39999`, `(x)`, `+must`, `-never`, `[0 TO 9]`, `foo~2` and `x"y` all ran without error.

### 3. A node's text, and the check

`textsOf(row)` gives what AC1 calls a node's text:

- its name;
- its `description` tag;
- the strings in its JSON. That is the value of each field of each section, each string in a list, and each string one level down in an object, with the `word` section left out except its `description`. The left-out `slug`, `name`, `title` and `wordTypes` repeat on every core node (fact 5's "concept header for the concept of dogs").

Each text has a field name:

- `name` or `description`;
- or `<section>.<field>`, such as `rule.statement`, `document.headings` (its passage from the one heading that matched), or `conceptHeader.oNames.plural`.

The JSON is read with `_fields.js`'s `readJson`, which resolves an LMDB reference.

A row is a match when one of its texts holds a word, or one of the word's forms. The check doesn't read JSON keys, so a node the index found only through a field's name is dropped.

### 4. The statements

Every statement goes through `graph.read`, and none writes.

- **S0, the index's state:**

  ```cypher
  SHOW FULLTEXT INDEXES YIELD name, state, populationPercent WHERE name = 'graph_search_text'
  RETURN state, populationPercent
  ```

  No row, or a state other than `ONLINE`, refuses `search-not-ready` (Decision 7). Without this read, a search made while the index fills would answer too little and not say so (fact 2).
- **S1, the nodes read.** The relationship types are the class thread's, from `relAlias` as `list-elements` takes them. `<kind>` and `<concept>` are fixed texts chosen by the input, and nothing else from input enters the text.

  ```cypher
  CALL db.index.fulltext.queryNodes('graph_search_text', $lucene) YIELD node AS x, score
  OPTIONAL MATCH (p:TapestryNode)-[:HAS_TAG]->(x)
    WHERE x:NostrEventTag AND x.type IN ['json', 'name', 'description']
  WITH CASE WHEN x:NostrEventTag THEN p ELSE x END AS n, score
  WHERE n IS NOT NULL AND NOT n:NostrEventTag AND NOT n:GraphChange
    AND n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' <kind> <concept>
  WITH n, sum(score) AS score
  <trust('n', ['score'])>
  WITH n, score, counts ORDER BY score DESC, n.tapestryKey LIMIT <BOUND + 1>
  OPTIONAL MATCH (n)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
  OPTIONAL MATCH (n)-[:HAS_TAG]->(d:NostrEventTag {type: 'description'})
  RETURN <nodeColumns(n)>, n:ConceptHeader OR n:ListHeader AS isHeader, n:Superset AS isSuperset, n:Set AS isSet,
         head(collect(j.value)) AS json, head(collect(d.value)) AS description, score, counts
  ```

  - **`<kind>`:** `AND (n:ConceptHeader OR n:ListHeader)` for `concept`, and `AND (n:Superset OR n:Set) AND n.uuid IS NOT NULL` for `set` (the reading ADR 0011's Amendment 2 adopts).
  - **`<concept>`:** `AND EXISTS { MATCH (:TapestryNode {tapestryKey: $concept})-[:INIT]->(:Superset)-[:PROP*0..]->()-[:TERM]->(n) }`, which is `list-elements`' walk.
  - **The score.** A node's score is the sum of Lucene's scores over its texts, so a word in its name and in a field counts twice.
  - **The limit.** It is the bound plus one, a checked whole number written into the text (C1).
- **S2, the page's concepts.** The headers whose class threads reach each node on the page, read as `conceptsOfNodes` reads them, with each header's name:

  ```cypher
  MATCH (e:TapestryNode) WHERE e.tapestryKey IN $keys AND NOT e:GraphChange
  MATCH (e)<-[:TERM]-()<-[:PROP*0..]-(:Superset)<-[:INIT]-(h)
  WHERE h:ConceptHeader OR h:ListHeader
  RETURN DISTINCT e.tapestryKey AS key, h.tapestryKey AS concept, coalesce(h.tapestryValue, h.name) AS name
  ```

  A match's concepts are facts about it, answered whatever their authors: the point of view judges the match.
- **S3, the offloaded JSON:**

  ```cypher
  MATCH (t:NostrEventTag {type: 'json'}) WHERE t.value STARTS WITH 'lmdb:' RETURN count(t) AS n
  ```

A `concept` that names no node refuses `unknown-node`, and one that names a node that isn't a concept header refuses `not-a-concept`. Both are found by `list-elements`' own read of the node, before S1.

### 5. Order, the bound and paging

- **The list.** The matches among the nodes S1 read.
- **The order** (AC3):
  - a match that holds every word comes first;
  - then the higher score;
  - then the lower tapestryKey.

  The same graph gives the same order every time, since Lucene's scores are the same for the same index.
- **The bound, `BOUND` = 5,000 nodes read.** When S1 returns more, search keeps the 5,000 best by score and answers `complete: false`. The counts and the pages then cover those 5,000.
  - Measured: at Avi's size, no search tried reached it, `the` and `rule` included.
  - At 4.5×, single broad words and fields' names reached it, and still answered in under 0.65 s.
  - Every match on a page that a bounded search answers is exact (Decision 3). What it can miss is a match beyond the 5,000 best hits. Matches whose words are in their values outscore the nodes that hold them only as keys: at 4.5×, `statement` found the same 76 matches with a bound of 2,000 as with 5,000.
- **Paging** (C1): `limit` from 1 to 200, 50 by default.
  - The cursor's position is `[every, score, tapestryKey]`, where `every` is 1 or 0.
  - Its scope is `scopeOf([words, kind, concept, pov.name])`, so a cursor made for other words is refused.
  - Each page reads S1 again: search stores nothing.
- **The exception to C1.** A change between two pages can change scores, and so move a match to a page already read, or show it twice. Every match whose place doesn't change is answered exactly once (Amendment 5 to ADR 0011, Decision 9).

### 6. The answer (AC2, AC5)

```js
{
  q: 'is it decided and still in force',  // as given, trimmed
  words: ['decided', 'still', 'force'],   // the words searched for (Decision 2)
  kind: null, concept: null,
  pov: { name, observer, cutoff, scored }, // C2
  kept: 201, leftOut: 19,                  // the matches the point of view kept and left out, across the list
  complete: true,                          // false when the bound cut the list
  offloaded: 0,                            // nodes whose JSON is in the LMDB store, searched by name and description only
  matches: [{
    tapestryKey, name, address, author, own,  // C3
    kind: 'node',                             // concept, superset, set or node, as graph resolve answers one
    concepts: [{ tapestryKey, name }],        // the concepts it is an element of, by name then tapestryKey
    field: 'rule.statement',                  // where its words were found: name, description or <section>.<field>
    passage: '…is it still in force, and does a newer record supersede it…',  // at most 200 characters
    words: ['decided', 'force'],              // the words it holds, in q's order
  }, …],
  cursor: '…',
}
```

- **The passage** comes from the text holding the most distinct words, the first in the order of Decision 3 on a tie. It starts 60 characters before the first of the words and runs to at most 200 characters, with `…` at a cut end, counted in the 200.
- **The kind** is resolve's rule. `resolve.js` exports it as `kindOf(row)`, and `candidateOf` calls it, unchanged.
- **The walk.** No node is answered because a walk reached it (Decision 8), so AC2's last part has nothing to answer in this version.

### 7. What search refuses (AC6)

| Refusal | Status | When |
|---|---|---|
| `missing-input` | 400 | no `q` (the declaration layer's) |
| `invalid-input` | 400 | a `q` over 300 characters; a `kind` other than `concept` or `set`; a `concept` not shaped like a tapestryKey; a `limit` out of range (the declaration layer's, from the schemas) |
| `bad-query` | 400 | a `q` that is empty once trimmed, or holds a control character, a text-direction control or an invisible character (`textProblem`), or holds no word, such as `--` |
| `unknown-node` | 404 | a `concept` that names no node; a change entry isn't one |
| `not-a-concept` | 409 | a `concept` that isn't a concept header, saying what it is (a superset or a set: pass the concept it belongs to) |
| `unknown-pov` | 400 | C2's |
| `invalid-cursor` | 400 | C1's |
| `search-not-ready` | 503 | the index isn't there, or isn't online yet; the message says which, how far it has filled, and that it fills by itself after the control panel starts |
| `unknown-input` | 400 | an input search doesn't take (the declaration layer's) |

Three hundred characters keep the Lucene query under Lucene's 1,024 clauses: at most 150 words, each with at most three forms.

### 8. No walk yet

- **What packages:** search packages none of the owner's two-step's walks in this version. An agent walks out from a match with `graph walk`, and narrows to a concept's elements with `concept`.
- **What follows:** the build doesn't need walk's engine, so it doesn't wait on A10.14. A follow-up subtask records the walk strategy, for when a relationship type joins related concepts (Consequences). That is the strategy which would answer the nodes AC2's last part describes.

### 9. Docs, and the amendment to ADR 0011

- **ADR 0011, Amendment 5,** written with this ADR. C1's rule that an item's place never changes holds for every read except walk (Amendment 4) and search. Search answers best first, and a change between two pages can change the scores (Decision 5).
- **`src/operations/reads.js`:** C1's paragraph names search's order and that exception. This is a comment only.
- **`docs/GRAPH_OPERATIONS_CATALOG.md`:**
  - Conventions, Paging: the same, in words;
  - §1's `search` row: what it does, and "Takes → returns" as built;
  - §1's closing paragraph: search packages no walk yet (ADR 0008).
- **No rule is added,** so `docs/GRAPH_RULES.md` is unchanged.

## Consequences

**What this enables**

- **An agent finds by words what answers its question, in one call,** without Cypher. Each match comes with the field and passage that show why. That serves round 3's first two kinds of question whole: the file that answers a question, and rules by their words. For the third, search finds the decision record, and its status comes in a passage or from `graph describe-node` (A10.10).
- **`concept` narrows a search to one concept's elements,** the half of the owner's two-step that round 3 used ("rules only").
- **Every instance gets the index at its next start,** with nothing to set up and nothing rewritten.

**What this constrains**

- **A new index on every instance.** Its size follows the instance's text (11 MB for three such indexes at 4.5×), and every write to a name or a tag keeps it current, inside the write's own transaction.
- **The bound.** At a size past the ones measured, a broad search stops short. Its counts then cover the 5,000 best nodes, and the answer says so. The race's questions are specific, and none reached the bound at Avi's size.
- **JSON keys.** A word that is a field's name reads every node with that field, and the check drops all but the true matches.
- **Offloaded JSON** is found by its node's name and description only, and the answer counts such nodes (`offloaded`).
- **Where the two splitters can disagree.** Chinese and Japanese text is split into characters by the index and into dictionary words by the segmenter. A match the two split differently is dropped. The team's docs are in English.
- **Word forms.** Only plurals match as one word: "decided" and "decide" don't.
- **Stop words:** a `q` of only stop words searches them, and reaches the bound on any big graph.
- **Paging under change:** the exception Amendment 5 names.

**Debt and follow-ups**

1. **A walk in search** (subtask on A10.8): a matched concept leads to its near concepts once a relationship type joins related concepts. A node it reaches comes with its path (AC2).
2. **Offloaded fields:** if offloading becomes common, a search text kept on each node (Option B) would let search read their fields.
3. **BIBLE §11** gains the read when the book closes (ADR 0011, debt 5).
4. **A field's full value:** `graph describe-node` (A10.10) gives the whole of a node's fields, for round 3's third kind.

**Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

**New files**

- `src/lib/graph-search-index.js`. It opens nothing at load (ADR graph-operations-foundation/0001, Decision 10) and needs no driver of its own, as `tapestry-node-index.js`. It exports:
  - `INDEX_NAME`;
  - `CREATE_INDEX`, the text in Decision 1;
  - `ensureSearchIndexOnBoot`;
  - `indexState(read)`, which is S0.
- `src/operations/catalog/graph/_search.js`, the pure parts, testable with no stack. It exports:
  - `words(q)` → `{ words, forms }`, refusing `bad-query`;
  - `luceneOf(words, forms)`;
  - `textsOf(row)`;
  - `check(row, words, forms)` → `{ words, field, passage }` or null;
  - `order(a, b)`;
  - the cursor's position check;
  - `BOUND`, `MAX_Q` (300), `PASSAGE` (200) and `STOP_WORDS`.
- `src/operations/catalog/graph/search.js`, the declaration. It has `kind: 'read'`, `access: 'owner-and-admins'`, the inputs `q`, `kind`, `concept`, `pov` (R.POV_INPUT), `limit` (R.LIMIT_INPUT) and `cursor` (R.CURSOR_INPUT), the result schema of Decision 6, and the refusals of Decision 7.
  - `run` resolves `pov` (C2), checks `concept` (`list-elements`' read), then runs S0, S1, the check, the order, the page, S2 and S3.
  - It is found from `src/operations/catalog/graph/`, so there is nothing to register.

**Shared files changed (all additive)**

- `bin/control-panel.js`: one call, `ensureSearchIndexOnBoot`, beside `ensureChangeIndexesOnBoot`, with the same arguments.
- `src/operations/resolve.js`: `kindOf(row)` taken out of `candidateOf` and exported. Behaviour is unchanged.
- `src/operations/reads.js`: C1's paragraph, as a comment only.
- `docs/GRAPH_OPERATIONS_CATALOG.md`: as Decision 9 says. Walk's PR (#115) added a sentence to §1's closing paragraph saying search calls walk's engine. This ADR's own PR corrects that sentence, and the build changes the rest.
- `engineering-team/decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md`: Amendment 5.

**Cypher is fixed text.** The kind, the concept filter and the bound are the only parts chosen by input, and each is a fixed text or a checked whole number. The words reach Lucene as one parameter, `$lucene`.

**For the Tester (Phase 3).**

- **The fakes.** No test fake runs `db.index.fulltext.queryNodes` or `SHOW FULLTEXT INDEXES`. S1 needs a fake route that opens with the `CALL`. It must:
  - split the seeded nodes' names and tag values with the same segmenter;
  - give a score that is the same each time;
  - join tags to their nodes;
  - apply `<kind>`, `<concept>` and C2's trust test.

  Alternatively, the pure parts in `_search.js` take most cases with no fake at all.
- **The boot hook's cases** mirror `tapestry-node-index`'s tests: present, created, name taken, equivalent under another name, retried through start-up errors, and given up.
- **The test plan settles** which fakes change.

**The live check (scratch stack, AC7).**

- **Seed** a brain of Avi's size, as Context fact 6 describes.
- **The index on a fresh boot.** It is made at the fresh boot, which `SHOW INDEXES` and the control panel's log line show.
- **The index on an upgrade.** It is made again when it was dropped and the control panel restarts, with the counts of nodes, relationships and properties the same before and after.
- **An agent's searches.** An admin agent with its own key, through the external CLI:
  - finds a rule by words in its statement, and a document by words in one of its headings;
  - narrows with `kind` and `concept`;
  - pages with the cursor.
- **The timing:** each search under a second.
- **The point of view:** `pov=everyone` against the owner's.
- **The refusals,** including `search-not-ready` while the index is dropped.

Take the stack down afterwards, and note it in the shared notes.

## Out of scope

- **Everything the story leaves out:**
  - search by meaning;
  - "the same concept in another language";
  - keywords on concept headers;
  - searching outside the graph;
  - a node's whole fields;
  - naming `concept` by name;
  - other points of view;
  - visitors' reads;
  - today's `POST /api/neo4j/query`;
  - the rebuild and the race.
- **A walk in search** (Decision 8, follow-up 1).
- **A search text kept on each node** (Option B, follow-up 2).
- **Stemming beyond plurals,** and analyzers for other languages.
