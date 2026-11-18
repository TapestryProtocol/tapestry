# Graph Rules

**Status:** Draft. This rulebook was started on 2026-11-14 by story graph-operations-foundation #4 (ADR graph-operations-foundation/0004 Decision 12). It holds one entry per rule: each rule that is built, as the design's §8, step 3 asks ("Write each rule into the rules document (§7) as its guard or check is built."), and, since ADR graph-rules/0001, rules that are proposed but not yet enforced, or retired. That ADR also says what may be written here and what goes elsewhere. Once ratified it moves under `protocols/`, next to `protocols/drafts/tapestry-concepts.md`, and BIBLE §10 shrinks to a pointer (design §7, "Where it lands").

**How a rule is built.** Each rule is defined once and used two ways (design D3):
- as a guard inside each write that could break it;
- in `rules check`, with repair.

Its code is one file, `src/operations/rules/<name>.js`, whose `violations(items, read)` is that one definition. The write path calls it before a write, and `rules check` (A10.31) will call it over the graph.

**What each entry says:**
- its name, in its heading: the entry's number and the rule's name in backticks, `` ## <n>. `<name>` ``. A rule with code shares the name with its file;
- what the rule says;
- whether it is a graph rule or a letter rule;
- whether it refuses a write or only reports;
- how a check finds what breaks it;
- how a repair fixes it;
- where it is enforced: by the database, a guard or a check;
- its status: proposed (written, not yet enforced), enforced (the database, a guard or a check enforces it) or retired;
- its source: the TIP or ADR that brought it in. Whether a rule is agreed is its source's status, not the rule's (ADR graph-rules/0001).

The format, which `node src/firmware/graph-rules.js` checks:
- **Headings.** An entry's heading is its number, a full stop and its rule's name in backticks, and nothing else. Any other level-2 heading isn't an entry, and has nothing in backticks.
- **Fields.** Each field is a bullet that starts with its label and a colon, both in bold, such as `- **Says:**`. Its text may go on below the bullet, on lines indented by two spaces. A line after a field that isn't indented is a problem, and nothing but fields belongs in an entry.
- **Labels.** Every entry has each of eight labels once: Says, Kind, Refuses or reports, Check, Repair, Enforced by, Status and Source. An entry may add others, such as entry 2's Reserved.
- **Refusals.** A refusal is written as its code in backticks and its status in parentheses, such as `` `cycle` (409) ``.
- **Code.** A rule with code names its file in Enforced by, `src/operations/rules/<name>.js`.

**In the graph.** Firmware installs each entry as an element of the graph rule concept, `39998:<TA>:graph-rule`, on every instance (story graph-operations-first-slice #41, ADR graph-operations-first-slice/0041). The elements are made from this file and each rule's code by `node src/firmware/graph-rules.js`, which writes them into the firmware, and a test fails until it is run again after an entry or a rule's code changes. So a rule is changed here, never in the graph: an install brings each instance's items in line, and puts back an item's JSON when someone has edited it in the graph.

## 1. `tapestry-key-unique`

- **Says:** each node has a `tapestryKey`, a random v4 UUID set once and never changed, and no two nodes share one. This is the owner's first core rule (design §7) and D6.
- **Kind:** a graph rule, for every node, the web of trust's included.
- **Refuses or reports:** the database refuses a second node with a key another one holds.
- **Check:** `lifecycle status`'s migrations part counts the nodes with no key, and says whether the uniqueness rule is in place.
- **Repair:** `lifecycle migrate --migration tapestry-keys` gives every node that lacks a key one, along with the shared label.
- **Enforced by:**
  - the database: the uniqueness rule `tapestry_key`, on the shared label `TapestryNode`;
  - every path that makes a node: `keyNode`, in `src/lib/tapestry-key-cypher.js`.

  Built in story graph-operations-foundation #3 (ADR 0003). A change entry is a node too, and gets its key when it is made (ADR 0004 Decision 5).
- **Status:** enforced.
- **Source:** ADR graph-operations-foundation/0003.

## 2. `relationship-type-allowed`

- **Says:** a relationship the owner or an admin adds or removes has a type the graph declares, and not one reserved for another operation or the nostr import. A type is declared by being an element of the relationship type concept, `39998:<TA>:relationship-type`.
- **Kind:** a graph rule, about the owner's and the admins' own writes (D4).
- **Refuses or reports:** it refuses the write, before anything changes:
  - `reserved-type` (409) for a reserved type, even a declared one, naming what makes it;
  - `undeclared-type` (409) for a type nothing declares.
- **Reserved:** two groups.
  - Every relationship type the active firmware declares. These are the class threads, a concept's core-node wiring, the property tree, and the import's `AUTHORS`, `HAS_TAG` and `REFERENCES`.
  - What the instance's own code writes beyond them: `INHERITS_FROM`, `FOLLOWS`, `MUTES`, `REPORTS`, `TAGS`, `PROVIDED_THE_TEMPLATE_FOR`, `IMPORT`, `SUPERCEDES`, `SPECIFIC_INSTANCE`, `WOT_METRICS_CARDS` and `SERVES`.

  A test fails if the code names a relationship type in Cypher that isn't reserved.
- **Check:** the same `violations` over a set of relationships names each one that breaks it. `rules check` (A10.31) will run it over the graph, judging each relationship by where it came from (D15). A relationship an import recorded is a peer's claim, not one of the owner's writes.
- **Repair:** none yet.
- **Enforced by:** the guards of `graph add-relationship` and `graph remove-relationship`. The rule's code is in `src/operations/rules/relationship-type-allowed.js`. Built in story graph-operations-foundation #4 (ADR 0004).
- **Status:** enforced.
- **Source:** ADR graph-operations-foundation/0004.

## 3. `field-mark-allowed`

- **Says:** a field marked to be carried on its elements' Neo4j nodes is a plain top-level field of a concept, with a property node in the concept's property tree, and a property name that no other mark yields and that nothing else wrote. A mark is one `HAS_ELEMENT` edge from the set of neo4j properties that are also fields, `39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields`, to the field's property node. It makes each current element of the concept carry the field's value from its JSON, as a node property.
- **The naming convention:** a marked field's property is `<key>_<field>`, the concept's key (its `oKeys.singular`) and the field's name joined by `_`, such as `dog_breed` for Dog's `breed`. The name is computed every time, never stored, and one mark yields it across the graph. Names starting `<key>_` on an element of a concept with that key belong to marks: `graph map-fields` removes one that no mark yields, such as a copy left by a field that has left the schema.
- **Kind:** a graph rule, about the owner's and the admins' own marks (D4). Every element of the set counts as a mark, whoever made the edge.
- **Refuses or reports:** it refuses the write, before anything changes, with the first check that fails, in this order:
  - `not-installed` (409): the graph has no set of neo4j properties that are also fields, so the firmware isn't installed;
  - `unknown-concept` (404): no concept header has the key (a `ConceptHeader`, or a `ListHeader` for one the nostr import brought in);
  - `unknown-field` (404): the field isn't one of the concept's top-level fields, naming those fields;
  - `no-property-node` (409): the field has no node under the concept's section node, or the concept has no primary property. A node create-property made, off the schema node, doesn't count, since concepts can share it. The refusal points to `POST /api/normalize/generate-property-tree`, which signs;
  - `not-plain` (409): the field holds an object, a list of objects or a list of lists, which no Neo4j property can hold (design §5, question 1);
  - `unusable-name` (409): the concept's key isn't letters and digits, so `<key>_<field>` can't be written unquoted in Cypher;
  - `property-taken` (409): another mark already yields the same name, from another concept with the same key;
  - `property-in-use` (409): a current element of the concept already carries the name though the field isn't marked, naming one such node.

  The last two skip the field's own mark, so a repeat on a marked field passes.
- **Check:** the same `violations` over every current mark names each mark whose field has changed type, lost its property node, or now collides. `rules check` (A10.31) will run it over the graph.
- **Repair:** `graph unmark-field` takes a broken mark out, with its copies; `graph map-fields` brings a concept's copies in line with its marks.
- **Enforced by:** the guard of `graph mark-field`. The rule's code is in `src/operations/rules/field-mark-allowed.js`, and the mapping it guards is in `src/operations/catalog/graph/_fields.js`. Built in story graph-operations-foundation #5 (ADR 0005).
- **Status:** enforced.
- **Source:** ADR graph-operations-foundation/0005.

## 4. `concept-slug-unique`

- **Says:** no two of this instance's own concepts share a slug or a key. This is BIBLE §10's rule 10, as its full text gives it (tapestry-cli `docs/NORMALIZATION.md`, 2026-03-23): within one author's graph, because a concept's key, `oKeys.singular`, is what its elements' JSON is filed under (`{"dog": {…}}`). A concept is this instance's own when its header's author is the instance's assistant, with a letter or without one. Another author's concept with the same slug is expected, and isn't a violation: the Grapevine settles which one counts (rule 8). Names aren't part of the rule; no rule makes them unique.
- **Kind:** a graph rule, about the owner's and the admins' own concepts (D4).
- **Refuses or reports:** it refuses the write, before anything changes:
  - `slug-in-use` (409): an update gives a concept a slug another of this instance's concepts has, naming it;
  - `key-in-use` (409): a create's name gives a key another of this instance's concepts has under another slug, naming it. A concept's key never changes, so after a slug change, the name the concept was made with stays refused. A create whose slug an own concept already has is the repeat, and answers that concept untouched.
- **Check:** the same `violations` over every own concept, each as `{ concept }`, names each concept that shares a slug or a key with another, both of the pair. `rules check` (A10.31) will run it over the graph.
- **Repair:** none yet. A slug clash is fixed with `graph update-concept --slug`. A key clash needs a concept moved to another key, which no operation does yet.
- **Enforced by:** the guards of `graph create-concept` and `graph update-concept`, run again after each takes its lock, so two writes at once can't both pass it. The rule's code is in `src/operations/rules/concept-slug-unique.js`. Built in story graph-operations-first-slice #16 (ADR 0016).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0016.

## 5. `class-thread-acyclic`

- **Says:** no set or superset is below itself. Following class-thread links down from any node, through any number of links and across concepts, never comes back to it. A class-thread link is `IS_A_SUPERSET_OF`, the class thread's propagation link, from a superset or a set to the set or superset directly under it. Only a node with an address, its `uuid`, counts as a set, a superset or a parent, so a link with an address-less end isn't judged: a node labelled `Set` with no address, such as one of the trust pipeline's card sets, isn't a set of the concept graph (ADR graph-operations-first-slice/0028 Amendment 3). The class thread anomaly (BIBLE §10, rule 9) is an element, not a link, so it breaks nothing here.
- **Kind:** a graph rule, about the class threads' links.
- **Refuses or reports:** it refuses the write, before anything changes: `cycle` (409) for a link whose parent is the set itself, or is already below it in the class thread. The refusal names the chain of sets from the set down to the parent, at most twelve of them and then how many more.
- **Check:** the same `violations` over a set of links that are there names each link on a cycle: walking up the class thread from its parent, one level per read, reaches its set. The walk never uses the link itself, so the guard and the check are one definition. `rules check` (A10.31) will run it over the graph's class-thread links, judging each by where it came from (D15). Today's `POST /api/normalize/add-relationship` doesn't check for a cycle, so it can make one, and so can two link-sets at once that close a loop between four sets (ADR graph-operations-first-slice/0028 Decision 9).
- **Repair:** `graph unlink-set` takes out a link on the cycle.
- **Enforced by:** the guard of `graph link-set`, which runs the rule again after its write, inside the same transaction. The rule's code is in `src/operations/rules/class-thread-acyclic.js`, and the walk it uses is in `src/operations/catalog/graph/_sets.js`. Built in story graph-operations-first-slice #28 (ADR graph-operations-first-slice/0028).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0028.

## 6. `set-has-a-parent`

- **Says:** every set is directly under at least one superset or set, so some class thread reaches it and its elements. A superset is exempt: its concept's header holds it in its class thread. Only a superset or a set counts as a parent, so an element an old route put above a set doesn't. And only a node with an address, its `uuid`, is judged as a set or counted as a parent: the trust pipeline's card sets are labelled `Set` but have no address, so they are neither (ADR graph-operations-first-slice/0028 Amendment 3).
- **Kind:** a graph rule, about the class threads' sets.
- **Refuses or reports:** it refuses the write, before anything changes: `last-parent` (409) when taking a set out from under a parent would leave it under no other superset or set. The refusal names that parent and says how to go on: link the set under another parent first, or delete it once it is empty (`graph delete-set`, A10.17). Taking out a link that isn't there is a repeat, not a refusal.
- **Check:** the same `violations` over a set of sets, with no parent to leave, names each set under no superset or set. `rules check` (A10.31) will run it over the graph's sets, those with an address, so it reports none of the trust pipeline's card sets. Today's `POST /api/normalize/delete-relationship` doesn't check for a set's last parent, so it can leave one.
- **Repair:** `graph link-set` gives a set with no parent one; `graph delete-set` (A10.17) deletes it once it is empty.
- **Enforced by:** the guard of `graph unlink-set`, which runs the rule again after its write, inside the same transaction. The rule's code is in `src/operations/rules/set-has-a-parent.js`, and what it reads with is in `src/operations/catalog/graph/_sets.js`. Built in story graph-operations-first-slice #28 (ADR graph-operations-first-slice/0028).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0028.

## 7. `element-fits-schema`

- **Says:** a node's fully realized tapestryJson fits the JSON schema of each concept it is an element of. This is BIBLE §10's rule 4, "Elements MUST validate against their concept's JSON Schema", and the owner's D9: each node is an element of at least one concept, and must validate against the format that concept expects. A concept's schema describes a node's tapestryJson, the JSON the Tapestry LMDB (the tapestry-store, not strfry's LMDB) holds for it: its word block, a section for each concept it is an element of, and its `graphContext` (ADR graph-operations-first-slice/0020a). A node belongs to every concept whose class thread reaches it (rule 3), so a node in a set that two concepts' class threads reach has two schemas to fit. A schema is read one way, by the one check both readers use (`src/operations/catalog/graph/_schemas.js`): the JSON schema node's `jsonSchema` section, its `$schema` dropped, checked with ajv's defaults, which read draft-07's keywords. The rule and the derive step judge the same document, against the same concepts, so they give one verdict; the derive step keeps a dated copy of it in each node's `graphContext.parentJsonSchemas`, and the rule decides when it is asked (ADR graph-operations-first-slice/0042). A node's tapestryJson can be missing, incomplete or out of date, and the rule speaks of its fully realized form. Exceptions to the rule, for performance, will come; none is written yet (ADR 0020a, Decision 2).
- **Kind:** a graph rule, about the owner's and the admins' own element writes (D4). As a check it judges every element by where it came from (D15): an element an import brought in is reported, never refused.
- **Refuses or reports:** it refuses the write, before anything changes:
  - `invalid-fields` (400) when the JSON the write builds doesn't fit the concept's schema. The refusal lists every problem, each naming the field and what is wrong: a required field left out, a value of the wrong type, a value the schema doesn't allow, a field the schema doesn't take. It names at most twenty, then how many more. No value is made up for a field left out;
  - `no-schema` (409) when the concept's schema is missing, can't be read, or doesn't compile, so nothing could be checked. The refusal says why.

  A write judges its JSON before the derive step has built the node's `graphContext`, so it sets aside every problem that is only about `graphContext`: a concept the JSON misses for nothing else is reported as waiting for the derive step, and the write isn't refused for it; a concept it misses for other things too is refused, or reported, for those alone (ADR 0042, Decision 3). An element in a set may join other concepts too. The write reports whether its JSON fits each of their schemas, or waits, and doesn't refuse for them: giving the element their sections is `graph add-to-concept` (A10.22).
- **Check:** the same `violations` over a set of nodes, each as `{ node }`, judges each node's tapestryJson as the tapestry-store holds it, and names each node and each concept whose schema it doesn't fit, and each concept with no schema to check against; as `{ node, concept }` it judges against the one named. Nothing is set aside: tapestryJson without its `graphContext` doesn't fit `word`'s schema. A node with no tapestryJson yet is named once, its finding marked `missing`, so a report can tell a node not yet built from one that doesn't fit; tapestryJson that isn't an object is named once too. A finding on a tapestryJson that has its `graphContext` gives when it was built, its `derivedAt`, since an entry built before a change is judged as it is (ADR 0020a, Decision 5). `rules check` (A10.31) will run it over the graph. The property operations (A10.18) will run it over a concept's elements after its schema changes, reporting only.
- **Repair:** none yet. `graph update-node` (A10.21) changes an element's fields, and `graph add-to-concept` (A10.22) gives it another concept's section.
- **Enforced by:** the guard of `graph create-element`, run in its write once it has taken the lock on the concept's header and built the element's JSON, since that JSON comes from the graph. The rule's code is in `src/operations/rules/element-fits-schema.js`. The check it uses is in `src/operations/catalog/graph/_schemas.js`, which `graph create-set`, `graph update-node` and the derive step (`src/lib/derivers/schema-verdicts.js`) call too, and `graph add-to-concept` (A10.22) and the property operations (A10.18) will call when they are built. Built in story graph-operations-first-slice #20 (ADR graph-operations-first-slice/0020), and made to judge tapestryJson in story #42 (ADR graph-operations-first-slice/0042).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0020, ADR graph-operations-first-slice/0020a and ADR graph-operations-first-slice/0042.

## 8. `node-has-a-concept`

- **Says:** every node is an element of at least one concept other than word: some concept's class thread reaches it, from the concept's header to its superset, down through its sets, to the node (design D9; BIBLE §10, rule 3). A concept keyed `word` or `graphContext`, the keys an element's JSON keeps for itself, doesn't count: word's class thread reaches nearly every element, through its word block. Membership is read through the class thread, never from a node's direct links alone, since a firmware install's prune can take out a superset's direct link to an element it also reaches through a set (memo #117 on A10.22). Tags and change entries are parts of letters and of the history, not elements, and are exempt.
- **Kind:** a graph rule, about the owner's and the admins' own writes (D4). As a check it judges every node, whoever made it.
- **Refuses or reports:** it refuses the write, before anything changes: `last-concept` (409) when taking a node out of a concept, or out of one of its sets, would leave it an element of no concept but word. The refusal names the concept and says how to go on: add the node to another concept first (`graph add-to-concept`), or delete it (`graph delete-node`). Taking a node out of a concept that doesn't reach it is a repeat, not a refusal.
- **Check:** the same `violations` over a set of nodes, each as `{ node }`, names each node no concept but word reaches. `rules check` (A10.31) will run it over the graph. Person nodes and placeholders are elements of no concept today, so the check names every one until they are given one (ADR graph-operations-first-slice/0022, follow-up 6). `graph unlink-set` can still leave an element of no concept, and so can today's `POST /api/normalize/delete-relationship`, which doesn't check for a node's last concept.
- **Repair:** `graph add-to-concept` gives a node of no concept one; `graph delete-node` deletes one of the instance's own.
- **Enforced by:** the guard of `graph remove-from-concept`, as `{ node, concept, set }`: the node judged as if every link by which the concept, or the set, reaches it were gone. The write runs the rule again after its delete, inside the same transaction, as a check of the node, so two removals at once of a node's last two concepts can't both pass it. The rule's code is in `src/operations/rules/node-has-a-concept.js`, and what it reads with is in `src/operations/catalog/graph/_memberships.js` and `src/operations/catalog/graph/_fields.js`. Built in story graph-operations-first-slice #22 (ADR graph-operations-first-slice/0022).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0022.
