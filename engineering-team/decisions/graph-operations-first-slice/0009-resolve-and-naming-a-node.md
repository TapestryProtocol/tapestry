# ADR 0009: `graph resolve`, and naming a node — a ref read by its shape, matched inside the read's own query from a point of view, and one resolution every later input will use

**Status:** Accepted
**Date:** 2026-11-16
**Story:** `engineering-team/stories/graph-operations-first-slice/9-resolve.md`

## Context

The story (Loom A10.9) asks for one graph read, and for the resolution every input that names a node will use. Its criteria, in short:

- **AC1** — `GET /api/tapestry/graph/resolve` with `ref` lists every node the ref names:
  - a tapestryKey names the node that has it;
  - a nostr address (`kind:pubkey:d-tag`, or an event's id), or its NIP-19 form, names the node at that address;
  - a name names every node whose name is the ref, without regard to case or extra white space, and a concept whose plural it is;
  - a slug names every concept whose slug it is, and every node whose address ends in it.

  A ref is read every way it can be, each node is listed once, and a change entry is never a candidate. `kind=concept` keeps only concept headers, `kind=set` only sets and supersets.
- **AC2** — each candidate comes with the five facts of a node (ADR 0011, C3), its kind (a concept header, a superset, a set or another node) and how the ref matched it. The answer gives the ref as it was read, whether it is ambiguous, and how many candidates were kept and left out across the whole list. It never picks one, and a ref that names nothing answers an empty list.
- **AC3** — the owner's point of view by default, as list-elements reads it; `pov=everyone` counts every author's. Ambiguity is judged among the candidates the point of view keeps. Any other `pov` is refused.
- **AC4** — pages as every read's list does (ADR 0011, C1), and a cursor for another ref, kind or point of view is refused.
- **AC5** — refusals for no `ref`; a ref that is empty once trimmed, or holds a control character, a text-direction control or an invisible character; a bad `kind`, `limit`, `pov` or `cursor`; and an input it doesn't take.
- **AC6** — it writes nothing; 401 and 403 for everyone but the owner and admins; listed for agents, in `/docs`, and run by `tapestry graph resolve`; an admin agent uses it through the external CLI on a scratch stack.
- **AC7** — what a ref names, and when it is ambiguous, is defined once, so a later operation's input can take a name, slug or address and refuse an ambiguous one or none, naming the candidates. The catalog's Conventions say how. No operation built so far changes its inputs here.

The owner settled the story's three questions (2026-11-16). A ref can be any of the forms in AC1, a concept's plural included. `kind` is optional, `concept` or `set`. Ambiguity is judged among the candidates the point of view keeps.

**Orientation.** The agent-memory instance's `/api/concept-graph/summaries` (read only, 2026-11-16) lists these concepts:
- `39998:<TA>:concept-header` (40 elements);
- `…:superset` (31);
- `…:set` (102);
- `…:word` (439);
- `…:nostr-event` and `…:nostr-user`.

`GET /api/concept-graph/node/39998:<TA>:concept-header/neighbors` shows its eight core nodes. No concept changes here.

**Facts from the code and the graph.**

1. **Names.** `nodeColumns` answers a node's name as `coalesce(v.tapestryValue, v.name)` (`src/operations/reads.js:174`).
   - The nostr import fills `name` from an event's `name`, `names` or `title` tag (`src/api/neo4j/eventSync.js:227–230`).
   - The event-less nodes the new writes make carry `name` and `tapestryValue` alike (`src/operations/catalog/graph/_eventless.js:65`).
   - A concept header's `names` tag holds its singular as `value` and its plural as `value1`.
   - On the agent-memory instance, no node has a `tapestryValue` yet, and none of its 6,320 `NostrUser` nodes has a name.
2. **Slugs and d-tags.**
   - **A concept's slug.** `headerOf` reads it from the header's `slug` tag, else its JSON's `oSlugs.singular`, else `toSlugName(singular)` (`src/operations/catalog/graph/_concepts.js:405–420`).
   - **Its address.** `39998:<author>:<d>`, with `d` the name's `dtag.slug`, or that slug with a versioning nonce `~N` when the plain one is taken (`_concepts.js:607–615`). Its core nodes are at `39999:<author>:<d>-<suffix>` (`:163`).
   - **On the agent-memory instance,** every concept header has a slug tag. The slug and the d-tag differ for one concept, `nostr-event-tag`, whose slug is `nostr-event-tagging`, in each of its three headers.
   - **A slug's shape.** update-concept's slug input is `^[a-z0-9]+(-[a-z0-9]+)*$` (`src/operations/catalog/graph/update-concept.js:19`).
3. **Addresses and ids.**
   - **Where the import records an event.** A replaceable event (kind 30000 and up) goes at `uuid` `kind:pubkey:d`, and any other at its id. The import keeps the latest event's id as `id` (`eventSync.js:198–219`).
   - **Tag nodes.** They have uuids of their own, and on the agent-memory instance some of them are 64 hex characters, the shape of an event id.
   - **Other kinds' d-tags.** The d-tags of other replaceable kinds are other applications' names: mute and bookmark lists, NIP-85 assertions. None of them is a concept graph's.
4. **Indexes.**
   - **What is indexed.** `NostrEvent`'s `id` and `uuid` are unique (`setup/neo4jConstraintsAndIndexes.sh:44–45`), and so is `TapestryNode`'s `tapestryKey` (ADR graph-operations-foundation/0003).
   - **What is not.** No index covers `name`, `tapestryValue` or a `TapestryNode`'s `uuid`. So a lookup by name, by d-tag, or by an event-less node's address scans `TapestryNode`.
   - **Size.** Staging holds about 370,000 card sets beside the concept graph (ADR 0011, Amendment 2).
5. **The name rules.** `cleanName` trims a name and makes each run of white space one space (`src/lib/conceptNames.js:113`). `nameProblem` refuses, in this order (`:118–129`):
   - an empty name;
   - a control character;
   - a text-direction control;
   - an invisible character that draws nothing where it is;
   - more than 200 characters;
   - a name with no slug.

   The last two are about making a concept's name, not finding a node. create-concept's name input takes up to 1,000 characters before that check (`src/operations/catalog/graph/create-concept.js:30`).
6. **The read conventions** (ADR 0011):
   - C1, paging;
   - C2, the point of view (`resolvePov`, `trust`, `trustParams`);
   - C3, a node's shape (`NODE`, `nodeColumns`, `nodeOf`);
   - C4, reads behind sign-in, through `graph.read`.

   The session building `graph list-relationships` (A10.13) is writing the next read at the same time, and may change `reads.js`.
7. **The write path runs a write's guards on its inputs before `apply`** (`src/operations/write.js:31–37`). A write whose input took a name would hand its guards a name where they expect a key.
8. **NIP-19.** nostr-tools 2 (`package.json`) decodes `naddr`, `nevent` and `note` with `nip19.decode`, and throws on a bad checksum.
9. **The fakes.**
   - **The routing.** `graphFake.exec` sends a read with no relationship to `nodeCypherFake` (`test/helpers/graphFake.js:484`), and `nodeCypherFake` refuses `OPTIONAL MATCH` (`test/helpers/nodeCypherFake.js:173`).
   - **What that blocks.** `trust(v)` adds `OPTIONAL MATCH (u_v:NostrUser {pubkey: v.pubkey})`, which has no relationship. So a statement that matches nodes by their properties and then tests trust can't run on the fakes as they stand.
   - **What `pathCypherFake` runs.** `OPTIONAL MATCH`, `STARTS WITH`, `ENDS WITH`, `size`, `toLower`, `coalesce`, `IN` and label alternatives. It runs no `split`, no arithmetic and no `=~` (`test/helpers/pathCypherFake.js:1–25`).
   - **ADR 0011's trap still holds:** an alias that spells a write's word, such as `AS set`, reads as a write.
10. **Today's routes** take a name and use the first match. create-element finds its concept by exact name, with `LIMIT 1`, by any author (`src/api/normalize/index.js:1787–1797`). They stay as they are (D15).
11. **The CLIs.** The external CLI sends flags as the query string (ADR 0011, Context 10). `--ref` and `--kind` clash with neither CLI's own flags: the external CLI's global flags are `--instance` and `--key-file` (`clients/cli/src/commands.js:21`).

## Options considered

### Option A — One resolution module: a ref read by its shape, its matching, its kind and its trust test in the read's own Cypher; `graph resolve` a thin read over it (chosen)

`src/operations/resolve.js` holds the resolution, defined once:
- what a ref is read as, decided by its shape alone;
- the fixed statements that find what each reading names, filter by kind, and test trust with ADR 0011's fragment;
- the candidate's shape;
- `resolveOne`, which a later operation's input will call to get exactly one node or a refusal.

`graph resolve` declares the inputs and answers a page.

- **Pros:**
  - AC7 holds in code: whatever names a node later calls the same function, with the same readings and the same refusals.
  - A ref shaped like a tapestryKey uses the key's index, and an address uses no name scan.
  - Trust is tested at read time inside the query, through `reads.js` (C2), so nothing about a point of view is stored (CLAUDE.md, principles 1–3).
- **Cons:**
  - A lookup by name scans `TapestryNode`, twice a page: once for the counts and once for the page.
  - It adds a second shared module that later operations depend on.

### Option B — Option A, and the module's hook for adopters, built now

As A, plus a declaration field naming which inputs take a ref, and of which kind. `callOperation` and `applyWrite` would resolve those inputs before `run`, and before a write's guards.

- **Pros:**
  - Adopting it would be one line in a declaration.
  - The hook would be tested now, on a fixture catalog.
- **Cons:**
  - No operation in this story uses it (AC7), so it would ship with nothing to try it on.
  - It changes `index.js`, `write.js` and `declaration.js`, the module's core, while two other sessions build operations on it.
  - The first operation that adopts it knows what it needs: its `/docs` wording, and whether its answer says what each ref resolved to.

### Option C — An index for names, kept in the graph

A lowercased name property, or a full-text index, so that a lookup by name seeks instead of scans.

- **Pros:** fast at any size.
- **Cons:**
  - Every writer would have to keep the property: today's routes, the import and the new writes. Today's routes stay as they are (D15).
  - A full-text index matches words, not whole names, and still needs a check after it.
  - Principle 3 says to measure first. "It might be slow" is not enough.

The live check measures the scan at 500,000 nodes. If it is too slow, an index is a later ADR's.

(Meilisearch was turned down at once: a graph read doesn't depend on the search index, as ADR 0011 reasoned for points of view.)

**Smaller choices inside Option A, with what was turned down:**

- **Readings by shape, not every reading for every ref.** A tapestryKey, an address, an event id and a NIP-19 identifier are each read only as what they are. Any other ref is read as a name, and also as a slug when it has a slug's shape.
  - **Turned down:** reading every ref every way. A key lookup would then scan the graph for names, and no node is named like a UUID or an address.
  - **AC1's "read every way it can be"** holds for names and slugs, the only forms that overlap.
- **The d-tags of the concept graph's own kinds only, 39998 and 39999.** This refines AC1's "every node whose address ends in it" (Context 3).
  - **Why.** Other kinds' d-tags are other applications' names. `mute` would name every peer's mute list, and none of them is a node one names in the concept graph. Their full addresses still resolve.
  - **It also fits the fakes.** For those two kinds, an address whose d-tag is exactly the slug has a fixed length, 71 characters plus the slug's length, so `size()` makes the test exact with no `split` (Context 9).
- **An event's tag nodes are never candidates,** like change entries. They are parts of an event, not nodes one names, and their uuids can look like event ids (Context 3).
- **Case is ignored by Cypher's `toLower`, on both sides,** so one function lowers what is stored and what is asked. Accents are kept: a name keeps them, and a slug never has any.
- **A refusal of its own, `bad-ref`, not `bad-name`.** The checks are `nameProblem`'s, split out, but a ref can be an address. Its refusal also leaves out create-concept's 200-character and "no slug" rules (Context 5): a peer's element named in another script still resolves.
- **The counts and the page in two statements,** as list-elements reads them (ADR 0011, Decision 2). One statement would bring every candidate back to JavaScript to count.

## Decision

We chose **Option A**. It is the only one that defines the resolution once in code, as AC7 asks. It keeps trust at read time inside the query (principles 1–3), and it changes no shared core while other operations are being built. Its cost is a scan of `TapestryNode` for a name or a slug, which the live check measures.

### 1. A ref, read: `readingsOf(ref, input)`

`readingsOf` is pure, and runs before anything is read. `input` is the input's name, for the refusal: `'ref'` for graph resolve.

1. **Trim the ref,** and refuse `bad-ref` (400, naming `input`) when `CN.textProblem` (Decision 6) finds a problem: it is empty, or holds a control character, a text-direction control, or an invisible character that draws nothing where it is. The message is the problem's, as create-concept words it: *"The ref "…" can't be resolved: it contains an invisible character, U+200B, …"*.
2. **Read it by its shape.** The first rule that applies decides:

   | Shape | Read as | Looked up as |
   |---|---|---|
   | `KEY_PATTERN` (`_nodes.js:11`) | `tapestryKey` | as given |
   | `^\d+:[0-9A-Fa-f]{64}:` followed by anything | `address` | the pubkey lowercased, the rest as given |
   | `^[0-9A-Fa-f]{64}$` | `address`, an event's id | lowercased |
   | `^(naddr\|nevent\|note)1[02-9ac-hj-np-z]+$` that `nip19.decode` decodes | `address` | an `naddr`'s `<kind>:<pubkey>:<identifier>`, or an `nevent`'s or a `note`'s id |
   | anything else | `name`, and `slug` when it has a slug's shape | the name `cleanName`'d; the slug its lowercase |

   - **A slug's shape** is `^[a-z0-9]+(-[a-z0-9]+)*(~[0-9]+)?$`, tested on the cleaned name, lowercased. The nonce lets `dog~1` name a versioned address.
   - **An identifier that doesn't decode,** or an `npub`, falls through to a name and a slug, and matches nothing. The answer's readings say how it was read.
   - nostr-tools is required on first use, never at load (ADR graph-operations-foundation/0001, Decision 10).
3. **The answer** carries the readings as `readings: [{ as, value }]`, with `as` one of `tapestryKey`, `address`, `name` or `slug`, and `value` the text it looked up. So `ref=naddr1…` answers `readings: [{ as: 'address', value: '39998:<pubkey>:dog' }]`. This is "the ref as it was read" (AC2).

### 2. What each reading matches

The readings fall into three families, by which statements they need. A ref belongs to exactly one family.

| Family | Readings | A node matches when | `matched` |
|---|---|---|---|
| K | `tapestryKey` | `n.tapestryKey = $key` | `tapestryKey` |
| A | `address` | `n.uuid = $address OR n.id = $address` | `address` |
| N | `name`, `slug` | its name (C3) lowered is `$name` lowered | `name` |
| | | it is a concept header whose `names` tag's `value1` lowered is `$name` lowered (from statement T) | `plural` |
| | | it is a concept header whose `slug` tag is `$slug` (from T) | `slug` |
| | | its `uuid` starts `39998:` or `39999:`, ends with `:<slug>`, and is 71 characters plus the slug's length long | `d-tag` |

- **Never a candidate:** a change entry (`GraphChange`), an event's tag node (`NostrEventTag`), and a node with no tapestryKey or the placeholder `'{}'` (ADR 0011, Amendment 3).
- **`kind`:**
  - `concept` keeps nodes labelled `ConceptHeader` or `ListHeader`, as list-elements reads a concept header;
  - `set` keeps nodes labelled `Set` or `Superset` that have a `uuid` (ADR 0011, Amendment 2);
  - left out, any node.

  Each kind is one fixed text, chosen by the input and never built from it.
- **A candidate's `kind`,** read as list-elements reads the same labels:
  - `concept` when it is labelled `ConceptHeader` or `ListHeader`;
  - else `superset` when it is a `Superset` with an address;
  - else `set` when it is a `Set` with an address;
  - else `node`.
- **`matched`** lists each way the node matched, in the table's order. Each node is one row, however many ways it matched (AC1).
- **What no reading reads:**
  - a header's slug derived from its JSON or its name, when it has no `slug` tag; such a concept's d-tag, the slug of its name, covers it;
  - a plural kept only in a header's JSON.

  Every header on the agent-memory instance has both tags (Context 2).

### 3. The statements

All are reads through `graph.read`, with `$`-parameters for every value. They are built from the fixed texts below and two fragments of `reads.js`: `trust('n')` and `nodeColumns('n')`. Never use `{uuid: $…}` together with `HAS_ELEMENT`, nor an alias that spells a write's word (Context 9).

- **The match, one fixed text per family:**
  - **K:** `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange AND NOT n:NostrEventTag`
  - **A:** `MATCH (n:TapestryNode) WHERE (n.uuid = $address OR n.id = $address) AND <keyed> AND NOT n:GraphChange AND NOT n:NostrEventTag`
  - **N:**

    ```cypher
    MATCH (n:TapestryNode)
    WHERE <keyed> AND NOT n:GraphChange AND NOT n:NostrEventTag
      AND (toLower(coalesce(n.tapestryValue, n.name)) = toLower($name)
        OR n.tapestryKey IN $tagKeys
        OR ($dSuffix IS NOT NULL AND (n.uuid STARTS WITH '39998:' OR n.uuid STARTS WITH '39999:')
            AND n.uuid ENDS WITH $dSuffix AND size(n.uuid) = $dSize))
    ```

  `<keyed>` is `n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}'`. `$dSuffix` is `':' + slug` and `$dSize` is `71 + slug.length`, both null when the ref has no slug reading. Both are computed in JavaScript, since the fakes have no arithmetic.
- **T, the tags,** for family N only, before the counts:

  ```cypher
  MATCH (h:ConceptHeader|ListHeader)-[:HAS_TAG]->(t:NostrEventTag)
  WHERE h.tapestryKey IS NOT NULL AND h.tapestryKey <> '{}' AND NOT h:GraphChange
    AND ((t.type = 'names' AND toLower(t.value1) = toLower($name))
      OR ($slug IS NOT NULL AND t.type = 'slug' AND t.value = $slug))
  RETURN DISTINCT h.tapestryKey AS key, t.type AS tag
  ```

  - Rows with `tag = 'names'` give `$pluralKeys`, and rows with `tag = 'slug'` give `$slugKeys`. `$tagKeys` is the two together.
  - It starts from the concept headers, which are few, and reads only their tags.
- **The counts:**

  ```cypher
  <match> <kind>
  <trust('n')>
  RETURN count(n) AS seen, count(CASE WHEN counts THEN 1 END) AS kept
  ```

  `leftOut` is `seen - kept`.
- **The page:**

  ```cypher
  <match> <kind> AND ($after IS NULL OR n.tapestryKey > $after)
  <trust('n')>
  WHERE counts
  RETURN <nodeColumns('n')>, n:ConceptHeader OR n:ListHeader AS isHeader, n:Superset AS isSuperset, n:Set AS isSet<matches>
  ORDER BY tapestryKey
  LIMIT <limit + 1>
  ```

  - `<matches>` is empty for K and A. For N it adds:

    ```cypher
    , toLower(coalesce(n.tapestryValue, n.name)) = toLower($name) AS byName,
      n.tapestryKey IN $pluralKeys AS byPlural, n.tapestryKey IN $slugKeys AS bySlug,
      ($dSuffix IS NOT NULL AND (n.uuid STARTS WITH '39998:' OR n.uuid STARTS WITH '39999:')
       AND n.uuid ENDS WITH $dSuffix AND size(n.uuid) = $dSize) AS byDTag
    ```

    A null reads as not matched.
  - The limit is a checked whole number written into the text, as C1 says.

### 4. `graph resolve`, `src/operations/catalog/graph/resolve.js`

A read, `owner-and-admins`, declared with `run`.

**Inputs.**

| Input | Schema | Notes |
|---|---|---|
| `ref` | `{ type: 'string', maxLength: 1000 }`, required | no `minLength`, so that an empty ref meets `bad-ref`, as one of spaces does |
| `kind` | `{ type: 'string', enum: ['concept', 'set'] }` | left out: any node |
| `pov` | `POV_INPUT` | `owner` by default |
| `limit` | `LIMIT_INPUT` | |
| `cursor` | `CURSOR_INPUT` | |

**Refusals,** its own beside the built-in ones (`missing-input` for no `ref`, `invalid-input` for a bad `kind` or `limit`, a malformed `pov`, or a ref over 1,000 characters):

| Code | Status | When |
|---|---|---|
| `bad-ref` | 400 | from Decision 1, naming `ref` |
| `unknown-pov` | 400 | from C2 |
| `invalid-cursor` | 400 | from C1 |

**`run`, in order:**
1. Read the ref (Decision 1), which may refuse `bad-ref`. Nothing has been read yet.
2. Resolve the point of view (C2). This may refuse `unknown-pov`, and from the owner's point of view it reads `scored`.
3. Compute the scope, `scopeOf([readings, kind or null, pov.name])`, and decode the cursor if there is one. The position must pass `KEY_PATTERN`, or the cursor is refused `invalid-cursor`. A NIP-19 identifier and the address it decodes to have the same readings, so a cursor from one works with the other.
4. For family N, read T.
5. Read the counts, then the page.
6. Answer.

**The answer:**

```js
{
  ref: 'nostr relay',                               // as given, trimmed
  readings: [{ as: 'name', value: 'nostr relay' }], // Decision 1
  kind: null,                                       // the kind asked for: 'concept', 'set' or null
  pov: { name: 'owner', observer: '<hex>', cutoff: 0.05, scored: true },
  ambiguous: false,                                 // kept > 1
  kept: 1, leftOut: 1,                              // across the whole list
  candidates: [ { ...NODE, kind: 'concept', matched: ['name'] }, … ],
  cursor: null,
}
```

- **The schemas.** `CANDIDATE` is `NODE`, with `kind` (`concept`, `superset`, `set` or `node`) and `matched` (a list of `tapestryKey`, `address`, `name`, `plural`, `slug` or `d-tag`) added and required. A read may add facts, never rename or drop one (C3).
- **What it doesn't do.**
  - It never picks a candidate.
  - It refuses nothing for being ambiguous or for matching nothing: an empty `candidates` is an answer (AC2).
  - It changes nothing.

### 5. Naming a node in a later operation: `resolveOne`, and how an operation adopts it

**`resolveOne(read, { input, ref, kind, pov })`** is the one way a later input turns a ref into a key (AC7):

1. **A ref shaped like a tapestryKey comes back as given, with no read.** The operation's own checks then answer for it as they do today: `unknown-node`, `not-a-concept` with its hint, and the rest. Nothing an operation answers for a key changes when it adopts refs.
2. **Any other ref** is read (Decision 1), which may refuse `bad-ref` naming `input`. It is then counted and paged, as graph resolve does, with a limit of 10:
   - **None counts:** it refuses `unknown-ref` (404), naming `input`. The message says how many candidates the point of view left out, and that a node's tapestryKey names it whatever the point of view.
   - **More than one counts:** it refuses `ambiguous-ref` (409), naming `input`. The refusal carries `candidates`, up to 10, each as graph resolve answers one, and `more` when there are others. The message lists them and says to pass the tapestryKey of the one meant. It is never guessed (catalog, Conventions).
   - **Exactly one counts:** it returns that candidate's tapestryKey.
3. **`kind` is the kind the input takes:** `concept`, `set`, or `node` for any node. **`pov` is a resolved point of view:**
   - a read's own `pov`, when it takes one;
   - otherwise the owner's, which is what a write uses.

**How an operation adopts it.** Specified here, and built by the first story that adopts it (Consequences):
- **Its input** takes a ref: `refInput(description)` from `resolve.js`, the same schema as graph resolve's `ref`, with a description saying it takes a tapestryKey, or a name, slug or address that names one node.
- **Its declaration says which inputs are refs, and of which kind:** a field `refs: { <input>: 'concept' | 'set' | 'node' }`. `declaration.js` checks that each names one of its inputs.
- **The module resolves those inputs before the operation sees them:**
  - **a read's** in `callOperation`, before `run`;
  - **a write's** in `applyWrite`, inside its transaction, before its guards (Context 7), so the guards, `apply` and the change entry all see keys, read from the same graph.
- **Its refusals** gain `bad-ref`, `unknown-ref` and `ambiguous-ref`, as a write's guards' refusals join its list. So its `/docs` entry and the list show them.

Until an operation adopts refs, its node inputs take tapestryKeys only, and an agent calls graph resolve first.

### 6. The name rules, reused: `textProblem`, `src/lib/conceptNames.js`

`nameProblem`'s first four checks become `textProblem(text)`, exported:
- empty once trimmed;
- a control character;
- a text-direction control;
- an invisible character that draws nothing where it is.

`nameProblem` calls it first, then checks the length and the slug as before, so create-concept's and update-concept's refusals don't change, word for word. `readingsOf` calls `textProblem` alone.

### 7. Docs

- **`docs/GRAPH_OPERATIONS_CATALOG.md`, Conventions, "Naming a node."** The bullet says what a ref names (Decisions 1–2), where it is defined (`src/operations/resolve.js`, this ADR), and how an input adopts it (Decision 5). It also says that until an operation does, its node inputs take tapestryKeys only.
- **`docs/GRAPH_OPERATIONS_CATALOG.md`, §1's `resolve` row.** Its "Takes → returns" gives the inputs and the answer as built.
- **No rule is added,** so `docs/GRAPH_RULES.md` is unchanged. A name that names two nodes breaks no graph rule.

## Consequences

**What this enables**
- An agent can name a concept, a set or any node as people do, and get its tapestryKey without Cypher. It is told when a name is ambiguous, from its point of view.
- Every later input that names a node resolves a ref the same way, through `resolveOne`, and refuses an ambiguous ref the same way.
- A ref shaped like a key costs one index seek.

**What this constrains**
- **A name or a slug scans every node that has a tapestryKey,** twice a page. The live check measures it at 500,000 nodes. An index is a later ADR's, if the measurement calls for one (Option C).
- **Stored names are compared as they are, lowered.** A ref's white space is cleaned, but a stored name with two spaces in a row doesn't match its cleaned form. The names the operations make are cleaned already.
- **A slug names only the d-tags of kinds 39998 and 39999.** Another kind's node resolves by its full address or its name.
- **A concept's superset is reached by its d-tag** (`dog-superset`), or through the concept, not by the concept's name with `kind=set`. A concept header is not a set.
- **A cursor is tied to its readings, its kind and its point of view.**

**Debt and follow-ups**
1. **The hook of Decision 5,** for the first operation that takes refs: a Loom subtask of A10.9, unowned, when this story's pull request is open.
2. **The name scan.** If the live check finds a page by name slower than 2 seconds at 500,000 nodes, a row in OPEN.md says so, for an index.
3. **BIBLE.** §11 gains naming a node, when the book closes (design §8, step 4).

**Firmware reinstall required?** No: no concept definition changes.

## Implementation notes

**New files**
- **`src/operations/resolve.js`,** Decisions 1, 2, 3 and 5. It opens nothing at load, and requires nostr-tools, the config and the assistant's key when first called. It exports:
  - the inputs, `REF_INPUT` and `KIND_INPUT`, and `refInput(description)`;
  - the refusals, `BAD_REF`, `UNKNOWN_REF` and `AMBIGUOUS_REF`;
  - the schemas, `READING` and `CANDIDATE`;
  - the functions:
    - `readingsOf(ref, input)` → `{ family: 'key' | 'address' | 'name', readings, key?, address?, name?, slug? }`;
    - `candidatesOf(read, readings, { kind, pov, after, limit })` → `{ seen, kept, rows }`;
    - `candidateOf(row, own)`;
    - `resolveOne(read, { input, ref, kind, pov })`.

  It takes `KEY_PATTERN` from `catalog/graph/_nodes.js`, and `trust`, `trustParams`, `nodeColumns` and `nodeOf` from `reads.js`.
- **`src/operations/catalog/graph/resolve.js`,** Decision 4.

**Changed files**
- **`src/lib/conceptNames.js`,** Decision 6. `nameProblem`'s behavior doesn't change.
- **`docs/GRAPH_OPERATIONS_CATALOG.md`,** Decision 7.

**Not changed**
- `reads.js`, which the A10.13 session may be changing; `resolve.js` only imports it.
- `list-elements.js` and every other declaration.
- `_concepts.js`, `write.js`, `index.js` and `declaration.js`.
- Today's routes.

**For the Tester** (Phase 3; these are the Tester's, not the Implementer's):
- **The fakes, first.**
  - **The routing.** The counts and the page of families K, A and N have no relationship, but `trust` adds an `OPTIONAL MATCH`. `graphFake.exec` has to send a read with `OPTIONAL MATCH` to `pathCypherFake`, not `nodeCypherFake` (Context 9).
  - **What `pathCypherFake` runs already.** Called directly while this ADR was written (2026-11-16), it ran family N's page as Decision 3 gives it. It left out a change entry and a d-tag holding a colon, and counted a peer scored above the cutoff. So only the routing changes. Statement T's `HAS_TAG` and `(h:ConceptHeader|ListHeader)` are already in its repertoire.
  - **Coordinate.** The A10.13 session may also be changing `graphFake.js`, and the shared notes folder is where to say so.
- **A seed of the Tester's own,** beside `test/helpers/elementsGraph.js`, can hold:
  - **concepts:** a concept of the instance's own named `dog`, with a `names` tag `dog`/`dogs` and a slug tag `dog`, at `39998:<TA>:dog`, with its superset at `39999:<TA>:dog-superset`; a peer's concept also named `dog`; and a concept whose slug and d-tag differ, `nostr-event-tagging` at `…:nostr-event-tag`;
  - **elements and sets:** an element `Rex`; an element of the instance's own with a tapestryValue that differs from its name; a set `walkers` with an address; a card set, labelled `Set` with no address, named like a set; and a node named in another script, such as `狗`;
  - **what must never match:** a node with no tapestryKey; a `GraphChange` named like the ref; a `NostrEventTag` whose uuid is a 64-hex event id the tests also ask for; an event at `30000:<peer>:dog`, a kind outside the concept graph's; and an address whose d-tag holds a colon, `39999:<TA>:x:dog`;
  - **for paging:** 120 nodes sharing a name, for three pages at 50;
  - **for the point of view:** `NostrUser` scores above and below the cutoff, and a peer with no `NostrUser`.
- **The suite** goes through the operations harness, under `test/operations/graph/`. It covers:
  - AC1 to AC6, one reading at a time, each kind, and `matched` for a node found several ways;
  - the counts across pages, and paging across harness runs with the state file changed between runs;
  - the point of view: owner, everyone, the owner's own pubkey, and `unknown-pov`, with `scored` false when no score exists;
  - every refusal: no ref; empty; spaces only; a control character; a text-direction control; an invisible character; over 1,000 characters; a bad `kind`; a bad `limit`; an unknown input;
  - cursors from another ref, another kind, another point of view and another read;
  - the route and the command answering alike;
  - a read that writes nothing: the log shows reads only.
- **`readingsOf`,** tested directly: each shape; the address's pubkey lowercased; an `naddr`, `nevent` and `note`; an identifier with a bad checksum falling through to a name; a slug with a nonce.
- **`resolveOne`,** tested directly over the fake:
  - a key comes back with no read;
  - one candidate gives its key;
  - none gives `unknown-ref`, with the count left out;
  - several give `ambiguous-ref`, with up to 10 candidates and `more`;
  - the kind narrows the candidates.
- **`conceptNames`:** `textProblem` for each problem, and `nameProblem`'s existing tests unchanged.
- **An agent suite** through the external CLI, on the model of `test/operations/graph/list-elements-agent-through-cli.test.js`, in a new file.

**The live check** runs on a scratch stack (`scripts/scratch-stack.sh`), never on the agent-memory instance. The script names its container `tapestry-scratch`, so it runs one stack at a time on this Mac: check `docker ps` first, and say so in the shared notes folder, since the A10.13 and A10.20 sessions may want it too.
1. **Set it up.** Copy the branch's `bin/` and `clients/cli` in, link `/usr/local/bin/tapestry`, and install the firmware if its digest differs from the image's.
2. **Seed through the operations and today's routes, which sign; that is fine on a throwaway instance.**
   - two concepts, `live dog` and `dog breed`;
   - elements, and a set made by add-subset;
   - a peer's concept named `live dog`, signed by a throwaway key and imported;
   - an event at kind 30000 whose d-tag is `live-dog`;
   - 120 nodes named `live item`, made with Cypher.
3. **Resolve each reading and each kind:**
   - the point of view, with the peer's influence set above the cutoff and then below it, and `pov=everyone`;
   - paging through `live item`;
   - each refusal;
   - the route and the command, byte for byte;
   - 401 and 403 through nginx.
4. **Measure.** Seed 500,000 nodes with tapestryKeys and no names, as the card sets are, then time a page by name, by slug, by address and by key, the median of five each. Record the times, and add the OPEN.md row if a page by name or slug takes more than 2 seconds.
5. **Check nothing was written.** The relay's event count and the number of `GraphChange` nodes are unchanged around the calls.
6. **The agent.** An admin agent with its own key, through nginx and the external CLI:
   - resolves `live dog` and gets one candidate, from the owner's point of view;
   - lists that concept's elements with the key;
   - resolves `live dog` with `pov=everyone`, and is told it's ambiguous, with both candidates;
   - resolves a set with `--kind set`.

**Branches.** A new feature, for `staging` only. It reaches `main` through the normal promotion, and no long-lived sandbox branch needs a port.

## Amendment 1 (2026-11-16, at Test Design) — what the Tester's readings settle

The test plan (`engineering-team/stories/graph-operations-first-slice/9-resolve.test-plan.md`) reads the decisions this way, and the suites hold the Implementer to it:

1. **A refusal carries its candidates.** `src/operations/refusal.js` copies only `rule` and `input` into a refusal's extra fields (`refusal.js:11`). So `ambiguous-ref` couldn't carry `candidates` and `more`, as Decision 5 says it does.
   - **The change.** `refusal.js` also copies `candidates`, when it is a list, and `more`, when it is true or false. The route then answers them beside `error` and `code`, as it does `input`.
   - **Nothing else changes.** No operation that refuses today passes either field.
   - **Changed files** gain `src/operations/refusal.js`.
2. **`refInput(description)` gives `{ schema, description }`,** with `REF_INPUT`'s schema and no `required`. Whether an input is required is the adopting operation's to say.
3. **`readingsOf` answers `family` and `readings`.** `family` is `key`, `address` or `name`. The suites read nothing else it answers.
4. **The answer's `ref` is the ref as given, trimmed.** The name in `readings` is the cleaned one, so `'  dog   breed  '` answers `ref: 'dog   breed'` and `readings: [{ as: 'name', value: 'dog breed' }]`.
5. **The schemas' lists:**
   - `READING.as` is one of `tapestryKey`, `address`, `name` and `slug`;
   - `CANDIDATE.kind` is one of `concept`, `superset`, `set` and `node`;
   - `CANDIDATE.matched` lists items of `tapestryKey`, `address`, `name`, `plural`, `slug` and `d-tag`.
6. **`unknown-ref`'s message gives the number** of candidates the point of view left out. It also says that a node's tapestryKey names it whatever the point of view.
7. **The fakes.** The Tester's commit makes the routing change of the For the Tester notes in `test/helpers/graphFake.js`, and `test/operations/graph-fake.test.js` gains F21 for it.

**Note, 2026-11-16 (at Review, round 1, Blocking 3).** Item 7's test is now F24. Commit `78b34637` renumbered it after story 13's F21–F23 (A10.13, `graph list-relationships`), which merge first. No decision changes.

## Out of scope

- **Everything the story leaves out:**
  - changing the inputs of the operations built so far;
  - resolving within a concept;
  - partial, fuzzy or near matches;
  - people (a pubkey or an `npub`);
  - other points of view;
  - more about a candidate;
  - today's routes;
  - visitors' reads.
- **The hook of Decision 5,** built by the first operation that adopts it.
- **An index for names or for a `TapestryNode`'s uuid** (Option C), unless the live check calls for one in a later ADR.
- **A read transaction** that would read the counts and the page at one moment, as ADR 0011 leaves it.
