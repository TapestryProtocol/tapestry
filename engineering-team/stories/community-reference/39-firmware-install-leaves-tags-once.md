# Story 39: A firmware install leaves each header's tags once

**Status:** Approved
**Created:** 2026-11-21
**Type:** Bug

## Background

**What's wrong.** On every instance installed since Story 38 shipped (2026-06-17), six concept headers hold each tag of their letter twice: `tag`, `nostr-user-tag`, `tag-pinning`, `nostr-event-tag`, `tagging-with-specific-tag` and `nostr-relay`. Their `b` tag appears once. These are exactly the six firmware concepts whose manifest entry carries a `communityReference`. The public concept summaries list each of them twice:

| Instance | Summary rows | Distinct headers |
|---|---|---|
| david.tapestry.ninja | 75 | 69 |
| staging.brainstorm.world | 52 | 46 |
| tapestry.brainstorm.world | 51 | 45 |
| avi.tapestry.ninja | 72 | 66 |
| tags.brainstorm.world | 49 | 43 |
| magic-carpet.brainstorm.world | 36 | 36 |

magic-carpet is clean: its headers were signed 2026-04-23, before Story 38, and carry no `b`. Read 2026-11-21 through the public read routes, and Zeus on david.tapestry.ninja.

**Why it happens.** Diagnosed 2026-11-21, reading only:
- **The first import replaces the tags.** Each firmware install re-signs every firmware header from its built-in definition, and imports that letter in a way that replaces the header's tags.
- **The second import adds to them.** For a concept with a community reference, the same install then re-signs the header once more with the community `b` added (Story 38's emitter). The import of that second letter adds its tags beside the first letter's and removes none. The two imports name tag nodes differently, so the sets never merge.
- **Every install repeats it.** Cleaning the data alone would last only until the next reinstall.
- **Evidence:** on david.tapestry.ninja, each of the six headers' tag nodes has an id that rebuilds exactly from one import or the other. On staging and production, both sets' ids answer on the public read route.

**Two more faults in the same install step:**
- **Community copies collect a set of tags per version.** Every install brings in each community header and superset again, adding the new version's tags beside the old ones. Production re-signs its `nostr-relay` header on every install, so staging's copy of it holds 9 versions' tags (61 tags; its superset 63). david.tapestry.ninja's and avi.tapestry.ninja's copies hold 2 versions each.
- **Production is its own community.** The manifest's `nostr-relay` reference names production's own header. So production's header carries a `b` naming itself and a relationship from the header to itself. Its own superset is brought in as if another curator had written it, and holds each tag twice.

**Why it matters.**
- **The summaries are the first call agents make.** They open AGENTS.md's orientation ladder, and their `count` reads as the number of concepts.
- **Owner writes would publish the duplicates.** Writes that rebuild a letter from the graph's tags, such as a JSON or slug change, sign every row they find. On these headers they would publish a letter with each tag twice. That hasn't happened yet: each header's id still matches its second letter. Story 40 guards against it.
- **The general fault is already in the ledger** as "Old tags never cleared" (`ledger/2026-11-20-todays-importers-keep-their-faults.md`). This story fixes it for firmware install's community references, the one place that hits it on every install.

**Who's affected:** anyone reading an instance's concepts (owners, agents, the concept pages), and every later firmware install on every instance.

## User-facing description

As an instance owner, or an agent orienting on an instance, I want each concept header to hold its letter's tags once after a firmware install, however many installs have run, so that the concepts are listed once and nothing built from a header's tags repeats them.

## Acceptance criteria

- [ ] **AC-1 (a header with a community reference holds its letter's tags once).** Given an instance whose firmware manifest gives a concept a `communityReference`, when firmware install runs once or several times in a row, then:
  - that concept's header holds each tag of its current letter exactly once, its `b` included;
  - it holds no tag of an earlier letter;
  - it has exactly one `REFERENCES {source:'b-tag'}` relationship, to the community header its `b` names.
- [ ] **AC-2 (a community copy holds only the tags of the version it holds).** Given a community header or superset that an earlier install brought in, whose curator has since published a newer version, when firmware install runs, then the copy holds each tag of the version it now holds exactly once, and no tag of an earlier version.
- [ ] **AC-3 (an instance that curates its own reference doesn't point at itself).** Given an instance whose own assistant is the curator a concept's `communityReference` names (production, for `nostr-relay`, today), when firmware install runs, then:
  - that concept's header carries no `b` naming its own address;
  - no relationship runs from the header to itself;
  - its superset holds each tag of its letter exactly once.
- [ ] **AC-4 (today's duplicates clear on the first install with the fix).** Given an instance in today's state (the six headers with two sets of tags, community copies holding several versions' tags, and production's self-pointing `b` and relationship), when firmware install runs once with the fix, then every one of those nodes meets AC-1 to AC-3, with no other step.

## Concepts touched

- **The six concept headers,** at `39998:<that instance's assistant>:<slug>`, slugs `tag`, `nostr-user-tag`, `tag-pinning`, `nostr-event-tag`, `tagging-with-specific-tag` and `nostr-relay`. Each instance has its own assistant. As read 2026-11-21:

  | Instance | Assistant |
  |---|---|
  | staging | `8e901369…` |
  | production | `919ba08a…` |
  | david.tapestry.ninja | `a7173e2c…` |
  | tags | `a68dbf56…` |

  The behavior must hold for whichever assistant an instance has.
- **Their community headers:**
  - `39998:82b75e47…:<slug>` for the five event-tagging concepts. These are ADR 0015's legacy concepts, and three of them are pinned by `knownGoodEventId`.
  - `39998:919ba08a…:nostr-relay` for `nostr-relay`, which is production's own header.
  - Each has its `39999:…:<slug>-superset` where the relay holds one.

_(Architect: the local container is David's private agent-memory instance. Don't orient there. Use staging's public `/api/concept-graph/summaries` and `/node/<handle>`.)_

## Out of scope

- **Two guards against duplicates from any importer,** in story 40 of this book:
  - the summaries list a header once even if it holds a repeated tag;
  - an owner's rewrite of a letter never signs a repeated tag.
- **A reinstall drops a `b` the owner authored on a firmware header.** This is a different fault: what a reinstall must keep. It is queued in `stories/_intake.md`, 2026-11-21.
- **The ledger row's other faults and callers.** The other importers that never clear old tags, and the row's other faults (older versions over newer, the 32-bit tag key, the two `importEventDirect` copies), stay open there.
- **Cleaning instances by hand.** Each instance clears on its first install with the fix (AC-4). The reinstalls are this book's rollout, each on the owner's yes.
- **The local agent-memory container** isn't checked or touched by this book, and **avi.tapestry.ninja** is Avi's to reinstall.

## Open questions

For the Architect:
1. **Where the clearing goes.** Either clear a node's old tags before each import in firmware's community-references step, as `event-update` and `set-b-tag` already do, or move that step onto `import nostr`'s recorder, the ledger row's fix shape. The recorder never writes the instance's own nodes (ADR graph-operations-first-slice/0032 Decision 7.2), so it can't make the `b` seed. ADR 0032 also rejected rewriting the shared importer (its Option B), under D15.
2. **The relationships a `b` made.** When a header's letter is imported again, should relationships derived from an earlier letter's `b` go too, as `set-b-tag` clears them, so that a `b` that's gone leaves no relationship behind?
3. **An older version on the relay.** The community fetch could bring back a version older than the copy holds; three of the six have no `knownGoodEventId`. Today's import takes it anyway (the ledger's "older versions over newer"). Does AC-2 need "the newest version stands" too, or does that stay with the ledger row?
4. **Testing without the local container,** for example on a scratch stack, as earlier live checks did.

## Linked artifacts

- Book: `engineering-team/audits/header-tags-once/book.md`
- Ledger row: `ledger/2026-11-20-todays-importers-keep-their-faults.md`
- Predecessors:
  - Story 38: `engineering-team/stories/community-reference/38-b-tag-primitive-emitter-derivation.md`
  - Its ADR: `engineering-team/decisions/community-reference/0034-b-tag-primitive-emitter-derivation.md`
  - ADR 0030: `engineering-team/decisions/community-reference/0030-communityreference-seed-not-stub.md`
  - `import nostr`'s ADR: `engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md`
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
