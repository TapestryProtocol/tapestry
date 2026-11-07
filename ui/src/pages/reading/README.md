# Reading views (experimental)

`/reading` (avatar menu → Reading Views (experimental)) reads this instance's concept graph as five
views: **Table**, **Outline**, **Plan**, **Drift** and **Dictionary**. Anyone can read. **Plan** draws a
plan (a Set of ranked stories or steps) in order, each item's state, what blocks what, and what the items
hang on. The harness's `brain plan` reads a story's state from its git branch; git can't be seen from an
instance, so here a story on a branch reads as unknown and the other states (set aside, answered, blocked,
ready) come from the graph. In **Outline**, the
signed-in owner can also edit a thing's title and text and make a new item in a kind or a Set.

They were built in the brainstorm-harness repo as `brain-view`, a local viewer. This page serves the
same boards from the instance itself, so someone with only a hosted instance can read it this way
with nothing installed.

| File | What it is |
|---|---|
| `boards/*.dc.html` | The views, as the design canvas exports them: a template and a logic class each. Copied unchanged from brainstorm-harness `reading/boards/`. |
| `dcPlayer.jsx` | Plays a `.dc.html` board on React (a port of the harness's Preact `reading/dc.js`). |
| `readVerbs.js` | The reads the boards ask for (scopes, scope, node, group, search, path, community, plan), a port of the harness's `bin/brain-slice`. |
| `writeVerbs.js` | Outline's writes: `can(id)` (what may be done to a node, and why not, in words) and `write('edit' \| 'create', …)`. A port of brain-view's writes. |
| `brainData.js` | `window.Brain`: the cache and shared state the boards' logic reads. |
| `ReadingViews.jsx` | The page: the bar (views, scope, jump-to-anything) over the open board. |

**No new server work.** Every read goes through endpoints that already exist and are open to
anonymous readers:

- Cypher through `POST /api/neo4j/query`. Its guard refuses any text holding a write word, so
  quoted strings move into parameters (`liftLiterals`).
- This instance's relay through `GET /api/strfry/scan`.
- The community relay through `GET /api/relay/external`.
- Names through `GET /api/profiles`.

**Writes** (Outline only, signed-in owner only) also use existing endpoints:

- An edit is ONE republish of our event at the same address, so its links survive
  (`POST /api/strfry/publish`, `signAs: 'assistant'`), then `POST /api/neo4j/event-update`.
- A new item is `POST /api/normalize/create-element`, then, in a Set, `POST /api/normalize/add-to-set`.

Every write is read back from the graph before the page says it is done. Some actions show disabled,
with the reason:

- A thing signed by another key, including things another instance sent here, whose assistant
  signed them. Only their author can change them.
- Another author's Set or kind.
- A name that create-element or add-to-set would resolve to the wrong node, since both find by name.

What counts as "ours" is decided by the instance's Tapestry Assistant, from `useConfig().taPubkey`.

**Updating a board:** copy the new `.dc.html` over the old one. A board only reads `window.Brain`
(`api`, `watch`, `on`, `emit`, `set`, `state`, `node`, `has`, `doc`), so one that runs in brain-view
runs here. A new view is one line in `VIEWS` in `ReadingViews.jsx`.
