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
  - `no-property-node` (409): the field has no node under the concept's section node, or the concept has no primary property. A node create-property made, off the schema node, doesn't count, since concepts can share it. The refusal points to `graph set-schema` and the other property writes, which give a concept's fields their nodes and sign nothing (ADR graph-operations-first-slice/0018), and to `POST /api/normalize/generate-property-tree`, which signs;
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
- **Check:** the same `violations` over a set of nodes, each as `{ node }`, judges each node's tapestryJson as the tapestry-store holds it, and names each node and each concept whose schema it doesn't fit, and each concept with no schema to check against; as `{ node, concept }` it judges against the one named. Nothing is set aside: tapestryJson without its `graphContext` doesn't fit `word`'s schema. A node with no tapestryJson yet is named once, its finding marked `missing`, so a report can tell a node not yet built from one that doesn't fit; tapestryJson that isn't an object is named once too. A finding on a tapestryJson that has its `graphContext` gives when it was built, its `derivedAt`, since an entry built before a change is judged as it is (ADR 0020a, Decision 5). `rules check` (A10.31) will run it over the graph. The property operations (`graph add-property`, `update-property`, `remove-property` and `set-schema`, ADR graph-operations-first-slice/0018) judge a concept's elements with its parts in `_schemas.js` before and after their change, so their verdicts are this form's, and report them only.
- **Repair:** none yet. `graph update-node` (A10.21) changes an element's fields, and `graph add-to-concept` (A10.22) gives it another concept's section.
- **Enforced by:** the guard of `graph create-element`, run in its write once it has taken the lock on the concept's header and built the element's JSON, since that JSON comes from the graph. The rule's code is in `src/operations/rules/element-fits-schema.js`. The check it uses is in `src/operations/catalog/graph/_schemas.js`, which `graph create-set`, `graph update-node`, `graph add-to-concept` and the derive step (`src/lib/derivers/schema-verdicts.js`) call too, and the property operations (A10.18), over the nodes they write. Built in story graph-operations-first-slice #20 (ADR graph-operations-first-slice/0020), and made to judge tapestryJson in story #42 (ADR graph-operations-first-slice/0042).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0020, ADR graph-operations-first-slice/0020a and ADR graph-operations-first-slice/0042.

## 8. `node-has-a-concept`

- **Says:** every node is an element of at least one concept other than word: some concept's class thread reaches it, from the concept's header to its superset, down through its sets, to the node (design D9; BIBLE §10, rule 3). A concept keyed `word` or `graphContext`, the keys an element's JSON keeps for itself, doesn't count: word's class thread reaches nearly every element, through the other concepts' supersets under its own. Membership is read through the class thread, never from a node's direct links alone, since a firmware install's prune can take out a superset's direct link to an element it also reaches through a set (memo #117 on A10.22). Tags and change entries are parts of letters and of the history, not elements, and are exempt.
- **Kind:** a graph rule, about the owner's and the admins' own writes (D4). As a check it judges every node, whoever made it.
- **Refuses or reports:** it refuses the write, before anything changes: `last-concept` (409) when taking a node out of a concept, or out of one of its sets, would leave it an element of no concept but word. The refusal names the concept and says how to go on: add the node to another concept first (`graph add-to-concept`), or delete it (`graph delete-node`). Taking a node out of a concept that doesn't reach it is a repeat, not a refusal.
- **Check:** the same `violations` over a set of nodes, each as `{ node }`, names each node no concept but word reaches. `rules check` (A10.31) will run it over the graph. Person nodes and placeholders are elements of no concept today, so the check names every one until they are given one (ADR graph-operations-first-slice/0022, follow-up 6). `graph unlink-set` can still leave an element of no concept, and so can today's `POST /api/normalize/delete-relationship`, which doesn't check for a node's last concept.
- **Repair:** `graph add-to-concept` gives a node of no concept one; `graph delete-node` deletes one of the instance's own.
- **Enforced by:** the guard of `graph remove-from-concept`, as `{ node, concept, set }`: the node judged as if every link by which the concept, or the set, reaches it were gone. The write runs the rule again after its delete, inside the same transaction, as a check of the node, so two removals at once of a node's last two concepts can't both pass it. The rule's code is in `src/operations/rules/node-has-a-concept.js`, and what it reads with is in `src/operations/catalog/graph/_memberships.js` and `src/operations/catalog/graph/_fields.js`. Built in story graph-operations-first-slice #22 (ADR graph-operations-first-slice/0022).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0022.

## 9. `tapestry-link-names-a-node`

- **Says:** every `tapestry:` link in the markdown of the instance's own nodes names a node in this graph. Its key is the key of a node in this graph other than a change entry or a tag, whatever the point of view. A `tapestry:` link means "in this graph" (ADR graph-rules/0002, Decision 2), so a key no such node has is a dead link, such as one to a node deleted since, or a key from another instance.
- **Kind:** a graph rule, about the instance's own nodes (D4). Links in other people's letters are left alone, and a `nostr:` link to a node this graph doesn't hold isn't judged, since its letter may be on a relay.
- **Refuses or reports:** it only reports. `graph delete-node` leaves the links to a node dead, and a renderer is to show a dead link as its text (ADR graph-rules/0002, Decision 4).
- **Check:** a check finds each `tapestry:` link in the markdown of the instance's own nodes, reading a value held as an `lmdb:` pointer from the text it resolves to (ADR graph-rules/0002, Decision 6), and names each link whose key no such node has, with the node that holds it. It reads markdown with a CommonMark parser, so that examples in code aren't read as links and reference definitions are (the ADR's Implementation notes). `rules check` (A10.31) will run it over the graph.
- **Repair:** none yet. `graph update-node` changes an element's fields, and `graph update-concept` a concept's description: point the link at a node that exists, or make it plain text.
- **Enforced by:** nothing yet. `rules check` (A10.31) will.
- **Status:** proposed.
- **Source:** ADR graph-rules/0002.

## 10. `enumerated-value-allowed`

- **Says:** each value of a field that a link makes enumerated is `tapestry:<tapestryKey>`, naming an element of the link's source concept that counts from the owner's point of view. A link is one `ENUMERATES` from the source concept's superset to the field's property node, carrying only its type (`graph enumerate`; ADR graph-operations-first-slice/0019). A field of type string holds one such value, and a list of strings any number, each judged on its own; a `null`, as a field's value or as an item of a list, and a field left out, aren't judged. A value that names a node any other way, by its name, its slug or its address, isn't allowed. The allowed values are the source's elements as they are when a value is checked, read through the source's class thread from its superset, and no copy of them is kept: an element added to the source is allowed from then on, and one taken out of it, or deleted, no longer is, with no further call.
- **Kind:** a graph rule, about the owner's and the admins' own element writes (D4). The link may have been made by `graph enumerate` or by today's `POST /api/normalize/enumerate`, which write the same edge. A value counts from the owner's point of view as a read's node does (ADR graph-operations-first-slice/0011): the instance's own, one with no author, or one whose author the owner's web of trust scores above the verified cutoff. So the same value can be allowed today and not tomorrow, as the owner's scores change.
- **Refuses or reports:** it refuses the write, before anything changes: `value-not-allowed` (400) when the JSON the write builds holds, at an enumerated field, a value that isn't a reference, a reference whose key names no node, or one naming a node that the source doesn't hold, or doesn't hold from the owner's point of view. The refusal names the field by its place under the concept's key, each value and why it isn't allowed, and the source concept by its name and its tapestryKey, and gives the way on: `graph resolve` turns a name into its key, `graph list-elements` on the source lists its elements, and `graph create-element` there adds one. Nothing that today's routes or an import write is judged (D15).
- **Check:** for each concept of the items, the rule's first read finds its enumerated fields: each `ENUMERATES` from a superset to a property node that hangs, by a chain of `IS_A_PROPERTY_OF` through property nodes only, under the concept's primary property, each chain giving the field's place. An edge to a JSON schema node is never one, so firmware install's own enumerations, which end there with a `destinationPath`, aren't read, and a property hung on the schema node too, as today's enumerate route left one before story graph-operations-first-slice #45, is found by its chain. A concept with none costs that read alone. The second read judges every reference the items hold, all in one `UNWIND`. `graph enumerate` reports with the same check, over the property's concept's elements from their JSON, those whose values the link doesn't allow, and refuses none. Values already written aren't judged again: `rules check` (A10.31) will run it over every element, in a node form not built yet, and report each value that no longer names an allowed element.
- **Repair:** none yet. `graph update-node` gives an element's field a reference, such as `--fields '{"project": "tapestry:<tapestryKey>"}'`, and `graph unenumerate` takes the link out, after which the field's values are judged by its schema alone.
- **Enforced by:** the guards of `graph create-element`, `graph update-node` and `graph add-to-concept`, run in each write right after rule 7's, over the same JSON, once the write holds its locks: create-element's for the concept it names, update-node's for each concept whose section the call changes, naming every finding in one refusal, and add-to-concept's for the concept it names, when the call changes the node's JSON. The rule's code is in `src/operations/rules/enumerated-value-allowed.js`, and its two reads and its check are in `src/operations/catalog/graph/_enumerations.js`. It takes no lock of its own: a source changed by another write at the same moment can let through a value that no longer names an element, which `rules check` will find. Built in story graph-operations-first-slice #19 (ADR graph-operations-first-slice/0019).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0019.

## 11. `property-has-one-parent`

- **Says:** every property node that hangs under anything hangs, by `IS_A_PROPERTY_OF`, under exactly one node. A concept's primary property (the node with `IS_THE_PRIMARY_PROPERTY_FOR` to its header) hangs under its own concept's JSON schema node; every other property hangs under a property: its concept's primary property at the top level, or its parent property when nested (BIBLE §6). A property under no parent isn't judged, since `POST /api/normalize/generate-property-tree` unhooks the properties a new schema drops on purpose. A property node with two parents leaves its concept's tree tangled, and the property writes refuse such a concept (`tangled-tree`, ADR graph-operations-first-slice/0018).
- **Kind:** a graph rule, about every property node, whoever made it.
- **Refuses or reports:** it only reports. No write the operations make can break it, and the property writes already refuse a tangled tree.
- **Check:** `rules check` runs it over the whole graph, one concept (its primary property, its property tree, and what hangs directly on its JSON schema node) or one node: the rule's `scan` lists every property node with a parent in the scope, and its `violations` judges them. Each of its reads runs over every item at once: three judge each node's shape, one more reads what the primary properties hang under, and the rest, which find each finding's concepts and what its parents are, run only for the findings. Each finding has a code: `more-than-one-parent`, `parent-not-a-property` or `primary-property-misplaced`. It names the node, the concepts whose trees hold it, and each parent with what it is (a primary property, a property, a JSON schema node or another kind of node) and whether it belongs to the node's own concept. A finding has an id, which changes when the node's parents do. Today's `POST /api/normalize/enumerate` broke it before story graph-operations-first-slice #45, by hanging a property on its target concept's schema, and so did `POST /api/normalize/create-property`, by hanging a top-level property on the schema and giving one name under two parents one node.
- **Repair:** `rules repair` takes off a property's `IS_A_PROPERTY_OF` to its own concept's JSON schema node when the property also hangs under one parent in that concept's tree, keeping that link, in one recorded write that signs nothing. It changes the instance's own concepts, and a firmware concept only with `firmwareOverride: true`. Every other finding is left as a choice, with why and the way on: a concept that isn't the instance's own is its author's claim (D4); a node two concepts' trees share, or one under two properties of a tree, has no operation to take one link out yet; a property hung only on a schema node gets a node in its tree from `graph add-property` or `graph set-schema`; a misplaced primary property has `POST /api/normalize/skeleton`. The repair names the relationship elements that still record a link it took off, which `graph delete-node` deletes.
- **Enforced by:** a check: `rules check`, with `rules repair`. The rule's code is in `src/operations/rules/property-has-one-parent.js`; the operations are `src/operations/catalog/rules/check.js` and `src/operations/catalog/rules/repair.js`, with what they share in `src/operations/catalog/rules/_rules.js`. Built in story graph-operations-first-slice #45 (ADR graph-operations-first-slice/0045).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0045.

## 12. `word-types-hold-concept-keys`

- **Says:** a node's `wordTypes` hold the key of each concept whose class thread reaches it. The design's D10 says "edges are the authority on which concepts a node belongs to; the JSON's `wordTypes` and `coreMemberOf` are computed from them", and a node belongs to every concept whose class thread reaches it (rules 7 and 8). A concept's key is its `oKeys.singular`, the key its elements' sections are filed under. The keys `word` and `graphContext`, which an element's JSON keeps for itself, are expected of no node. The JSON judged is the node's JSON as the writes keep it: its `json` tag, with the owner's sections kept beside another author's letter or firmware's definition (`tapestryOwnSections`) laid over it, as the writes and the derive step read a node; a section kept beside adds its key to `wordTypes` there. Only the string entries of `word.wordTypes` count, and only when it is a list, so JSON with no word block, or no `wordTypes`, lacks every key. A key for a concept that doesn't reach the node, and the order of the list, aren't judged (ADR graph-operations-first-slice/0047, Decisions 1 to 4).
- **Kind:** a graph rule, about every node a class thread reaches. As a check it judges every node, whoever made it, as every operation's read finds a node: one labelled `TapestryNode`.
- **Refuses or reports:** it only reports. No write is refused for it, and no write's answer changes; the writes already put the key in (`graph create-element`, `graph create-set` and `graph add-to-concept`) and take it out (`graph remove-from-concept`).
- **Check:** `rules check` runs it over the whole graph, one concept (its header, its core nodes, its class thread's sets and the nodes they reach) or one node. Its `scan` lists the nodes; its `violations` reads, for all of them at once, the concepts whose class threads reach each node, their headers' keys, and each node's `json` tags and kept-beside sections. It names a node once for each key it lacks, with the concept whose key it is and that `key`, code `missing-concept-key`. A node some concept other than word reaches whose JSON it can't read isn't named: it is counted in the answer's `notJudged`, by why. That is `no-json` for a node with no `json` tag and no sections kept beside it, and `unreadable-json` for two `json` tags that differ, a tag that doesn't parse or that holds no object, or kept-beside sections that aren't JSON of an object. A finding's id covers its key and its concept, so a node's two findings have two ids.
- **Repair:** none. `rules repair` leaves each finding, with why and the way on. A firmware reinstall gives firmware's own nodes their keys: an install writes a JSON schema's word types from the code's one list of them, and a header's from its firmware file (story graph-operations-first-slice #47, ADR graph-operations-first-slice/0047 Decisions 8 and 9). For any other node a repair is still to come. `graph add-to-concept` adds a concept's key to one of the instance's own nodes when it gives the node the concept's section, or puts it in one of the concept's sets, and changes nothing for a node that already holds both.
- **Enforced by:** a check: `rules check`. The rule's code is in `src/operations/rules/word-types-hold-concept-keys.js`; the operations are `src/operations/catalog/rules/check.js` and `src/operations/catalog/rules/repair.js`, with what they share in `src/operations/catalog/rules/_rules.js`. Built in story graph-operations-first-slice #47 (ADR graph-operations-first-slice/0047).
- **Status:** enforced.
- **Source:** ADR graph-operations-first-slice/0047.
