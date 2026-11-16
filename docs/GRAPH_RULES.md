# Graph Rules

**Status:** Draft. This rulebook was started on 2026-11-14 by story graph-operations-foundation #4 (ADR graph-operations-foundation/0004 Decision 12). It holds the rules that are built, one entry each, as the design's §7 asks: "Write each rule into the rules document (§7) as its guard or check is built." Once ratified it moves under `protocols/`, next to `protocols/drafts/tapestry-concepts.md`, and BIBLE §10 shrinks to a pointer (design §7, "Where it lands").

**How a rule is built.** Each rule is defined once and used two ways (design D3):
- as a guard inside each write that could break it;
- in `rules check`, with repair.

Its code is one file, `src/operations/rules/<name>.js`, whose `violations(items, read)` is that one definition. The write path calls it before a write, and `rules check` (A10.31) will call it over the graph.

**What each entry says:**
- what the rule says;
- whether it is a graph rule or a letter rule;
- whether it refuses a write or only reports;
- how a check finds what breaks it;
- how a repair fixes it;
- where it is enforced: by the database, a guard or a check.

## 1. Every node has a unique tapestryKey

- **Says:** each node has a `tapestryKey`, a random v4 UUID set once and never changed, and no two nodes share one. This is the owner's first core rule (design §7) and D6.
- **Kind:** a graph rule, for every node, the web of trust's included.
- **Refuses or reports:** the database refuses a second node with a key another one holds.
- **Check:** `lifecycle status`'s migrations part counts the nodes with no key, and says whether the uniqueness rule is in place.
- **Repair:** `lifecycle migrate --migration tapestry-keys` gives every node that lacks a key one, along with the shared label.
- **Enforced by:**
  - the database: the uniqueness rule `tapestry_key`, on the shared label `TapestryNode`;
  - every path that makes a node: `keyNode`, in `src/lib/tapestry-key-cypher.js`.

  Built in story graph-operations-foundation #3 (ADR 0003). A change entry is a node too, and gets its key when it is made (ADR 0004 Decision 5).

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

## 4. `concept-slug-unique`

- **Says:** no two of this instance's own concepts share a slug or a key. This is BIBLE §10's rule 10, as its full text gives it (tapestry-cli `docs/NORMALIZATION.md`, 2026-03-23): within one author's graph, because a concept's key, `oKeys.singular`, is what its elements' JSON is filed under (`{"dog": {…}}`). A concept is this instance's own when its header's author is the instance's assistant, with a letter or without one. Another author's concept with the same slug is expected, and isn't a violation: the Grapevine settles which one counts (rule 8). Names aren't part of the rule; no rule makes them unique.
- **Kind:** a graph rule, about the owner's and the admins' own concepts (D4).
- **Refuses or reports:** it refuses the write, before anything changes:
  - `slug-in-use` (409): an update gives a concept a slug another of this instance's concepts has, naming it;
  - `key-in-use` (409): a create's name gives a key another of this instance's concepts has under another slug, naming it. A concept's key never changes, so after a slug change, the name the concept was made with stays refused. A create whose slug an own concept already has is the repeat, and answers that concept untouched.
- **Check:** the same `violations` over every own concept, each as `{ concept }`, names each concept that shares a slug or a key with another, both of the pair. `rules check` (A10.31) will run it over the graph.
- **Repair:** none yet. A slug clash is fixed with `graph update-concept --slug`. A key clash needs a concept moved to another key, which no operation does yet.
- **Enforced by:** the guards of `graph create-concept` and `graph update-concept`, run again after each takes its lock, so two writes at once can't both pass it. The rule's code is in `src/operations/rules/concept-slug-unique.js`. Built in story graph-operations-first-slice #16 (ADR 0016).

## 5. `class-thread-acyclic`

- **Says:** no set or superset is below itself. Following class-thread links down from any node, through any number of links and across concepts, never comes back to it. A class-thread link is `IS_A_SUPERSET_OF`, the class thread's propagation link, from a superset or a set to the set or superset directly under it. Only a node with an address, its `uuid`, counts as a set, a superset or a parent, so a link with an address-less end isn't judged: a node labelled `Set` with no address, such as one of the trust pipeline's card sets, isn't a set of the concept graph (ADR graph-operations-first-slice/0028 Amendment 3). The class thread anomaly (BIBLE §10, rule 9) is an element, not a link, so it breaks nothing here.
- **Kind:** a graph rule, about the class threads' links.
- **Refuses or reports:** it refuses the write, before anything changes: `cycle` (409) for a link whose parent is the set itself, or is already below it in the class thread. The refusal names the chain of sets from the set down to the parent, at most twelve of them and then how many more.
- **Check:** the same `violations` over a set of links that are there names each link on a cycle: walking up the class thread from its parent, one level per read, reaches its set. The walk never uses the link itself, so the guard and the check are one definition. `rules check` (A10.31) will run it over the graph's class-thread links, judging each by where it came from (D15). Today's `POST /api/normalize/add-relationship` doesn't check for a cycle, so it can make one, and so can two link-sets at once that close a loop between four sets (ADR graph-operations-first-slice/0028 Decision 9).
- **Repair:** `graph unlink-set` takes out a link on the cycle.
- **Enforced by:** the guard of `graph link-set`, which runs the rule again after its write, inside the same transaction. The rule's code is in `src/operations/rules/class-thread-acyclic.js`, and the walk it uses is in `src/operations/catalog/graph/_sets.js`. Built in story graph-operations-first-slice #28 (ADR graph-operations-first-slice/0028).

## 6. `set-has-a-parent`

- **Says:** every set is directly under at least one superset or set, so some class thread reaches it and its elements. A superset is exempt: its concept's header holds it in its class thread. Only a superset or a set counts as a parent, so an element an old route put above a set doesn't. And only a node with an address, its `uuid`, is judged as a set or counted as a parent: the trust pipeline's card sets are labelled `Set` but have no address, so they are neither (ADR graph-operations-first-slice/0028 Amendment 3).
- **Kind:** a graph rule, about the class threads' sets.
- **Refuses or reports:** it refuses the write, before anything changes: `last-parent` (409) when taking a set out from under a parent would leave it under no other superset or set. The refusal names that parent and says how to go on: link the set under another parent first, or delete it once it is empty (`graph delete-set`, A10.17). Taking out a link that isn't there is a repeat, not a refusal.
- **Check:** the same `violations` over a set of sets, with no parent to leave, names each set under no superset or set. `rules check` (A10.31) will run it over the graph's sets, those with an address, so it reports none of the trust pipeline's card sets. Today's `POST /api/normalize/delete-relationship` doesn't check for a set's last parent, so it can leave one.
- **Repair:** `graph link-set` gives a set with no parent one; `graph delete-set` (A10.17) deletes it once it is empty.
- **Enforced by:** the guard of `graph unlink-set`, which runs the rule again after its write, inside the same transaction. The rule's code is in `src/operations/rules/set-has-a-parent.js`, and what it reads with is in `src/operations/catalog/graph/_sets.js`. Built in story graph-operations-first-slice #28 (ADR graph-operations-first-slice/0028).
