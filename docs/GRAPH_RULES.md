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
