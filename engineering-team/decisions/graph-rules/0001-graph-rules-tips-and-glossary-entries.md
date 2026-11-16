# ADR 0001: What a graph rule, a TIP and a glossary entry each are, and where each rule's wording is written

**Status:** Accepted
**Date:** 2026-11-15
**Story:** none. This ADR answers Loom decision task A7.6, drafted from proposal P-154. Its decider accepts it by merging it.

## Context

The concept graph's rules are written in several places that don't agree:

- **The rulebook**, [docs/GRAPH_RULES.md](../../../docs/GRAPH_RULES.md), started by ADR graph-operations-foundation/0004 (Decision 12). It holds the rules that are built, one entry each: a unique tapestryKey on every node, `relationship-type-allowed`, and `field-mark-allowed`.
- **BIBLE §10**, a table summarizing eleven normalization rules. Their full text is in tapestry-cli's docs/NORMALIZATION.md, outside this repo.
- **The graph operations design's §7** ([docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md)), with the owner's three draft core rules, marked as being considered, not decided.
- **Checks with no written entry:** the eleven checks under `/api/audit/`, the UI's Health Audit, checks inside individual routes, and each concept's own schema settings.

The owner wants one place to read all of the rules, as a concept in a Tapestry instance, with concepts for glossary entries and for TIPs (Tapestry Improvement Proposals, numbered the way NIPs are for nostr) beside it. Before any of them is made, the line between the three has to be drawn, so that nothing has to move from one concept to another later.

What bears on the line:

- **A rulebook entry already has a shape** (ADR graph-operations-foundation/0004, Decision 12): what the rule says; whether it is a graph rule or a letter rule (a rule about events); whether it refuses a write or only reports; its check; its repair; and what enforces it (the database, a guard or a check).
- **Each built rule has one definition in code.** `src/operations/rules/<name>.js` exports its `name`, a one-line `summary`, whether it `refuses`, its `refusals`, and `violations(items, read)`. The write path calls `violations` as a guard, and `rules check` will call it over the graph.
- **The rulebook is set to become a protocol document.** Its status line and design §7 ("Where it lands") move it under `protocols/` once ratified, next to `protocols/drafts/tapestry-concepts.md`, with BIBLE §10 reduced to a pointer. The TIPs effort plans to copy tapestry's protocols into the TIPs repo as draft TIPs (Loom P-65). Unless something says otherwise, a rule's wording would then live in a TIP, beside the summary in its code, and in any list kept by hand.
- **Words already have a home.** NosFabrica/protocols' CONCEPTS.md calls itself the one place the concept graph's words are defined (Loom A6.8), though BIBLE §21 still keeps a glossary of its own.
- **The line is already drawn two ways.** On one hosted instance, avi.tapestry.ninja, one author's `rule` concept is "one sentence a specification, contract, decision or configuration states", while another author's `specification` concept takes in "a rule a diff can be checked against".
- **"Rule" already means several things:** Loom's rules for its board, each repo's rules for agents, the sourced rules on that hosted instance, the rules inside a concept's JSON Schema, and the concept graph's rules.

No concept changes here. A10.41 builds the graph rule concept once this is decided.

## Options considered

### Option A — Draw the line by size, or by how settled something is

A rule is a short or settled requirement; a TIP is a longer or still-open one.

- **Pros:** close to how people talk about them.
- **Cons:** the same requirement changes kind as it settles or shrinks, so it would move from the TIPs concept to the rules concept, which is the move this decision exists to prevent. Nothing tells a reader which concept to look in.

### Option B — Draw the line by kind of thing, and write each rule's wording once, in the rulebook

A graph rule is one sentence a graph or an event meets or breaks. A TIP is a numbered document accepted or rejected as a whole. A glossary entry says what a word means. A TIP adds, changes or retires rules and defines words, citing each rule by its name. The rule's wording stays in its rulebook entry, and every other view of the rules is made from the rulebook.

- **Pros:** one test places every sentence, and the answer doesn't change as the sentence settles. The rulebook's planned move into the TIPs keeps a single home for each rule's wording. The graph rule concept and `rules list-rules` read the same entries.
- **Cons:** a TIP that changes a rule also edits its rulebook entry, and a reader of the TIP follows a name to see the exact words. Principles that no program can check need a home outside the rulebook.

### Option C — Keep rules only inside TIPs, and index them

A rule is a sentence inside a TIP. The graph rule concept is an index of those sentences, each pointing to its TIP and section, the way the hosted instance's `rule` concept points to its sources.

- **Pros:** no rulebook to keep beside the TIPs, and close to how NIPs carry their MUST sentences.
- **Cons:** each rule's code needs a stable name to cite, and a TIP's section isn't one. Part of a rulebook entry (its check, its repair, what enforces it) describes this implementation rather than the protocol, so it doesn't belong in a TIP. Until the TIPs repo exists, there is nowhere to write a rule.

## Decision

We chose **Option B**, because one test decides where every sentence goes and the answer doesn't change later. It also keeps the rulebook's entry format and its planned move into the TIPs.

1. **A graph rule** is one sentence that a graph or an event meets or breaks. The test: a program can check it and answer pass or fail. A rule either refuses a write or only reports.
2. **A TIP** is a numbered document that is accepted or rejected as a whole: its reasons, the options weighed, any wire format, and its own status.
3. **A glossary entry** says what a word means. Nothing can break it.
4. **A TIP is never a rule, and a rule is never a TIP.** A TIP may add, change or retire rules and define words, the way a bill amends a code of law.
5. **Each rule's wording is written once, in the rulebook.** Today that is docs/GRAPH_RULES.md. When it moves under `protocols/` and into the TIPs, the document that holds the rulebook keeps the wording, and every other TIP cites a rule by its name. Anything else that shows rules, such as the graph rule concept, `rules list-rules` and BIBLE §10's pointer, is made from the rulebook, never kept by hand.
6. **Each rulebook entry gains two fields:** its **status**, which says whether code enforces it (proposed, enforced or retired), and its **source**, the TIP or ADR that brought it in. Whether a rule is agreed is its source's status, not the rule's.
7. **A principle no program can check**, such as "filter at view time" or "add rules frugally", is not a rule. It goes in a TIP's text or in [design-philosophies/](../../../design-philosophies/README.md).
8. **A rule about one concept stays in that concept's JSON Schema** (`required`, `x-tapestry.unique`). The rulebook holds only the general rule that an element validates against its concept's schema (BIBLE §10, rule 4).
9. **Glossary entries stay in CONCEPTS.md** and are published into the graph from there, the way the TIPs list will be published from the TIPs repo (Loom P-49).
10. **The concept's name is "graph rule"**, narrower than the general `rule` concept on the hosted instance, so the meanings of "rule" stay apart.

## Consequences

- **A10.41 can start.** The graph rule concept has a settled definition. Its fields come from the rulebook's entries plus status and source, and its items are made from the rulebook and each rule's code.
- **The rulebook's entry format grows by two fields**, status and source. The three built rules get status enforced, with sources ADR graph-operations-foundation/0003, 0004 and 0005.
- **Changing a rule touches two documents:** the TIP that argues for the change, and the rulebook entry that holds the new wording.
- **BIBLE §10's rules enter the rulebook one at a time**, each as a sentence a program can check. Rule 8, "soft duplication resolved via IMPORT and SUPERCEDES", describes a method, so it needs rewording first or belongs in a TIP's text. The three draft core rules in design §7 enter as proposed only if the owner keeps them.
- **BIBLE §21 should point to CONCEPTS.md**, as CONCEPTS.md says it does, rather than keep definitions of its own.
- **Firmware reinstall required?** No. This ADR changes no concept definition; A10.41 will.

## Implementation notes

This decision changes no code. What follows once it is accepted:

- `docs/GRAPH_RULES.md`: add **Status** and **Source** to "What each entry says", and fill them in for the three entries: enforced, with ADR graph-operations-foundation/0003, 0004 and 0005 as their sources. A docs-only change, which A10.41 needs.
- A10.41, in TapestryProtocol/tapestry: the graph rule concept in firmware, its items made from the rulebook and `src/operations/rules/`.
- When the rulebook moves under `protocols/`, its status line names this ADR as the rule for what may be written in it.

## Out of scope

- How TIPs are numbered, ratified and hosted (Loom A7.1 and A7.2).
- The graph rule concept's schema, and how firmware builds its items (A10.41).
- Which of BIBLE §10's rules, or design §7's draft core rules, are adopted.
- The TIP and glossary entry concepts themselves. The TIPs list is Loom P-49; a glossary concept made from CONCEPTS.md is not yet proposed.
