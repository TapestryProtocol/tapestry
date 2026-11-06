# Reading views (experimental)

`/reading` (avatar menu → Reading Views (experimental)) reads this instance's concept graph as four
views: **Table**, **Outline**, **Drift** and **Dictionary**. It is read-only.

They were built in the brainstorm-harness repo as `brain-view`, a local viewer. This page serves the
same boards from the instance itself, so someone with only a hosted instance can read it this way
with nothing installed.

| File | What it is |
|---|---|
| `boards/*.dc.html` | The views, as the design canvas exports them: a template and a logic class each. Copied unchanged from brainstorm-harness `reading/boards/`. |
| `dcPlayer.jsx` | Plays a `.dc.html` board on React (a port of the harness's Preact `reading/dc.js`). |
| `readVerbs.js` | The reads the boards ask for (scopes, scope, node, group, search, path, community), a port of the harness's `bin/brain-slice`. |
| `brainData.js` | `window.Brain`: the cache and shared state the boards' logic reads. |
| `ReadingViews.jsx` | The page: the bar (views, scope, jump-to-anything) over the open board. |

**No new server work.** Every read goes through endpoints that already exist and are open to
anonymous readers:

- Cypher through `POST /api/neo4j/query`. Its guard refuses any text holding a write word, so
  quoted strings move into parameters (`liftLiterals`).
- This instance's relay through `GET /api/strfry/scan`.
- The community relay through `GET /api/relay/external`.
- Names through `GET /api/profiles`.

What counts as "ours" is decided by the instance's Tapestry Assistant, from `useConfig().taPubkey`.

**Updating a board:** copy the new `.dc.html` over the old one. A board only reads `window.Brain`
(`api`, `watch`, `on`, `emit`, `set`, `state`, `node`, `has`, `doc`), so one that runs in brain-view
runs here. A new view is one line in `VIEWS` in `ReadingViews.jsx`.
