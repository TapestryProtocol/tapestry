# Story 46: An element of `word` fits the `word` schema an install leaves

**Status:** Approved
**Created:** 2026-11-20
**Type:** Bug
**Loom:** P-156, an open proposal no one has accepted yet, so there is no task — https://loom.brainstorm.world/proposals?ids=P-156. It is recorded on Loom once the owner accepts it.

## Background

Firmware's `word` schema file (`firmware/versions/v1.0.0/concepts/word/json-schema.json`) has one conditional: a node whose `wordTypes` hold "set" must have the set fields in its `graphContext`. The schema a firmware install leaves in the graph has many more.

- **What install adds.** Firmware's manifest has five enumerations. One, `concept-headers`, sends each concept header's singular key to `word.wordTypes`, with wordType conditionals turned on. So each install gives `word`'s schema two things:
  - an allowed list: each entry of `wordTypes` must be one of the keys the install found;
  - for each key, a pair of conditionals.
- **What the pair was made for.** A concept's own field, such as `dog.breed`:
  - if the breed is X, `wordTypes` must hold X;
  - if `wordTypes` hold X, the breed must be X.
- **Why it can't work for `wordTypes`.** Pointed at `wordTypes` itself, the second reads "if `wordTypes` hold X, `wordTypes` must equal X". No list of word types equals a single key, so it fails whenever it applies. The first never applies.
- **So no element of `word` fits the installed schema.** A node's `wordTypes` start with "word" and hold its concept's key, such as `["word", "relationshipType"]`. That makes two of the conditionals apply and fail. Each failure gives two problems: "`word.wordTypes` must be equal to constant", and "the element's JSON must match "then" schema".

What has been seen:
- **On david.tapestry.ninja, 2026-11-20.** `word`'s installed schema has 95 conditionals, the set conditional and a pair for each of 47 keys. In the owner's validation vocabulary run, five writes reached `word`: `graph create-set`, three `graph create-element`s of relationship types, and one `graph add-to-concept`. Each answered that `word` judges the node not fitting, with those four problems.
  - The writes landed, since a write is refused only for the concept it writes into, and `word` is reported.
  - The problems don't clear once the derive step has built the node's `graphContext`. Judged by the repo's own check against the live schema, with a `graphContext` added, the same four remain. Against firmware's file, the same nodes fit.
- **On a scratch stack, 2026-11-17** (story 42's live check). The installed schema had 83 conditionals. After a derive pass, all 430 list items with a `word` verdict failed it, with 1,096 conditional errors.

Why it matters:
- The owner's rule `validation` and validity criteria rest on elements fitting their concepts' schemas. A "doesn't fit `word`" on every element of `word` says nothing true and buries any real problem.
- `rules check` (Loom A10.31) would report every element of `word`, and so would the property operations' reports (A10.18). A10.31 waits for this fix (the owner's ruling at story 42's review round 2).

Where it came from: the pair was hand-written into firmware's `dog` schema on 2026-03-28 and made general the next day, in `apply-enumerations` (commit 5fab44fe). That commit turned it on for three of the five enumerations at once: `word.wordTypes`, `graph.graphType` and `dog.breed`. The last two are single strings, where the pair means something.

It is recorded in ledger row `2026-11-17-word-wordtypes-conditionals-contradict-themselves` and in Loom P-156. Both list three ways to fix it.

**The owner's ruling (2026-11-20).** Rewritten with "contains", the pair would read "if the list contains X, then the list contains X". That is true of every node, so it would check nothing. Against the live schema it gave the same verdict as leaving the pair out, for each of six nodes tried. The owner chose to drop it: "let's just get rid of the worthless test and leave it at that." So install stops writing the pair for `word.wordTypes`, and nothing else changes.
- Two of P-156's three ways do that: leave the pair out when the field is `word.wordTypes` itself, or turn off the manifest's switch for that enumeration. Which one is for whoever builds it.
- The third, a form that ties each word type to a section of the node, would be a new check, so it is out of scope.

## User-facing description

As the owner, or an agent working the graph, I want the `word` schema an install leaves to accept a node whose word types are right, so that a write's report, a node's cached verdicts and `rules check` say a node doesn't fit `word` only when something about it is wrong.

## Acceptance criteria

- [ ] **AC1 — An element of `word` fits.** Given an instance installed with this story's fix, when a node whose `wordTypes` hold "word" and keys the install knows is judged with its `graphContext` built, then it fits `word`'s installed schema, and no problem names `word.wordTypes` or a "then" schema.
  - This holds for `["word", "relationshipType"]`, `["word", "set"]` (with the set fields built) and `["word", "jsonSchema", "validationTool"]`.
- [ ] **AC2 — A write reports `word` as waiting, and the derive step as fitting.** Given that instance:
  - when `graph create-set` makes a set, or `graph create-element` makes a relationship type, as the owner's run did, then its answer reports `word` with `fits: null`, `waiting: true` and no problems;
  - once the derive step has built that node's tapestryJson, its cached verdict for `word` is valid, with no errors.
- [ ] **AC3 — The rest of what install puts in `word`'s schema still holds.** Given that instance:
  - a node whose `wordTypes` hold a key the install doesn't know still fails, with a problem naming that entry of `word.wordTypes`, so the allowed list stays;
  - a node whose `wordTypes` hold "set" and whose `graphContext` lacks the set fields still fails;
  - `dog`'s pair holds both ways: a dog whose breed is goldenRetriever without goldenRetriever in its `wordTypes` fails, and so does a dog whose `wordTypes` hold goldenRetriever and whose breed is irishSetter.
- [ ] **AC4 — A reinstall mends an instance installed before the fix.** Given an instance whose `word` schema holds the contradicting conditionals, when its firmware is reinstalled with this story's fix:
  - `word`'s schema holds none of them, and still holds the set conditional and the allowed list;
  - a relationship type and a set made before the reinstall fit `word` after a derive pass.
- [ ] **AC5 — What describes the enumeration says what it does.** The Firmware Explorer's page for the `concept-headers` enumeration, and BIBLE §6's account of install's enumerations, say what install now puts in `word`'s schema. The ledger row `2026-11-17-word-wordtypes-conditionals-contradict-themselves` closes.

## Concepts touched

`<TA>` is the instance's assistant (`GET /api/assistant/pubkey`).

- `39998:<TA>:word` — word (its installed JSON schema changes: what install puts in it).
- `39998:<TA>:concept-header` — concept header (read: its elements' singular keys are the allowed word types).
- `39998:<TA>:dog` and `39998:<TA>:dog-breed` — dog and dog breed (read: `dog.breed`'s pair holds as today).
- `39998:<TA>:graph` — graph (read: `graph.graphType`'s pair is unchanged).

## Out of scope

- The other failing verdicts story 42's live check found: 247 in six other concepts, `graph`'s 132 among them (Loom P-158), and the Properties Set nodes derived as words (P-157).
- Any change to `dog`'s or `graph`'s pair, or to the two enumerations that set only an allowed list.
- `ENUMERATES` being written in two shapes, and moving install's five enumerations to the one `graph enumerate` writes (ledger row `2026-11-19-enumerates-has-two-shapes`).
- The allowed list going out of date. It is set at install, so a concept made later isn't in it until the next install. That limit stays as it is.
- Reinstalling firmware on staging, production, david.tapestry.ninja and the other hosted Tapestries. Each comes after the merge, on the owner's yes, as the book's frame says of shipping.
- `rules check` (A10.31) itself.
- **Checking that a node's `wordTypes` hold the key of each concept it belongs to.** Nothing checks that today except validation tool's own schema, which requires its elements' `wordTypes` to contain "validationTool". The writes do put the key in. A check would be new work, "for another day and another session" (the owner, 2026-11-20), and is queued in `engineering-team/stories/_intake.md`.

## Open questions

- **Keep the allowed list?** Settled by the owner's ruling: only the worthless test goes, so the allowed list stays (AC3).
- **Where done stops.** Settled at approval: done is the fix proven on a scratch stack and merged to staging. Each instance's reinstall is a later step, on the owner's yes.
- **Which of the two ways that drop the pair.** For whoever builds it.

## Linked artifacts
- ADR: none. Architecture was skipped as obvious, the owner's choice when approving the story (2026-11-20): what is left, turning off the manifest's switch or leaving the pair out in code, gives the same result.
- Test plan: `engineering-team/stories/graph-operations-first-slice/46-word-elements-fit-the-installed-word-schema.test-plan.md`
- Review: (filled in after Review phase)
