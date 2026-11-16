# Story 41: The graph rules as a concept on every instance, made from the rulebook

**Status:** Done
**Created:** 2026-11-15
**Type:** Feature
**Loom:** A10.41 — https://loom.brainstorm.world/t/A10.41

## Background

The owner wants one place to read the concept graph's rules, inside a Tapestry instance (Loom P-155: "I would like to have one place where all of the Rules are stored. Where should that be and in what format? Where else and how else but as a concept inside a Tapestry instance! One candidate instance would be david.tapestry.ninja.").

ADR graph-rules/0001 (Loom A7.6) settled what that concept holds and where its words come from:

- **A graph rule** is one sentence that a graph or an event meets or breaks: a program can check it and answer pass or fail. It either refuses a write or only reports (Decision 1).
- **Each rule's wording is written once, in the rulebook,** `docs/GRAPH_RULES.md`. Anything else that shows the rules, the graph rule concept included, "is made from the rulebook, never kept by hand" (Decision 5).
- **Each entry has a status and a source** (Decision 6): proposed, enforced or retired, and the TIP or ADR that brought it in.
- **The concept's name is "graph rule"** (Decision 10), narrower than the general `rule` concept one author keeps on avi.tapestry.ninja.

Loom's done-when for A10.41: "firmware installs the concept on a fresh instance with one item for each rule in the rulebook, made from the rulebook and the rules' code rather than by hand."

What the story starts from:

- **The rulebook has six entries,** all enforced and all about the graph. None is about events yet. Each entry gives what the rule says, its kind, whether it refuses or reports, its check, its repair, what enforces it, its status and its source. Two say more: entry 2 lists the relationship types it reserves, and entry 3 gives its naming convention.
- **Five of the six have code,** one file each under `src/operations/rules/`. Each file declares the rule's name, a one-line summary, whether it refuses, and its refusals, each with a code, a status and when it happens. The rulebook's entries list the same refusal codes. Entry 1, "Every node has a unique tapestryKey", is enforced by the database and by every path that makes a node. It has no rule file, so it has no name.
- **Firmware installs each element of a concept from a file of its own** (BIBLE §7). Today those files are written by hand. The relationship type concept's 14 elements are the precedent, and rule 2, `relationship-type-allowed`, reads what it allows from them. Firmware signs each concept and element as the instance's assistant and keeps them in the instance's own relay.
- **A reinstall doesn't change an element that is already there.** It rebuilds each firmware concept's header from its definition (OPEN.md row 8), but its element step skips an element whose name the concept already has: create-element refuses it as "already exists". So a changed element file never reaches an instance that installed the earlier one.
- **No instance has the concept yet.** None of the local instance's 46 concepts is for rules. Nor is any of david.tapestry.ninja's 51, read on 2026-11-15 by the session that drafted A10.41.
- **The rules operations will read it.** Once A10.31 is built, `rules list-rules` answers from these items, and `rules check` names the item each violation breaks (catalog §4).

The story sits in this epic as story 41, numbered by its Loom task like the rest of block A10. Unlike the epic's other stories, it adds no graph operation. It gives the rules operations (A10.31) the items they will read.

## User-facing description

As the owner of an instance, or anyone who reads its concept graph, I want to read the graph's rules in the graph itself, one item per rule, so that I can see what the graph holds itself to without opening the code.

As a teammate who writes or changes a rule, I want the graph's items to follow the rulebook and the rule's code, with no second copy to keep, so that the graph never says something the rulebook doesn't.

As an agent, I want to find each rule by its name, so that once `rules check` lands, a violation can name the rule it breaks.

## Acceptance criteria

- [ ] **AC1 — The concept is installed.** Given a fresh instance, when firmware is installed, then the graph holds the graph rule concept, `39998:<TA>:graph-rule`, named "graph rule" (plural "graph rules"), with its eight core nodes like every firmware concept. Its description says what a graph rule is, in ADR graph-rules/0001's words. The fresh-instance check runs on a scratch stack, never on a shared or private instance.
- [ ] **AC2 — One item for each entry in the rulebook.** On the same instance, the concept has exactly one element for each entry in the rulebook, and no others: six today, entry 1 included. Each validates against the concept's JSON Schema, and each is found by its rule's name, such as `relationship-type-allowed`.
- [ ] **AC3 — What an item says.** Each item holds its entry's fields as the rulebook writes them, each as a field of its own:
  - its name;
  - what it says;
  - whether it is about the graph or about events;
  - whether it refuses a write or only reports;
  - its check, its repair, and what enforces it;
  - its status and its source;
  - anything else its entry says, such as entry 2's reserved types.

  An item whose rule has code also holds what the code declares: its summary, whether it refuses, and each refusal's code, status and when. Entry 1's item, with no code behind it, holds the rulebook's fields only.
- [ ] **AC4 — Made, not kept.** When an entry's wording or a rule's code changes, the item says the new thing after firmware is installed again. Nobody writes an item, or any copy of one, by hand. The rulebook and the code can't drift apart unseen: a test fails, naming the rule, when:
  - a rule file has no entry in the rulebook;
  - an entry names a rule file that isn't there;
  - an entry and its code disagree on whether the rule refuses a write, or on its refusal codes and their statuses.
- [ ] **AC5 — A reinstall brings an instance in line, and leaves the rest alone.** Given an instance whose firmware was installed from an older rulebook, when firmware is installed again, then its items match the rulebook as it now is. A new entry gains an item, and a changed entry's item changes. Every item keeps its address, so whatever points to it still does. Nothing outside the concept changes because of it (BIBLE §30), and every other firmware concept comes out of the install as it does today.
- [ ] **AC6 — It reads like any concept.** `GET /api/concept-graph/summaries` lists the concept with its six elements, `graph list-elements` (A10.11) pages through them, and the concept's page in the UI lists them. The rulebook says that its entries are installed as this concept, and BIBLE §7 lists it among firmware's concepts.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- `39998:<TA>:graph-rule` — graph rule (new): the concept this story adds, and its items.
- `39998:<TA>:relationship-type` — relationship type (read, unchanged): the precedent for a firmware concept whose elements a rule reads.
- `39998:<TA>:concept-header` — concept header (read): the new header becomes one of its elements, as every firmware concept's does.
- This changes firmware's concept definitions, so firmware must be reinstalled (AGENTS.md §6).

## Out of scope

- **`rules list-rules` and `rules check`** reading the items (A10.31).
- **Links from a rule to the TIP that brought it in, or to the glossary words it uses.** Each needs its relationship type declared first, since rule 2 refuses undeclared types. Neither the TIP concept nor a glossary entry concept exists yet (Loom P-49, and the glossary proposal).
- **New rules.** BIBLE §10's eleven rules and design §7's draft core rules enter the rulebook one at a time, each in its own change, as ADR graph-rules/0001 says.
- **A rule file for entry 1,** which would let `rules check` run it. Its entry gets a name here (open question 1), not code.
- **Editing a rule in the graph.** Rules are changed in the rulebook. An item someone edits in the graph is put back by the next reinstall (AC5).
- **Which items count when other authors publish graph rule items of their own.** Publishing stays open to anyone (principle 2). Which items a point of view reads is for A10.31, at read time.
- **Moving the rulebook under `protocols/`**, or into the TIPs.
- **Getting the concept onto david.tapestry.ninja.** It arrives when that instance runs a release with this change and its firmware is reinstalled (deploy/RUNBOOK.md). Merging to staging and shipping to production wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate, as proposed (the owner's approval, 2026-11-15):

1. **What is entry 1 called?** Every item needs a name to be found by (AC2), and TIPs cite rules by name (ADR graph-rules/0001, Decision 5), but entry 1, the unique tapestryKey, had none. *Resolved:* `tapestry-key-unique`, alongside `concept-slug-unique`, written into the rulebook's entry 1.
2. **Which book?** The first slice's frame covers the operations Avi's brain rebuild needs, and it doesn't name the graph rules. *Resolved:* the story stays in this epic and its open book, since it feeds the catalog's `rules list-rules` (A10.31).
3. **Existing instances (AC5).** The done-when names only a fresh instance. *Resolved:* a reinstall also brings an existing instance's items in line. Otherwise david.tapestry.ninja would keep its rules as they stood at its first install, since a reinstall skips elements that are already there.

For Architecture, not this gate:

- **How the items are made** from the rulebook and the code: at install time, or as files firmware reads that a check keeps in line. Also how the rulebook's Markdown becomes fields.
- **The concept's schema:** field names, whether text is Markdown or plain, and room for what an entry says beyond the usual fields. One word needs settling. The rulebook's "Kind" calls a rule about the graph "a graph rule" and a rule about events "a letter rule", yet the concept as a whole is named "graph rule". An item's kind field needs another word, such as Loom's "about the graph or about events".
- **Each item's address,** so it stays put across reinstalls and A10.31 can name it.
- **What a reinstall does with an item whose entry has left the rulebook.** The ADR retires a rule rather than removing its entry, so this should be rare.
- **Whether firmware's usual signed path suits these items,** and which category and sets, if any, the concept gets.

## Evidence

### The live check (Implementation, 2026-11-16)

This ran on a throwaway instance booted from image `agent-memory-tapestry:latest`, with fresh volumes and no published ports, never on a shared or private instance. It had this branch's `src/` mounted. Before the instance's first install, its graph held no concept, and this branch's firmware was copied into it (see Deviations). By criterion:

- **AC1, AC2, AC3 and AC6 pass.**
  - The first install, which took 85 s, created the concept and logged `graph-rule: 6 to create`.
  - `test/graph-rule-firmware.test.js` against the instance passed 17 of 17.
  - GL1: `summaries` lists `39998:<TA>:graph-rule` as "graph rule" with six elements, and it has the eight core nodes relationship-type has.
  - GL2: each item is at an address of the instance's own, `39999:<TA>:<name>-1b2c3b2d`, and holds its committed file's JSON.
  - GL3: `tapestry graph list-elements` gives the six.
  - The concept's page in the UI wasn't opened, since a scratch instance has no published ports. The page reads the same concept graph.
- **AC4 passes.** After an item's file changed, its JSON in the graph said the new words.
- **AC5 passes.** Every install took about 63 s and logged its outcome for the concept. A whole-graph fingerprint (every node with an address, its labels and tags, and every relationship) was compared before and after each install:
  - **No change** (GL4, then again): `0 to create, 0 re-signed in place, 6 already in line`. Every item kept its address and its event, and no relationship changed. The rest of the graph changed only as every reinstall changes it: the 44 tag nodes of the headers a reinstall re-signs get new addresses.
  - **One item's file changed** (class-thread-acyclic's `says`): `1 re-signed in place, 5 already in line`. That item kept its address, got a new event and kept its 5 relationships, and the other five kept their events. Beyond the 44, the only node that changed was that item. Its 4 tag nodes were re-keyed too, as regenerateJson re-keys them on every re-sign.
  - **A seventh entry's file added:** `1 to create, 6 already in line`. Beyond the 44, the graph gained that item, its 4 tags and its one `HAS_ELEMENT`, and nothing else changed.

## Deviations

- **ADR 0041 gained Amendment 1 at Test Design.** It pins the shapes the tests read: the script's three parts and their problems, `planElement`'s arguments and answers, and how the schema states Decision 2's values. It also says install finds the concept's header by its address, never by name. That is what Pass 2 began doing while this story was in Architecture (graph-operations-foundation #10, TapestryProtocol/tapestry#80).
- **The rulebook's preamble says more than Decision 8 listed.** As well as "In the graph", it now describes the format the script reads: a field's bold label, its indented continuation lines, how a refusal is written, and that a rule with code names its file.
- **The live check put this branch's firmware into the scratch instance by hand.** `scripts/scratch-stack.sh` mounts only `src/`, so the firmware would have come from the image, which predates this branch. Mounting a copy of the firmware from the session's temporary folder failed: Docker Desktop doesn't share that folder, so the mount came up empty and the control panel exited. So the check booted the instance with `src/` mounted, copied the branch's firmware in, and restarted the control panel before the first install. The instance's first install therefore included the graph rule concept. Giving the stock script a firmware mount is a possible follow-up.
- **What review round 1 changed** (ADR 0041 Amendment 2), with its new tests added first, in a commit of their own:
  - **BIBLE §7, the manifest's changelog and the ADR now say what install does with an item edited in the graph.** Install compares the item's JSON in the graph with its file, so it puts the edit back, whether or not the file changed. Before, all three said such an item was left alone while its file was unchanged.
  - **The rulebook's format is stricter.** Each of these is now a problem: a line after a field that isn't indented, a level-2 heading that isn't an entry's but holds something in backticks, and a field line outside any entry. Before, the first joined the field before it, and the second dropped its entry without a word (GP12 to GP14). The rulebook's preamble lists the eight labels and the format.
  - **A description is the whole first sentence.** It no longer ends at an "e.g." or an "i.e." (GP15).
  - **A stack-free test runs Pass 1 itself,** with its dependencies stubbed in a child process (IS4 to IS9, and IS10 from review round 2: with another author's element read first, the assistant's is the one re-signed).
  - **BIBLE §7's category lines match the manifest.**
- **Known limits, carried forward:**
  - **create-element still finds its concept by name,** as it does for every firmware concept. #80 fixed that for schema saves only. Another author's header named "graph rule" could take the instance's own header's place when the items are first made. Once instances import one another's assistant-signed "graph rule" headers, that becomes likely, as #80's "tag" bug showed. An update finds the header by its address, so it isn't affected. This is tracked in `ledger/2026-10-02-normalize-lookups-by-concept-name.md`, which now notes graph rule's case.
  - **Another author's element with a rule's name stops firmware making its own** (ADR 0041 Consequences). Install logs it and signs nothing over it.
  - **An item whose entry leaves the rulebook stays on instances that have it.** Nothing deletes it.
  - **After a re-sign, an item's LMDB entry keeps its earlier words.** Pass 3's derive builds each entry on top of the one already there (`src/lib/derivers/word.js:43–44`). So after a rule changes, the item's json tag has the new words and its LMDB entry the old, as after every re-sign: Pass 2's schema saves, and the element page's save. Whatever reads the rules should read the json tag, as `relationship-type-allowed` does; that includes `rules list-rules` and `rules check` (A10.31). OPEN.md row 137, the LMDB doctrine row, now notes this case.
  - **AC6's UI page, since opened on staging.** A scratch instance has no published ports, so the live checks read the concept through the API. On 2026-11-16, after #86 reached staging and staging's firmware was reinstalled, the concept's elements page on staging.brainstorm.world listed its six items, each explicit, implicit and valid against the schema, with no console errors. OPEN.md row `2026-11-16-graph-rule-ui-page-unchecked` is closed.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- The decision behind it: [ADR graph-rules/0001](../../decisions/graph-rules/0001-graph-rules-tips-and-glossary-entries.md) (Loom A7.6, from P-154)
- The rulebook: [docs/GRAPH_RULES.md](../../../docs/GRAPH_RULES.md)
- The operations that will read it: catalog §4 in [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md) (A10.31)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0041-graph-rule-concept.md](../../decisions/graph-operations-first-slice/0041-graph-rule-concept.md)
- Test plan: [41-graph-rule-concept.test-plan.md](41-graph-rule-concept.test-plan.md)
- Review: [engineering-team/reviews/graph-operations-first-slice/41-graph-rule-concept.md](../../reviews/graph-operations-first-slice/41-graph-rule-concept.md)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
