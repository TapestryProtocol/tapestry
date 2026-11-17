# After graph update-node renames a lettered element, a text edit on the reading page signs a letter with the old name, and its import puts the old name back on the node

**Id:** 2026-11-17-reading-page-edit-restores-old-name
**Type:** bug (found by reading the code; not seen on a stack)
**Opened:** 2026-11-17 (story graph-operations-first-slice #21, graph update-node, review round 2's R2-1)
**Status:** OPEN
**Done:** —

**What was seen.** The reading page's `edit` (`ui/src/pages/reading/writeVerbs.js`) republishes an element's letter, then imports it:
- it builds the new letter from the relay's newest one at the address, tags and all (`:267`);
- it replaces the `name` tag only when the page itself renames (`:268`). It decides that by comparing the title given with the graph's name (`:251`), and update-node has already changed the graph's name;
- it takes the json tag from the graph, which is the definitive copy (`:269–272`);
- then it calls `POST /api/neo4j/event-update` (`:280`), which deletes the node's tags and imports the new letter. The import sets the node's `name` from the letter's `name` tag (`src/api/neo4j/eventSync.js:227–230`), and doesn't set `tapestryValue`.

So after `graph update-node` renames one of this instance's own lettered elements, a text-only edit of it on the reading page leaves the node:
- with its old `name`, and the old name tag;
- with its new `tapestryValue` and its new JSON.

This is the loss ADR graph-operations-first-slice/0021's Consequences record for an old letter imported again: an import destroying locally authored state, which principle 4 (BIBLE §30) rules out. Here it comes through a new letter.

**Who reaches it.** The page edits only an element whose letter, signed by the assistant, is on the relay (`writeVerbs.js:258–259`), for this instance's owner. An element `graph create-element` made has no letter, so it is out of reach until its letter is published.

**Fix shape.** In the reading page's `edit`, either:
- take the `name` tag from the graph's name, as it takes the json tag from the graph; or
- refuse the edit, naming the difference, when the graph's name differs from the letter's `name` tag.

`graph update-node`'s answer already says `letterOutOfDate`; the page could read the same fact from the node.

**Pointer:** ADR graph-operations-first-slice/0021 Consequences and Amendment 2; `engineering-team/reviews/graph-operations-first-slice/21-update-node.md` (round 2, R2-1); `ui/src/pages/reading/writeVerbs.js` (`edit`).
