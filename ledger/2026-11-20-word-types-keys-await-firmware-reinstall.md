# Firmware's nodes gain their concepts' keys, and the graph rule concept its twelfth item, only with a firmware reinstall on each instance

**Id:** 2026-11-20-word-types-keys-await-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-20 (story graph-operations-first-slice #47, ADR graph-operations-first-slice/0047 Decisions 7 to 9)
**Status:** OPEN
**Done:** —

**What is pending.** Story 47 makes every writer of a JSON schema give it `["word", "validationTool", "jsonSchema"]`, and the install write each header's word types from its file, so the eight headers firmware's manifest makes elements of node type, graph type and validation tool type hold those concepts' keys. It also adds rulebook entry 12, `word-types-hold-concept-keys`, and its element file in firmware's graph rule concept. A deploy installs no firmware. So on each instance firmware's JSON schemas still lack `validationTool`, the eight headers still lack their keys, and the graph rule concept holds eleven items, until a firmware reinstall there. The rule runs without it: `rules check` names those nodes until then.

**Where it stands (2026-11-20).** The change is on branch `feat/wordtypes-hold-concept-keys`, not yet merged. The measurement in the story found, read from each instance's stored JSON, 79 nodes named on david.tapestry.ninja, 58 on staging, 53 on production and 71 on this Mac's agent-memory instance. Of those, these are firmware's and a reinstall gives them their keys:
- each firmware concept's JSON schema (40, 39 on this Mac);
- the eight headers.

**2026-11-21: the change is on staging and production.** It reached staging with TapestryProtocol/tapestry#177 (04:47 UTC) and production with the promotion #178 (05:13 UTC). No instance has been reinstalled yet. The hosted Tapestries, david.tapestry.ninja among them, need a build with this code first.

**2026-11-21: staging is reinstalled** (community-reference #39's reinstall, 22:07 to 22:11 UTC, on `425006cf`). Read over the container's loopback just before and after, with nothing written:
- **`graph list-elements`** for staging's graph rule concept gives 12 items, `word-types-hold-concept-keys` among them. It gave 11 before.
- **`rules check --scope graph --rules word-types-hold-concept-keys`** names none of firmware's nodes. It judges 472 nodes and finds 13 (471 and 18 before; 48 not judged, with no JSON, both times). The 9 nodes it names are staging's own:
  - the JSON schemas of 5 concepts staging made itself, lacking `validationTool`: bengal cats, cat breeds, cats, nostr relay tags and siamese cats;
  - 4 tapestries lacking `tapestry` and `graph`: "Tapestry for Cat", "Tapestry for Organism", "test tap" and "test tapestry". The list below leaves them out; the story's measurement had two, as "2 test tapestries".
- **Five schemas, not six.** The sixth the measurement gave staging, `nostr-event-tagging-schema`, is firmware's: it is `nostr-event-tag`'s JSON schema. Pass 1 gives `create-concept` the concept's name, "nostr event tagging", and the d-tag `nostr-event-tag` (`src/firmware/install.js:209-213`), and `create-concept` takes the schema's d-tag from the name (`src/api/normalize/index.js:1377`). The install signed it again at 22:09:32, and the check no longer names it. That likely explains the measurement's "40 of firmware's" against firmware's 41 concepts, so the other instances' own counts below are likely one too high as well. That is not checked.
- **Before this install,** two cut-off attempts' partial Pass 1 had already given most of firmware's nodes their keys. At 20:51 and at 22:06 the check named 14 nodes: those 9, and the JSON schemas of firmware's last five concepts in the manifest (`nostr-user-tag`, `tag-pinning`, `nostr-event-tag`, `tagging-with-specific-tag` and `graph-rule`), which Pass 1 hadn't reached.
- **Still to do:** production, then david.tapestry.ninja and the other hosted Tapestries.

**2026-11-21: production is reinstalled** (community-reference #39's reinstall, 23:37 to 23:41 UTC, on `196a475f`). Read the same way:
- **`graph list-elements`** gives 12 items. It gave 11 before.
- **`rules check`** names nothing. It judges 352 nodes and finds 0 (339 and 49 before; 4 not judged, with no JSON, both times).
  - **Before, all 49 were firmware's:** the 41 JSON schemas, `nostr-event-tagging-schema` among them, and the eight headers.
  - **None of production's own nodes was named, before or after.** The measurement found 5 of its own JSON schemas on 2026-11-20, or 4, if it counted `nostr-event-tagging-schema` as production's own, as it did on staging. That is not looked into.
- **Still to do:** david.tapestry.ninja and the other hosted Tapestries.

**2026-11-22: why production's check names none of its own nodes.** Read by address from production's public `GET /api/concept-graph/node/<address>`, with no sign-in and nothing written:
- **Production has four JSON schemas of its own:** `v4v-musician-schema`, `github-account-schema`, `cat-schema` and `cat-breed-schema`. So its own count is 4, not 5.
- **All four still lack `validationTool`.** Each one's `json` tag gives `word.wordTypes` as `["word","jsonSchema"]`.
- **None of the four carries the `TapestryNode` label.** Their labels are `NostrEvent`, `ListItem` and `JSONSchema`. The rule judges only nodes with that label (`JUDGEABLE`, `src/operations/rules/word-types-hold-concept-keys.js:27`), so `rules check` can't name them. This is the gap in ledger row `2026-11-17-walk-skips-unlabelled-keyed-nodes`. The story left such nodes out of scope: its measurement found 152 class-thread elements on production with a tapestryKey and no label.
- **So a repair that works from `rules check`'s findings would miss them.**
- The reads are recorded in this Mac's main checkout, under `tmp/live-check-47/after-reinstall/`.

**What closes it.** A firmware reinstall on staging once the change reaches it, on production after its promotion, and on david.tapestry.ninja and the other hosted Tapestries once their code has it. Each is the owner's call there. After each, `tapestry rules check --scope graph --rules word-types-hold-concept-keys` names none of firmware's nodes, and `tapestry graph list-elements` for `39998:<TA>:graph-rule` gives twelve items. What it still names is the instance's own:
- the JSON schemas of the concepts it made itself (david.tapestry.ninja 23, staging 6, production 5, this Mac 10), which a follow-up repair gives their key;
- any node whose JSON has no word block.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md` (the measurement, AC5); ADR graph-operations-first-slice/0047 (Consequences); `docs/GRAPH_RULES.md`, entry 12.
