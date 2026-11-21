# The `word.wordTypes` switch reaches an instance's `word` schema only with a firmware reinstall there

**Id:** 2026-11-20-word-wordtypes-switch-awaits-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-20 (story graph-operations-first-slice #46)
**Status:** OPEN
**Done:** —

**What is pending.** Story 46 turns `enforce-wordType-conditionals` off for the manifest's `concept-headers` enumeration (`firmware/versions/v1.0.0/manifest.json:408`). An instance's `word` schema loses the pairs only at a firmware reinstall there: Pass 2 rewrites the schema from firmware's file, then the enumeration step writes only the allowed list. Running `POST /api/normalize/apply-enumerations` alone leaves pairs already written, since it takes them out only while the switch is on. On david.tapestry.ninja, `word`'s schema held 95 conditionals on 2026-11-20: the set conditional and a pair for each of 47 keys.

**What closes it.** A firmware reinstall on each instance, each on the owner's yes, once that instance runs code with this manifest: staging once the story's PR reaches it, production after its promotion, and david.tapestry.ninja and the other hosted Tapestries once each runs a build that has it. A reinstall over the old manifest writes the pairs again. On each, `word`'s JSON schema node (`/api/concept-graph/node/39999:<TA>:word-schema`) should hold one conditional, the set's. A write such as `graph create-element` of a relationship type should then report `word` as waiting with no problems. The next reinstall on each also carries rule 9's item (ledger row `2026-11-18-rule-nine-awaits-firmware-reinstall`). The agent-memory instance on the Mac Studio takes it only at David's word.

**Progress.**
- **Staging:** reinstalled 2026-11-21, 00:18–00:21 UTC, on the owner's yes, after TapestryProtocol/tapestry#174. `word`'s schema node holds one conditional and the allowed list of 46 keys, where it held 93.
- **Production:** reinstalled 01:00–01:08 UTC, on the owner's yes, after the promotion TapestryProtocol/tapestry#175. It holds one conditional and 45 keys, where it held 91.
- **Still to do:** david.tapestry.ninja and the other hosted Tapestries, once each runs a build with this manifest; the agent-memory instance on the Mac Studio, at David's word.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/46-word-elements-fit-the-installed-word-schema.md` (Evidence, "On staging and production").
