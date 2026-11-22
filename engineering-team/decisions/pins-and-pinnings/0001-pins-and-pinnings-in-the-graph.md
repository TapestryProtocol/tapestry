# ADR 0001: Pins and pinnings live in the graph as the instance's own, and go out under its Assistant's key

**Status:** Proposed
**Date:** 2026-11-22
**Story:** `docs/loom/G5.6.md` (the epic's spec; its stories follow this decision)

Two documents are cited by short name. The **draft** is [protocols/drafts/pins.md](../../../protocols/drafts/pins.md), Pins & Pinnings, Draft 3, a pre-NIP; "§ n" means a section of it. The **catalog** is [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md).

## Context

The book is [pins-and-pinnings](../../audits/pins-and-pinnings/book.md): build the draft in Tapestry, so that a person, or an agent working for them, pins a DList header or a Tag to a named Pin, one Pin for each reason, publicly or privately. Its acceptance frame is Loom G5.6's done-when: the pin concept and its first Pins in the graph, made local-first; pinning and unpinning a DList or a Tag, publicly or privately; tag-pinning's pins moved onto the new Pins (§ 10), with their Trusted Lists still spawning; and an agent pinning through the external CLI.

### Today's one kind of pin

- **The concept.** `tag-pinning` is a firmware concept (`firmware/versions/v1.0.0/concepts/tag-pinning/`). Its schema holds `tagPinning.tagEventId` and a `curationMethod` object with no inner schema. Readers find pins by `z` to the canonical handle, `39998:<LEGACY_Z_TAG_PUBKEY>:tag-pinning`, under ADR 0015's named exception (`src/api/profile-tags/index.js`; `CLAUDE.md`, "Per-deployment TA pubkey").
- **A pin** is a kind-`39999` event the pinner signs in the browser: `d` is `tag-pin-<slug>-<tagAuthor8>-<viewer8>`, an `e` and an `a` name one Tag, `z` names `tag-pinning`, and a `curation-method` tag carries JSON with the observer, method, cutoff, `includeScoreInTL`, `targetTypes` (people, notes) and `noteMethod` (`pinTag` in `ui/src/utils/publishTagPin.js`). It goes to the instance's relay and to public relays. No server route writes a pin, and nothing writes one to Neo4j.
- **Unpinning** is the pinner's NIP-09 deletion, which names the pin by `e` only (`unpinTag`). It carries no `z`, so it never reaches readers who find pins by their concept (ledger `2026-09-27-revokes-do-not-travel`).
- **Spawning.** `src/api/trustedList/refreshPinnedTags.js` reads every pin from the instance's relay and turns each into a kind-`30392` Trusted List of people, `d` `tl-pin-<obs8>-<tagAuthor8>-<slug>`, and, when the pin's target types include notes, a kind-`30393` list of notes. The instance's Assistant signs both (`getOwnerAssistantKeys`). They are built on pin, on a curation edit, on Apply or Dispute, from the Export dialog, from "Refresh all", and by a daily task that ships switched off. Only the `nip85:rank` method is offered, and `includeScoreInTL` is ignored.
- **Also on the click:** NIP-51 lists of the Tag's people and notes, signed by the pinner (ADR 0017). Pins are counted, per Tag, in the Tags directory's "Most pinned" sort.
- **Not there at all:** a private pin, a pin of anything but a Tag, and a graph operation that makes a pin.

### Outside Tapestry

Brainstorm-UI reads a person's own tag pins by the `tag-pinning` handles (`client/src/services/tags.ts` on its staging, 2026-11-20). Its writer for them ships switched off (`TAG_PINS_ENABLED`). Its two open proposals about Trusted Lists, P-145 and P-146, lean on the draft's wire format.

### What binds the choice

- **The self is the graph** (BIBLE §30). Neo4j is the definitive "me", and a signed event is a letter. A write that is never published is a private thought, and publishing is optional.
- **The instance's key is its Assistant's** (BIBLE §31). Every first-person question the instance asks is answered by `authors:[TA]`. The owner is the principal correspondent, maximally trusted and never conflated with the instance. Owner-authored letters enter the instance's brain only by an explicit act, re-mint or pointer, chosen per feature in its ADR.
- **The graph operations** (`graph-operations-foundation` ADRs 0001 and 0004). Each operation is declared once, and its route, internal CLI command and `/docs` entry come from that declaration. Writes run their guards, record which admin made each change, and never sign. Export nostr signs, as the instance's Assistant, for the owner or an admin (catalog § 10, question 2, answered 2026-11-20). Operations that only make sense for one kind of concept sit in an app layer above the generic module (catalog, "The app layer").
- **Reads are open.** Visitors can read nodes that were never published (catalog § 10, question 1, still open).
- **The firmware is moving** (`graph-operations-first-slice` ADR 0043). It will ship as pinned releases, installed as each instance's own nodes under its Assistant's key, and the first release is to equal today's `firmware/versions/v1.0.0` files.
- **The architecture invariants.** Accept every signed pinning, filter by point of view when reading, and work an effective set out when it is read, never storing it as a result.

### The owner's direction

On 2026-11-22 the owner approved the direction of four of the choices below before this ADR was written: the concepts in firmware under each instance's Assistant (Decision 1); the owner and admins pinning through graph operations, while other people sign their own pinnings in the browser (Decision 3); a private pinning never published and kept from visitors (Decision 5); and a moved pin going out generic, with what it spawns kept as an instance setting (Decision 8). The other choices are the Architect's.

## Options considered

### Option A — Pins and pinnings in the graph, as the instance's own

The `pin` and `nostr-pinning` concepts and the first Pins are firmware, so every instance installs them as its own nodes. The owner and admins pin through graph operations, which write a pinning node and never sign. Export nostr sends a public pinning as a letter its Assistant signs. Everyone else keeps pinning in the browser, under their own key, in the new form.

- **Pros:** the done-when's "made local-first" in full: the graph holds every Pin and the instance's every pinning, and a private pinning needs no letter at all. An agent pins with the operations it already uses. It follows BIBLE §31's first-person rule, and firmware's own road under ADR 0043.
- **Cons:** two writers, the graph and the browser, and readers must union them with the old pins. Export's letters must learn the pinning's tags.

### Option B — Pinnings stay browser-signed events, in the new form

Change only the wire: the browser signs new-form pinnings, and readers read them from the relay, as they read pins today. The graph would hold pinnings only once imported.

- **Pros:** the smallest change. One writer, and no new graph structure.
- **Cons:** it fails the done-when. Nothing is local-first, an agent can't pin without a person's key, and a private pinning would need NIP-44 in every person's signer. It keeps the event as the seat of the self, which BIBLE §30 rules out.

### Option C — One set of Pins under a held key, shared by every deployment

Make the `pin` and `nostr-pinning` concepts and the well-known Pins once, under a key the team holds, as the Duty Menu header is (`duty-menus-and-self-maps` ADR 0002). Each instance wires to them by pointer `b`, and every pinning on every deployment names the same Pin.

- **Pros:** one Pin per reason across deployments, so an outside reader finds every pinning on `spawns-trusted-list` with one filter. It answers worksheet W1 for these concepts.
- **Cons:** it settles W1, still open, for one family of concepts ahead of the rest. A hot key to keep that no deployment owns. And it runs against ADR 0043, under which firmware concepts are each instance's own.

### Option D — Keep tag-pinning, and add Pins for DLists beside it

Leave the Tag pin as it is, and build the draft only for DList headers.

- **Pros:** nothing moves under today's readers.
- **Cons:** it fails the done-when's third bullet, and leaves two kinds of pin to read and to explain for good.

## Decision

**Option A.** Pins and pinnings are nodes of the instance's own, made through graph operations, and the instance's Assistant signs what goes out. People who aren't the owner or an admin keep pinning in the browser, under their own key, in the new form.

1. **The concepts and the first Pins: firmware, under each instance's Assistant.**
   - Two firmware concepts, which the install writes as the instance's own nodes, as it writes every firmware concept (ADR 0043, Decision 1):
     - **`pin`**, handle `39998:<TA>:pin`: the concept of Pins. Its elements are Pins.
     - **`nostr-pinning`**, handle `39998:<TA>:nostr-pinning`: the concept of pinnings. Its elements are pinnings.
   - `<TA>` is the instance's Assistant, read at runtime. Neither concept joins ADR 0015's exception, and neither has a community reference.
   - **Two Pins ship as firmware elements of `pin`,** with the draft's tags (§ 2): `spawns-trusted-list` (`spawns` `list`), for DList headers and Tags, and `add-to-dictionary` (`spawns` `dictionary`), for DList headers. Their addresses are `39999:<TA>:spawns-trusted-list` and `39999:<TA>:add-to-dictionary`.
   - **A Pin's `for` tag names a content category** (§ 2). Of the two these Pins are for, only Tags exists as a concept today (`39998:<TA>:tag`), so `spawns-trusted-list` names that. The DList-headers category waits for the Content Categories draft's items. `for` is a hint, never a gate.
   - **Every other Pin is made by an operation** (Decision 10), since anyone may make one (§ 1). G6.4's alert Pin is made that way.
   - **Across deployments,** each instance's Pins are its own. An outside reader finds a deployment's pinnings under that deployment's Assistant, as Brainstorm-UI already reads tag pins under more than one handle. One Pin for every deployment is worksheet W1's question, and stays there.

2. **A Pin and its pinnings in the graph: elements, found by their tags.**
   - **A Pin is an element of `pin`,** a `ListItem` like any other. Its `d` is its slug, and its letter carries the draft's § 2 tags: `names`, `description`, `spawns`, `for`, `required` and `allowed`. It isn't a `ListHeader` in the graph. No node is both today: import labels a letter by its kind alone, every header lookup needs `ListHeader` or `ConceptHeader`, and five element operations refuse a header-labelled node as made elsewhere (`src/operations/catalog/import/_letters.js`, `graph/_fields.js`, `graph/_elements.js`). Making a kind-`39999` a header in the graph is the work of the DList Header Declaration draft, and waits for it.
   - **A pinning is an element of `nostr-pinning`.** Its `z` to that concept gives it its `HAS_ELEMENT`, as every element's `z` does. Its `z` to its Pin, its `a` and its `polarity` are tag nodes, made as import makes them, with the `a` tag's `REFERENCES` edge to its target. A `z` naming a kind-`39999` wires no edge today. A direct Pin-to-pinning `HAS_ELEMENT` would be an edge that export reports as uncarried (`export/_letters.js`). So the pin operations find a Pin's pinnings by their `z` tag, and the graph's header model is left as it is.
   - **A pinning's JSON** is its section, `nostrPinning`, holding its Pin, its target and its polarity in the clear, and a `payload`: one NIP-44 string the Assistant encrypts to itself. The payload holds whatever mustn't go out in plain, which is a public pinning's curation (Decision 8), and a private pinning's target, polarity and context as well (Decision 5).
   - **Small extensions of the module** make this possible:
     - `graph create-element` takes an optional `d` and optional extra tags, for an app-layer concept whose wire form fixes them. A `d` that is taken is refused, not given a suffix, and the tags the module writes itself (`d`, `name`, `z`, `n`, `s`, `b`, `json`) can't be passed.
     - `graph update-node` takes the same extra tags, to change a tag's value on an own node.
     - A firmware element file takes the same `d` and tags, as a header file takes `headerTags`, and both installs, today's and seed-firmware, honour them.

3. **Whose a pinning is.**
   - **The owner and admins pin through the graph,** people and agents alike: from the UI, which calls the operations when the signed-in person is the owner or an admin, or from the external CLI. A pinning made that way is the instance's own, and the instance's Assistant is its letter's author (BIBLE §31). An admin who pins directs the instance, as an admin who writes any node does.
   - **Everyone else signs their own pinnings** in the browser, in the new form, as they sign tag pins today. Those are letters, read from the relay and counted for their author's own point of view.
   - **The owner's own signed pinnings,** made with the owner's own key in another client, are a correspondent's letters (BIBLE §31). They count in the owner's view beside the instance's pinnings, and win over the instance's pinning of the same Pin and target, as a personally signed header wins in assistant-designation (BIBLE §31, "The external layer"). They are never merged into the instance's pinnings without an explicit act.

4. **Export sends a public pinning as the draft's letter, signed by the Assistant.**
   - **The letter is built as every element's is** (`src/operations/catalog/export/_letters.js`): its `d`, its `z` to `nostr-pinning`, and every tag node it holds, so its `z` to its Pin, its `a` and its `polarity`. It also carries the `name` and `json` tags every element's letter carries. Readers that don't know them ignore them, and they add nothing in the clear that the tags don't, since the curation in the `json` is ciphertext.
   - **Its `d` is the draft's** (§ 3.1), `pin-<pinSlug>-<h8>-<owner8>`, where the owner is the instance's Assistant.
   - **`pin set` sends it at once.** It runs export nostr with the pinning as its `node` scope, to the instance's own relay and to any relays the caller names, as a pin goes to a relay on its click today.
   - **Export never signs a node marked private,** in any scope, `everything` included (Decision 5).

5. **A private pinning is encrypted where it lies, and is never sent.**
   - **Never published** in this book, as the owner chose. Export skips it in every scope. The draft's encrypted letter (§ 9, W22) is left for when a private pinning has to leave the instance.
   - **Encrypted at rest.** Visitors can read every node, with all its tags and its JSON, today. The concept-graph routes, the read path of `/api/neo4j/query` and `/api/tapestry-key/:key` need no sign-in, and none of them filters by label or property (`src/middleware/routeAccess.js`; catalog § 10, question 1). A filter on each of those routes, and on any Cypher a visitor may send, isn't a guard anyone could trust. So a private pinning's target, polarity and context are only in its payload (Decision 2), the form W22 gives the letter, and the node is marked `["private", "1"]`. It has no `a` or `polarity` tag node. Its Pin and its `d` stay in the clear, as in § 9.
   - **Its `d` names no target.** The draft's `h8` hashes the target in plain (§ 3.1), so anyone could hash the known DList headers and Tags until one matches. A private pinning's `h8` is a keyed hash instead, under a key derived from the Assistant's secret. It stays one stable `d` per Pin and target, and reveals neither.
   - **Who reads it.** The pin operations decrypt for their callers, who are the owner and admins, since every operation is owner-and-admins (`src/operations/declaration.js`). Spawning and the Dictionary page decrypt inside the server. A route that answers for a viewer named in its query string, as the Pinned tab's and the Dictionary's do, shows a private pinning only to that viewer's own session.
   - **Private keeps the pinning, not what its Pin makes.** A Trusted List that `spawns-trusted-list` publishes is public, and says what it lists. So where a person pins privately to a Pin whose action publishes, the UI says so before the click (Show and Tell's first question: "Do they know?").

6. **Pin, exclude, unpin: polarity, at one `d`.** `+` is `polarity 1`, `−` is `-1`, and an unpin is `polarity 0`, which replaces the pinning at its `d` (§ 3.1, § 4). The node stays, with polarity 0. A new pinning is never deleted with NIP-09: `polarity 0` carries its `z`, so it reaches the readers that find pinnings by their Pin, which today's deletions never do. Readers keep honouring the deletions of old pins. This answers § 11's question 2 with "adopt it", for G5.7 to write down.

7. **What counts as pinned is the owner's own stance, worked out when it's read.**
   - For one Pin and one owner, a target is pinned when the owner's latest pinning of it has polarity at least 0.5, and excluded at −0.5 or less (§ 3, § 6.1).
   - Anything the owner never pinned, or unpinned, isn't pinned in this book. § 6.1's community default is out of its scope (spec, "Out of scope").
   - The owner's stance comes from Decision 3: for the instance, its own pinnings, private ones included; for a person, their own signed pinnings; and for the owner, their own signed pinning over the instance's.
   - Nothing stores the result (architecture invariant 3).

8. **How tag-pinning moves.**
   - **New pins of a Tag are `spawns-trusted-list` pinnings,** generic, as § 3's interim rule says, made from the Tag page's Pin button.
   - **What a pin spawns, and how, leaves the wire** (§ 7). A pinning's curation is which lists it spawns (people, notes), the observer, the method, the cutoff and the note method.
     - **For the instance's own pinnings,** it is in the pinning's payload (Decision 2), so it stays in the graph, a backup carries it, and it goes out only as ciphertext. That is the form the draft gives the owner's private Trust Determination Methods (§ 7; W22), here kept on the pinning rather than in a method event of its own.
     - **For a person's own signed pinning,** it is in that person's prefs file on the instance (`/var/lib/brainstorm/user-prefs/<pubkey>.json`, `src/api/settings/userPrefsApi.js`), keyed by the pinning's `d`, as their point-of-view settings are.
     - **A new-form pinning with no curation gets today's defaults,** not "unsupported". Today a pin whose curation can't be read is skipped, and the run then retracts the lists it spawned before (`parseCurationMethod`, `retractStaleTLs`).
   - **The observer still defaults to the pinner,** and to the owner for the instance's pinnings. So a moved pin's Trusted Lists keep their `d` tags, `tl-pin-<obs8>-<tagAuthor8>-<slug>` and `tl-pin-notes-…`, and whatever follows them keeps working.
   - **Spawning reads both forms.** `enumeratePinnedTags` (`src/api/trustedList/refreshPinnedTags.js`) is the one gatherer for the daily task and the per-viewer refresh. It unions the old pins from the relay, the instance's pinnings from the graph, and people's signed new-form pinnings from the relay. `refreshOnePinnedTagById` takes the same sources. A Tag one pinner has pinned in both forms counts once, and the new form wins.
   - **A source that fails stops the run.** Retraction trusts what the gatherer returns, so a graph read that failed and answered nothing would retract every list the graph's pinnings spawned. The graph source throws instead, and the run retracts nothing.
   - **The owner's old pins move by re-mint** (BIBLE §31): one operation writes each of the owner's tag pins as the instance's pinning, with its curation, in a single auditable act. The owner may then sign the old pins' deletions, but needn't, since readers count a Tag pinned in both forms once. Other people's old pins keep counting until they pin again in the new form, which their Tag page offers.
   - **ADR 0015's legacy key stays,** for reading old pins. The new concepts never use it, and the `LEGACY_*` constants stay where they are.
   - **"Most pinned"** (`aggregateTagPins`) counts both forms, as it counts pins today. Whether it should count them at all is the reuse hazard's question, and out of scope.
   - **NIP-51 exports** stay with the person who pins in the browser, signed by them, as in ADR 0017. The instance's own pinnings export nothing under the Assistant's key in this book.

9. **The Dictionary page's Add and Veto are `add-to-dictionary` pinnings.**
   - **Add** pins the shared concept's header to `add-to-dictionary` (`+`), then makes the row as Add does today: the instance's own header, wired to the shared one (§ 8.1's action; `ui/src/pages/dictionaries/Concepts.jsx`).
   - **Veto** pins it `−`, and **Restore** unpins it (`polarity 0`).
   - **A row's `override`** is the owner's stance on the row's shared concept, matched on its `sharedCoord`: `'added'` for `+`, `'vetoed'` for `−`, and `null` for none (`src/lib/trustedDictionary.js`, read where `assembleConceptDictionary` gathers its inputs in `src/api/adoption/index.js`).
   - **An added row is kept** even where the evidence and threshold check would drop it. The `+` pinning is the hand-added mark that automation never removes (`docs/DICTIONARY_PAGE_HANDOFF.md` § 3).
   - GUM₃, the community's sum of these pinnings, stays out of scope.

10. **The operations: a `pin` group in the app layer.**
    - **A new group, `pin`,** in `src/operations/groups.js` ("a design change, made here"), with its operations under `src/operations/catalog/pin/`. Each is declared once, so its route, internal CLI command and `/docs` entry come from its declaration. The external CLI picks them up from `GET /api/tapestry/operations` with no change of its own.
    - **`pin make`** makes a Pin: an element of `pin`, at `d` = its slug, with the § 2 tags.
    - **`pin set`** pins, excludes or unpins a target on a Pin, publicly or privately (Decisions 4 to 6).
    - **`pin list`** lists the Pins.
    - **`pin read`** gives a Pin's pinnings, or one target's stance on every Pin, worked out as Decision 7 says, with private pinnings decrypted.
    - **`pin move`** re-mints the owner's old tag pins (Decision 8).
    - Every one is owner-and-admins, as every operation is. Each is a combination of the module's operations (catalog, "The app layer"), with Decision 2's extensions.

11. **Readers outside Tapestry.** Tapestry writes only the new form. Brainstorm-UI's reader of a person's own pins learns the new form in a follow-up in its own repo. Until then it shows only old pins, which is all its switched-off writer could make.

12. **What the draft gains,** which Loom G5.7 writes down:
    - `polarity 0` as the unpin (§ 11, question 2);
    - a private pinning's keyed `h8` (§ 3.1, § 9);
    - generic pinnings for moved pins, with what they spawn kept off the wire (§ 7, § 10);
    - and nothing about how Tapestry's graph holds a Pin, which isn't wire format.

## Consequences

- **Enables:**
  - Pins for any reason, made by anyone with an operation, and pinnings of DList headers as well as of Tags.
  - Private pinnings that visitors can't read and that never leave the instance.
  - An agent pinning through the external CLI with the operations it already uses. G6.4's alert Pin is made and read the same way.
  - The Dictionary page's Add and Veto, and the hand-added mark its rule has waited for.
  - Unpins that reach readers, which today's deletions never do.
- **Costs:**
  - Two writers, the graph and the browser, and old pins to union with both until every old pin has moved.
  - The module grows: a fixed `d` and extra tags for elements, in `create-element`, `update-node`, firmware element files and both installs, while the firmware move is still to come (ADR 0043).
  - A private pinning, and the instance's every pinning's curation, can be read only with the Assistant's key. Lose the key and they're lost. A restore that brings the key back brings them back.
  - A private pinning's existence shows: its `d` and its Pin are in the clear, as § 9 has it.
  - Private hides the pinning, not what its Pin publishes (Decision 5).
  - A pinning's letter carries `name` and `json` tags the draft doesn't name.
  - Another person's curation lives in their prefs file, outside the graph, so a backup doesn't carry it.
- **Follow-ups:**
  - Brainstorm-UI's reader of a person's own pins, in its repo (Decision 11).
  - The draft's changes (Decision 12), for G5.7, among them the leak in § 3.1's plain hash, which W22's encrypted letter has as well.
  - The community's pinnings in an owner's view (§ 6.1), GUM₃, and the reuse questions about "Most pinned".
  - A Pin as a list header in the graph, with the DList Header Declaration draft.
  - Curation as Trust Determination Methods of their own, and W22's encrypted letter for private pinnings.
  - Catalog § 10, question 1, still open for every other node that was never published.
- **Firmware reinstall required: yes.** Two new concepts, and two elements of `pin`. If they land before the first firmware release is cut (A10.45), that release carries them; otherwise a later one does.

## Implementation notes

- **The concepts.** `firmware/versions/v1.0.0/concepts/pin/` and `concepts/nostr-pinning/`, each with `concept-header.json` and `json-schema.json`, and `pin/elements/` with the two Pins, each with its `d` and tags (Decision 2). Global entries in `firmware/versions/v1.0.0/manifest.json`, in the `tag` category beside `tag-pinning`, with no `communityReference`, and a changelog line.
  - `pin`'s section, `pin`: `name`, `plural`, `description`, `spawns` (`list` or `dictionary`, or absent for a Pin that triggers nothing), `for` (content-category coordinates) and `use` (`display`, or absent).
  - `nostr-pinning`'s section, `nostrPinning`: `pin` (the Pin's coordinate), `target` (the target's coordinate), `polarity` (`1`, `0` or `-1`), `private` (true, or absent) and `payload` (the NIP-44 string). A private pinning's section has no `target` or `polarity` in the clear.
- **The module.** `src/operations/catalog/graph/create-element.js` with `graph/_elements.js` (the `d` at :360-367, the tags at :389-391), for the fixed `d` and the extra tags; `graph/update-node.js` (:313), for tags; and `src/firmware/target.js` (:321-338) and `src/firmware/install.js` (:253-342), with seed-firmware's builder beside them, for firmware element files.
- **Export.** The own nodes it signs are chosen at `src/operations/catalog/export/_letters.js:57-69`. A node marked private is left out there, whatever the scope.
- **The operations.** `src/operations/groups.js` gains `pin`, and the operations go under `src/operations/catalog/pin/`. NIP-44 comes from nostr-tools 2.10.4's `nip44`, with the Assistant's keys from `getOwnerAssistantKeys`. The keyed `h8` is an HMAC-SHA256 under a key derived from the Assistant's secret with a fixed label. The story that builds private pinnings picks the derivation, and records it in an amendment here.
- **Spawning.** `enumeratePinnedTags` (`src/api/trustedList/refreshPinnedTags.js:80-86`) and `refreshOnePinnedTagById` (:257) take the graph's pinnings and the relay's new-form pinnings beside the old pins, and the graph source throws when it fails. `refreshOnePinnedTagById`'s pinner check (:256-268) also lets the owner and admins refresh the instance's pinnings. `parseCurationMethod` (`src/api/profile-tags/index.js:587-600`) keeps reading old pins. A new-form pinning takes its curation from its payload or the prefs file, else the defaults.
- **The pin reads.** `handlePins` (:1562), `viewerPin` (:841) and `aggregateTagPins` (:730) in `src/api/profile-tags/index.js` read pins through a wrapper of their own, not `federatedScan` itself, which tag and assertion reads also use. A private pinning shows only to its viewer's own session.
- **The Dictionary.** Read the owner's `add-to-dictionary` stances in `assembleConceptDictionary` (`src/api/adoption/index.js:386-400`), pass them to `computeConceptDictionary`, set `override` at `src/lib/trustedDictionary.js:199`, and let an added row past the check at :111-112. Veto and Restore are enabled in `ui/src/pages/dictionaries/ConceptEntry.jsx` (:535, :565-571).
- **The UI.** The Tag page's Pin button (`ui/src/pages/Tag.jsx:124-178`) calls `pin set` for the owner and admins, and signs the new form in the browser for everyone else (`ui/src/utils/publishTagPin.js`). A DList's page gets a Pin control of the same kind.
- **Tests the Tester moves** (Phase 3, not implementation). `test/graph-rule-firmware.test.js` GF6, GF7 and GF13 hold the firmware concept order and BIBLE §7's concept and category counts, which say 41 concepts today.

## Out of scope

- **The alert Pin and the alerts** (G6.4), and the alert Pin's entry in the draft (G6.5).
- **The community's pinnings** in an owner's view (§ 6.1), GUM₃, and whether "Most pinned" should count pins at all.
- **Pinning contexts** (§ 3, pending review).
- **`spawns-score`, `spawns-concept` and the display Pins.** `includeScoreInTL` stays ignored, as it is today, rather than becoming a pinning on `spawns-score` (§ 10).
- **W22's encrypted letter** for private pinnings, and Trust Determination Methods as events of their own.
- **A Pin as a list header in the graph.**
- **Brainstorm-UI's reader,** which is that repo's follow-up.
- **NIP-51 exports of the instance's pinnings.**
- **Retiring ADR 0015's legacy key.**
- **Catalog § 10, question 1,** for every node that isn't a pinning.
