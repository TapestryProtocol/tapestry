# Story 27: `graph create-set` — make a set under a concept's superset or another set, with no event

**Status:** Approved
**Created:** 2026-11-16
**Type:** Feature
**Loom:** A10.27 — https://loom.brainstorm.world/t/A10.27

## Background

Loom's A10.27 asks for one graph write (catalog §2, Sets):

- **`graph create-set`:** "A set under a superset or another set", taking `parent`, `name` and `description?`, and answering "the tapestryKey; safe to repeat by name under the parent". It "refuses a parent that isn't a superset or a set".

Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/create-set` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI." It is the rebuild's set write, and the last task the rebuild (A10.39) waits on: create-concept (A10.16) makes each concept of Avi's brain, this operation makes its sets, and create-element (A10.20), which can already put an element in a set, makes its elements. `graph delete-set` (A10.17) and `graph move-element` (A10.23) will work on the sets it makes.

Twelve facts about today's instance shape the story:

- **Today's create-set signs.** `POST /api/normalize/create-set` (`handleCreateSet`, `src/api/normalize/index.js`) takes the parent by uuid, or a concept's name, taking the first header whose names match. It signs a set event, with the tags `d`, `name`, a `z` naming the set concept, an `s` naming the parent, and `description` when given, and a relationship event naming the pair. It stores both in the instance's relay, then labels the node `Set` and links the parent to it. Its d-tag is the name's slug and an eight-character hash of the parent's address (`dtag.childDTag`). A node already at that address answers success, "already exists", whatever the node is. It checks that the parent exists, not what it is. It doesn't make the set an element of the set concept: a firmware reinstall's pass 1d does that later, from the `z` tag.
- **Today's add-subset doesn't sign.** `POST /api/normalize/add-subset` (`src/api/normalize/nodes.js`; ADR node-primitives/0001, amended by ADR graph-operations-foundation/0003 Decision 9) makes the node today's create-set would leave, at the same address, with no event: the labels `ListItem` and `Set`, a tapestryKey, the same tags, and no `NostrEvent` label or `id`. It refuses a parent that carries neither `Superset` nor `Set`. A set with the name already directly under the parent, by any author, with a letter or without, is a repeat, compared trimmed and without regard to case. A node at the address that isn't that set is refused (409). It links the parent to the set and makes the set an element of the set concept, in one statement, and its answer says that only a Neo4j backup keeps the set (BIBLE §30). It is owner-only, and isn't an operation of the new stack.
- **No set carries JSON today.** Firmware's set files hold a `word` block and a `set` section with the set's name, slug, title and description (`firmware/versions/v1.0.0/concepts/*/sets/*.json`). But install passes only the name, the description and the d-tag to today's create-set, so the JSON is dropped, and neither of today's routes writes a `json` tag. The set concept's JSON schema asks for a `set` section holding a `slug`, with `name`, `title` and `description` as text when given. So `element-fits-schema` (BIBLE §10, rule 4; the rulebook's entry 7), run as a check by `rules check` (A10.31), will report every set in the graph today as an element whose JSON can't be checked.
- **A set is an element of `set`, and of `word`.** Firmware puts the set concept's superset under word's (`manifest.json`, `sets.words['existing-sets']`), so every element of `set` is an element of `word` too. word's schema asks for `graphContext`, a key only the derive step writes (ADR graph-operations-first-slice/0020 Amendment 1), so no JSON a write stores fits it.
- **What counts as a set and a parent.** link-set and unlink-set count a node as a set when it is labelled `Set` and not `Superset`, and as a superset when it is labelled `Superset`, in each case only when it has an address, its `uuid` (ADR graph-operations-first-slice/0028 Decision 5 and Amendment 3). A parent is either. The trust pipeline's card sets carry `Set` with no address (370,377 of staging's 370,401 `Set` nodes; ledger row `2026-11-15-card-sets-carry-the-set-label`), so they count as neither. create-element and list-elements read a set the same way.
- **A class thread is a chain of links.** A concept's header points to its superset (`IS_THE_CONCEPT_FOR`), the superset to its sets and each set to the sets below it (`IS_A_SUPERSET_OF`), and a superset or a set to its elements (`HAS_ELEMENT`). A node is an element of every concept whose class thread reaches it (BIBLE §10, rule 3). A set may have more than one parent, and link-set can put one concept's superset under another's, so one set can be in several concepts' class threads.
- **A new set can't break link-set's rules.** A set just made has one parent and nothing below it. So it closes no cycle (`class-thread-acyclic`), has a parent (`set-has-a-parent`), and makes no firmware link redundant (`firmware-prunes`), whatever its parent.
- **The link is kept for this operation.** `graph add-relationship` refuses `IS_A_SUPERSET_OF` as `reserved-type`, "made by graph link-set and create-set" (rule `relationship-type-allowed`), and create-element refuses to make an element of the set concept (`made-elsewhere`), naming this operation. So until create-set lands, no operation of the new stack can make a set.
- **Nodes with no event, and the creates' repeats.** `_eventless.js`'s `makeNode` (ADR graph-operations-first-slice/0016 Decision 1) makes the node the nostr import would make of the letter a write would sign, with no event, so every reader of an imported node reads it, and a letter published for it later lands on the same node. create-concept's repeat is by slug, and create-element's is by name within the concept. Both count only this instance's own nodes, with a letter or without: another author's is never the repeat (ADR 0020 Decision 6, approved by the owner, 2026-11-16). Each takes a write lock first, so two calls at once make one node: create-concept on the concept-header concept's header, create-element on its concept's header.
- **Two creates under different locks can race.** Ledger row `2026-11-16-shared-set-creates-can-race`, from A10.20's review: two create-elements holding different concepts' locks can each make an element of one name in a set both concepts' class threads reach. The rebuild may run creates in parallel.
- **A reinstall may take a set out of the set concept.** Its pass 1e deletes a firmware concept's superset's direct `HAS_ELEMENT` to a node it also reaches another way, through two to twelve class-thread links (`src/firmware/install.js`). The set concept is one of those it prunes, and a new set's parent is itself an element of `set`. That is the path ledger row `2026-11-15-reinstall-drops-a-supersets-own-membership` suspects of dropping a superset's membership. add-subset's set kept its membership through a reinstall in story node-primitives #1's live check, so this is unconfirmed.
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command, and both CLIs turn a command line's text into an operation's inputs. create-set's inputs are all text, so it reaches agents with no change to either.

## User-facing description

As an admin agent rebuilding a concept graph, or the owner, I want to make a set under a concept's superset or under another set, without signing anything, so that a concept's elements can be sorted into sets privately, and a step that failed partway can simply be run again.

As the same agent, I want to be told when the set I asked for already exists under that parent, and what differs from what I gave, so that I don't make a second one.

As the same agent, I want a parent that isn't a superset or a set refused, with the key to pass when I gave a concept's header, so that every set the operations make sits in a class thread every reader of the graph can walk.

## Acceptance criteria

- [ ] **AC1 — Make a set.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/create-set` with `parent`, the tapestryKey of a concept's superset or of a set, and `name`, with `description` if they like, then the graph holds a new set directly under `parent`: one link from `parent` to it. The class thread of every concept that reaches `parent` now reaches it, so an element put in it later belongs to each of those concepts. It is an element of the set concept. It has a tapestryKey under the shared label, its name as its tapestryValue (D11), and no `NostrEvent` label (D7). It has the address and tags a letter for it would carry: the address today's create-set and add-subset give the name and parent, and the tags `d`, `name`, a `z` naming the set concept's header, an `s` naming the parent, then `description` when one is given, and `json` (open question 1). The name is trimmed and checked as create-concept checks a name, and the description as create-concept checks one. The answer gives the set's tapestryKey and address, its parent, the concepts whose class thread reaches it, `outcome: created`, and the change entry, which `graph history` finds by the set or by the parent. `graph list-relationships` on the parent lists the new link, and `graph list-elements` on the set concept lists the set. Nothing is signed or sent to a relay.
- [ ] **AC2 — Its JSON fits the set concept's schema (rule 4)** (open question 1). The set's JSON is word-wrapper JSON: a `word` block naming it, and a `set` section holding its name, its slug and, when given, its description, as firmware's set files hold them. Before anything is written, it is checked against the set concept's JSON schema, with the check create-element uses (`element-fits-schema`). JSON that doesn't fit is refused (`invalid-fields`), naming every problem, and a set concept whose schema is missing or can't be read is refused (`no-schema`); either way nothing changes and no entry is recorded. For each other concept the set is an element of, such as `word`, the answer says whether its JSON fits that concept's schema too, and those don't stop it.
- [ ] **AC3 — Safe to repeat by name under the parent.** Given one of this instance's own sets, with a letter or without, is already directly under `parent`, and has the name (once cleaned, without regard to case) or the address the name and parent give, create-set changes nothing, records nothing, and answers `already-exists` with that set. It names in `differs` each input that differs from what the set holds: the name, when it differs at all, case included, and the description, when one is given. Two calls at once with the same name under the same parent make one set. A set with the name under another parent isn't a repeat. Nor is another author's set under `parent`: this instance's own is made beside it (open question 2).
- [ ] **AC4 — What it refuses.** create-set refuses each of these, changes nothing, records no entry, and says in words what was wrong, naming the input:
  - a `parent` that names no node of the graph;
  - a `parent` that is neither a superset nor a set: an element, a node with no address such as one of the trust pipeline's card sets, or any other node. For a concept header, the refusal names its superset's tapestryKey, the key to pass (open question 3);
  - a name that is empty once trimmed, has no slug, has a control, text-direction or invisible character, or is longer than 200 characters, as create-concept refuses a name;
  - a description with a control character other than a line break or a tab, or longer than 10,000 characters, as create-concept refuses one. A description that is empty once trimmed counts as left out.

  A parent of any author takes a set: a set under another author's superset or set, such as a shared concept's, is this instance's own claim that it belongs there, and each point of view weighs it (CLAUDE.md principle 2). A firmware concept's superset or set takes one too, such as a set of the owner's own relationship types under the relationship type concept.
- [ ] **AC5 — One reading of a set, for the set writes after it.** create-set reads `parent` as link-set reads a `parent` (ADR 0028 Decision 5 and Amendment 3): the two accept the same nodes and refuse the same ones. That reading is defined once, and `graph delete-set` (A10.17) and `graph move-element` (A10.23) will use it too; the ADR says how.
- [ ] **AC6 — It lasts.** After a firmware reinstall, and after a backup restored on a fresh instance, a set made by this operation is as it was: its tapestryKey, its tags, its JSON, its link from its parent, and its place among the set concept's elements (BIBLE §30).
- [ ] **AC7 — It reaches agents.** The operation is for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph create-set --parent <key> --name <name>` with no sign-in and gets the route's answers, and their entries name the command as who made them. On a scratch stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to the CLI, makes a set under a concept's superset, makes it again and is told it exists, makes a set under that set, is refused a concept header as a parent and given its superset's key, and puts an element in the new set with `graph create-element`.

Seven criteria for one operation. AC5 asks for no new reading of a set: link-set's is the one. AC2 adds no rule: it runs the one create-element brought in.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- `39998:<TA>:set` — set (written and read): the new node is one of its elements, and its JSON schema is the one the set's JSON is checked against (open question 1).
- `39998:<TA>:superset` — superset (read): `parent` may be a concept's superset.
- `39998:<TA>:class-thread` — class thread (read): the new set joins every class thread that reaches its parent.
- `39998:<TA>:word` — word (read): its class thread reaches the set concept's superset, so the new set is one of its elements too; whether it fits word's schema is reported, never refused for.
- No firmware concept's definition changes, and the rulebook gains no rule, so this needs no firmware reinstall.

## Out of scope

- **Making a concept's superset:** `graph create-concept` (A10.16) makes it. create-set makes sets only.
- **Putting an existing set under another parent, or taking it out:** `graph link-set` and `unlink-set` (A10.28). create-set's set has its one parent.
- **Deleting a set** (`graph delete-set`, A10.17), and **changing its name or description** (`graph update-node`, A10.21). A repeat reports what differs and changes nothing.
- **Elements:** putting them in the set is `graph create-element` with `set` (A10.20), `graph add-to-concept` (A10.22) and `graph move-element` (A10.23).
- **Today's sets,** which carry no JSON: a repair that gives them some, and `rules check` (A10.31), which reports them.
- **Uniqueness the set concept's schema asks for beyond the repeat** (`x-tapestry.unique` on a set's slug): two concepts may each have a set called "small". The repeat keeps an instance's own sets under one parent from sharing a name.
- **Naming the parent by its name or address:** `parent` takes a tapestryKey, and an agent calls `graph resolve` (A10.9) first. Taking a ref is the declaration hook A10.9.a builds.
- **Publishing a set** as a nostr event (`export nostr`, A10.34). A set made here is a private thought until then (BIBLE §30).
- **Today's create-set and add-subset routes,** which stay as they are (D15).
- **Bulk creates** (catalog §10, question 6): one set per call.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved all three (2026-11-16).

1. **Does a set carry JSON?** *Resolved: yes: word-wrapper JSON with a `set` section, checked against the set concept's schema* (the drafting's proposal, approved by the owner, 2026-11-16). AC1, AC2. The set concept's schema asks for a `set` section with a slug, firmware's own set files define their sets that way, and an element of a concept must fit that concept's format (BIBLE §10, rule 4; D9). create-element holds every element it makes to that. The sets made here are then ones `rules check` (A10.31) doesn't report. Today's sets, which carry no JSON, stay as they are until a repair gives them some. The other choice is today's shape exactly, with no `json` tag: simpler, and the same for every set, but `rules check` would then report each set made here along with all the others.
2. **Whose set is the repeat?** *Resolved: only this instance's own* (the drafting's proposal, approved by the owner, 2026-11-16). AC3. That is create-element's rule, which the owner approved on 2026-11-16. Another author's set under the parent is their claim, put there by the owner with link-set, and each point of view weighs it. Taking it for the owner's own would leave the owner with no set of their own of that name. The other choice is add-subset's rule: any author's set of the name directly under the parent is the repeat, which keeps one set of a name under a parent.
3. **May `parent` be a concept header, standing for its superset?** *Resolved: no: refuse it, naming its superset's tapestryKey* (the drafting's proposal, approved by the owner, 2026-11-16). AC4. link-set refuses one the same way (story 28, AC3). An agent has the key already: `graph create-concept` answers it among the concept's nodes, as `nodes.superset`. The other choice takes a header as its superset, which saves an agent that one lookup.

For Architecture, not this gate:

- **Two creates at once:** which lock makes two calls with one name under one parent make one set (AC3). Keep ledger row `2026-11-16-shared-set-creates-can-race` in mind, since the rebuild may run creates in parallel, and say whether a create-set waits for a create-element, link-set or unlink-set on the same parent.
- **The address when a node holds it,** such as a set of the name that unlink-set took out from under the parent: versioning nonces, as create-element's.
- **What a reinstall leaves** (AC6): whether pass 1e takes the set out of the set concept, as the ledger row suspects for supersets, and whether to wire what a reinstall leaves, as ADR 0016 Amendment 2 did. The live check decides.
- **The set's word block:** its slug, name, title and `wordTypes`, beside firmware's set files ("the-set-of-…", `["word", "set"]`) and create-element's (`<concept slug>--<element slug>`); and whether the `set` section has a title.
- **Which concepts the answer lists:** those whose class thread reaches the set (create-element's way), beside the concepts it is an element of (set, word).
- **The change entry's shape:** the set, its parent, its name and slug, as create-element's `element-created` records them.
- **How create-set shares link-set's reading of a set and a parent** (`_sets.js`), so delete-set and move-element can use it (AC5).
- **The would-be `s` tag** goes stale when unlink-set takes the set out from under its first parent (ADR 0028, Consequences 2). Nothing here changes that: export (A10.34) reads a set's parents from its links.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild bullet)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D2, D4, D6, D7, D9, D11, D13, D15); catalog §2, Sets
- The event-less set this succeeds: [stories/done/node-primitives/1-event-less-create-set.md](../done/node-primitives/1-event-less-create-set.md); [decisions/done/node-primitives/0001-event-less-add-subset-primitive.md](../../decisions/done/node-primitives/0001-event-less-add-subset-primitive.md)
- The set writes beside it: [28-link-set-and-unlink-set.md](28-link-set-and-unlink-set.md) (ADR 0028)
- The node with no event, the names it checks, and the repeat and lock it follows: [16-create-concept-and-update-concept.md](16-create-concept-and-update-concept.md) (ADR 0016); [20-create-element.md](20-create-element.md) (ADR 0020)
- The rulebook: [docs/GRAPH_RULES.md](../../../docs/GRAPH_RULES.md) (entries 5 to 7)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0027-create-set.md](../../decisions/graph-operations-first-slice/0027-create-set.md)
- Test plan: [27-create-set.test-plan.md](27-create-set.test-plan.md)
- Review: (filled in after Review phase)
