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

**What closes it.** A firmware reinstall on staging once the change reaches it, on production after its promotion, and on david.tapestry.ninja and the other hosted Tapestries once their code has it. Each is the owner's call there. After each, `tapestry rules check --scope graph --rules word-types-hold-concept-keys` names none of firmware's nodes, and `tapestry graph list-elements` for `39998:<TA>:graph-rule` gives twelve items. What it still names is the instance's own:
- the JSON schemas of the concepts it made itself (david.tapestry.ninja 23, staging 6, production 5, this Mac 10), which a follow-up repair gives their key;
- any node whose JSON has no word block.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md` (the measurement, AC5); ADR graph-operations-first-slice/0047 (Consequences); `docs/GRAPH_RULES.md`, entry 12.
