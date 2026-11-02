> **Repo metadata — not part of the spec text.**
> **Status:** 💭 idea
> **Canonical:** not yet published
> **Last updated:** 2026-11-01
> **Sources:** David's design session of 2026-11-01, in his own words. The machinery it draws on: the class thread's subset relationships (`n`, `s`) in [Class Thread Relationships](./class-thread-relationships.md); spawned lists of subsets in [Spawning](./spawning.md); the core-node scheme in [Tapestry Concepts](./tapestry-concepts.md) § Core nodes of a concept; the `json-schema` auxiliary role in [DList Auxiliary Events](./dlist-auxiliary-events.md) § 4; the withdrawn `concept` row in [Protocol amendments](./amendments-2026-09.md) § 1.
> **Why this exists:** nothing says when a subset of a concept should become a concept of its own. Both paths happen in practice, and the choice has consequences — how the elements are fetched, what validates them, and whether the thing has a title anyone can cite — but the reasoning has only ever been made on calls.
> **This is a quick first draft and needs a lot of work.** The open items are in § 4.

---

Paths to Becoming a Concept
===========================

`draft` `optional`

## 1. The question

Suppose I have a Concept for Restaurants. Then someone suggests we create a Concept for Restaurants in Chicago. Someone might point out: we already have a Concept for Restaurants. So what's the point in a Concept for Restaurants in Chicago?

The retort is that there will be scenarios where it does make sense to create a subset Concept, like the Concept for Restaurants in Chicago as a subset of the Concept for Restaurants. This document is about when we would ever want to do that, and why.

## 2. Two paths

**Path one — created outright.** We decide up front that Restaurants in Chicago is its own Concept, and create it as one: its own header, its own core nodes, and its place in the class thread as a subset of Restaurants.

**Path two — a subset that matures.** We start with the Concept for Restaurants. Then we realize the spawned list for subsets of Restaurants, and one of those subsets is Restaurants in Chicago — not yet a Concept, just a subset. Later we decide that we have good reason for this subset node to mature into its own Concept.

Both happen. Nothing says which path to take, or what the second one does to the subset it starts from.

## 3. Reasons to make a subset its own Concept

- **Fetching.** If I want to fetch all of the Restaurants in Chicago in nostr using the z-tag, I don't want to have to fetch all of the restaurants in the world and then iterate through them one at a time to get the ones from Chicago.

- **A schema of its own.** I might want elements of the concept of Restaurants in Chicago to validate against a JSON Schema that is closely similar, but not identical, to the more generic Concept of Restaurants.

- **A name worth having.** Words have lots of different meanings in lots of different contexts. Which is not a problem when it's not a problem, but it is a problem when there is confusion or ambiguity about which kind of thing we are talking about. Making it a Concept lets us refer unambiguously to the specific Concept in question, and get details like its full title and full description, and how it is integrated to other concepts. This can be worth it on its own, even where nothing else in this section applies.

## 4. What this draft still needs

A first pass that records the reasoning, not a finished document.

- [ ] **The other direction.** When might we be satisfied with keeping a subset a subset? § 3 says when to promote one; nothing here says when not to, and promoting every subset is clearly wrong.
- [ ] **The wire form of each path.** Path one is an ordinary concept creation. Path two is a change to an existing subset node, and no spec says what that change is: whether the node is replaced, pointed at, or left in place beside a new header.
- [ ] **What happens to the elements.** On path two, items already in the subset have to end up as items of the new Concept. Nothing says whether that is a republish, a curation copy, or a read-time derivation.
- [ ] **Whether a maturing subset keeps its parent's schema and other core nodes.** Related to open question 3 of [DList Auxiliary Events](./dlist-auxiliary-events.md), on whether a list that defers to another's definition uses that list's auxiliary events.
- [ ] **Where the bar sits against the withdrawn `concept` row.** [Protocol amendments](./amendments-2026-09.md) § 1 withdrew a Concept for Concepts because its members were already findable another way. "Already findable another way" looks like the test § 3's first bullet is really about, and that should be stated rather than left implicit.
- [ ] **A worked example from the estate.** Restaurants in Chicago is an illustration. A real case would be better.
- [ ] **Whether this belongs in `drafts/` or the worksheet** until it has a wire format.
