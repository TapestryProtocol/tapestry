# ADR 0001: Pins and pinnings live in the graph as the instance's own, and go out under its Assistant's key

**Status:** Accepted (the owner, 2026-11-22: Option A, as drafted)
**Date:** 2026-11-22
**Story:** `docs/loom/G5.6.md` (the epic's spec; its stories follow this decision)

Three documents are cited by short name. The **draft** is [protocols/drafts/pins.md](../../../protocols/drafts/pins.md), Pins & Pinnings, Draft 3, a pre-NIP; "§ n" means a section of it. The **catalog** is [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md). The **design doc** is [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md), whose decisions are D1 to D15.

## Context

The book is [pins-and-pinnings](../../audits/pins-and-pinnings/book.md): build the draft in Tapestry, so that a person, or an agent working for them, pins a DList header or a Tag to a named Pin, one Pin for each reason, publicly or privately. Its acceptance frame is Loom G5.6's done-when: the pin concept and its first Pins in the graph, made local-first; pinning and unpinning a DList or a Tag, publicly or privately; tag-pinning's pins moved onto the new Pins (§ 10), with their Trusted Lists still spawning; and an agent pinning through the external CLI.

### Today's one kind of pin

- **The concept.** `tag-pinning` is a firmware concept (`firmware/versions/v1.0.0/concepts/tag-pinning/`). Its schema holds `tagPinning.tagEventId` and a `curationMethod` object with no inner schema. Readers find pins by `z` to the canonical handle, `39998:<LEGACY_Z_TAG_PUBKEY>:tag-pinning`, under ADR 0015's named exception (`src/api/profile-tags/index.js`; `CLAUDE.md`, "Per-deployment TA pubkey").
- **A pin** is a kind-`39999` event the pinner signs in the browser: `d` is `tag-pin-<slug>-<tagAuthor8>-<viewer8>`, an `e` and an `a` name one Tag, `z` names `tag-pinning`, and a `curation-method` tag carries JSON with the observer, method, cutoff, `includeScoreInTL`, `targetTypes` (people, notes) and `noteMethod` (`pinTag` in `ui/src/utils/publishTagPin.js`). It goes to the instance's relay and to public relays.
- **No server route writes a pin.** A pin reaches Neo4j only when the relay's events are imported: by the legacy batch transfer (`src/manage/concept-graph/batchTransfer.sh`), by `POST /api/neo4j/event-update` (`src/api/neo4j/eventSync.js`), or by import nostr.
- **Unpinning** is the pinner's NIP-09 deletion, which names the pin by `e` only (`unpinTag`). It carries no `z`, so it never reaches readers who find pins by their concept (ledger `2026-09-27-revokes-do-not-travel`).
- **Spawning.** `src/api/trustedList/refreshPinnedTags.js` reads every pin from the instance's relay and turns each into a kind-`30392` Trusted List of people, `d` `tl-pin-<obs8>-<tagAuthor8>-<slug>`, and, when the pin's target types include notes, a kind-`30393` list of notes. The instance's Assistant signs both (`getOwnerAssistantKeys`). They are built on pin, on a curation edit, on Apply or Dispute, from the Export dialog, from "Refresh all", and by a daily task that ships switched off. Only the `nip85:rank` method is offered, and `includeScoreInTL` is ignored.
- **Also on the click:** NIP-51 lists of the Tag's people and notes, signed by the pinner (ADR 0017). Pins are counted, per Tag, in the Tags directory's "Most pinned" sort.
- **Not there at all:** a private pin, a pin of anything but a Tag, and a graph operation that makes a pin.

### Outside Tapestry

Brainstorm-UI reads a person's own tag pins by the `tag-pinning` handles (`client/src/services/tags.ts` on its staging, 2026-11-20). Its writer for them ships switched off (`TAG_PINS_ENABLED`). Its two open proposals about Trusted Lists, P-145 and P-146, lean on the draft's wire format.

### What binds the choice

- **The self is the graph** (BIBLE §30). Neo4j is the definitive "me", and a signed event is a letter. A write that is never published is a private thought, and publishing is optional.
- **The instance's key is its Assistant's** (BIBLE §31). Every first-person question the instance asks is answered by `authors:[TA]`. The owner is the principal correspondent, maximally trusted and never conflated with the instance. Owner-authored letters enter the instance's brain only by an explicit act, re-mint or pointer, chosen per feature in its ADR.
- **The graph operations** (`graph-operations-foundation` ADRs 0001 and 0004; the design doc's D1 and D2).
  - Each operation is declared once, and its route, internal CLI command and `/docs` entry come from that declaration.
  - Every write checks its guards, is safe to repeat, records a change entry, and never signs (catalog, "Every write").
  - No operation both writes and publishes. A caller combines the two, "create, then publish", since publishing is a deliberate act (D2).
  - Export nostr signs, as the instance's Assistant, for the owner or an admin (catalog § 10, question 2, answered 2026-11-20).
  - Operations that only make sense for one kind of concept sit in an app layer above the generic module (catalog, "The app layer").
- **Reads are open.** Visitors can read every node, with its tags and its JSON, and every change entry, which is a node too (catalog § 10, question 1, still open; `src/middleware/routeAccess.js`; `src/operations/changes.js`).
- **The firmware is moving** (`graph-operations-first-slice` ADR 0043). It will ship as pinned releases, installed as each instance's own nodes under its Assistant's key, and the first release is to equal today's `firmware/versions/v1.0.0` files.
- **The architecture invariants.** Accept every signed pinning, filter by point of view when reading, and work an effective set out when it is read, never storing it as a result.

### The owner's direction

On 2026-11-22, before this ADR was written, the owner approved the direction of four of the choices below:
- the concepts in firmware under each instance's Assistant (Decision 1);
- the owner and admins pinning through graph operations, while other people sign their own pinnings in the browser (Decision 3);
- a private pinning never published, and kept from visitors (Decision 5);
- a moved pin going out generic, with what it spawns kept as an instance setting off the wire (Decision 8).

The other choices, and the mechanisms of all of them, are the Architect's. Where a mechanism differs from the direction as it was put to the owner, its decision says so.

## Options considered

### Option A — Pins and pinnings in the graph, as the instance's own

The `pin` and `nostr-pinning` concepts and the first Pins are firmware, so every instance installs them as its own nodes. The owner and the instance's agents pin through graph operations, which write a pinning node and never sign. The caller then sends a public pinning with export nostr, as a letter the instance's Assistant signs. Everyone else keeps pinning in the browser, under their own key, in the new form.

- **Pros:** the done-when's "made local-first" in full: the graph holds every Pin and the instance's every pinning, and a private pinning needs no letter at all. An agent pins with the operations it already uses. It follows BIBLE §31's first-person rule, and firmware's own road under ADR 0043.
- **Cons:** two writers, the graph and the browser, and readers must union them with the old pins. The element writes must learn to give a node the pinning's fixed `d` and its tags.

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

**Option A.** Pins and pinnings are nodes of the instance's own, made through graph operations, and the instance's Assistant signs what goes out. Everyone else keeps pinning in the browser, under their own key, in the new form.

1. **The concepts and the first Pins: firmware, under each instance's Assistant.**
   - Two firmware concepts, which the install writes as the instance's own nodes, as it writes every firmware concept (ADR 0043, Decision 1):
     - **`pin`**, handle `39998:<TA>:pin`: the concept of Pins. Its elements are Pins.
     - **`nostr-pinning`**, handle `39998:<TA>:nostr-pinning`: the concept of pinnings. Its elements are pinnings.
   - `<TA>` is the instance's Assistant, read at runtime. Neither concept joins ADR 0015's exception, and neither has a community reference.
   - **Two Pins ship as firmware elements of `pin`,** each at `d` = its slug and with the draft's tags (§ 2):
     - **`spawns-trusted-list`** (`spawns` `list`), at `39999:<TA>:spawns-trusted-list`. In this book it takes Tags only. Its `for` names the Tags concept, `39998:<TA>:tag`, and `pin set` refuses a DList header on it, since nothing yet spawns a Trusted List from a DList header (§ 8.1's Supported DLists).
     - **`add-to-dictionary`** (`spawns` `dictionary`), at `39999:<TA>:add-to-dictionary`, for DList headers. Its `for` waits for the Content Categories draft's DList-headers item, which no concept holds yet. `for` is a hint, never a gate.
   - **Every other Pin is made by an operation** (Decision 10), since anyone may make one (§ 1). G6.4's alert Pin is made that way.
   - **Across deployments,** each instance's Pins are its own. An outside reader finds a deployment's pinnings under that deployment's Assistant, as Brainstorm-UI already reads tag pins under more than one handle. One Pin for every deployment is worksheet W1's question, and stays there.

2. **A Pin and its pinnings in the graph: elements, found by their tags.**
   - **A Pin is an element of `pin`,** a `ListItem` like any other. Its `d` is its slug, and its letter carries the draft's § 2 tags: `names`, `description`, `spawns`, `for`, `required` and `allowed`. It isn't a `ListHeader` in the graph. No node is both today: import labels a letter by its kind alone, every header lookup needs `ListHeader` or `ConceptHeader`, and five element operations refuse a header-labelled node as made elsewhere (`src/operations/catalog/import/_letters.js`, `graph/_fields.js`, `graph/_elements.js`). Making a kind-`39999` a header in the graph is the work of the DList Header Declaration draft, and waits for it.
   - **A pinning is an element of `nostr-pinning`.**
     - Its `z` to that concept gives it its `HAS_ELEMENT`, as every element's `z` does.
     - **Its name is its `d`,** which is unique per Pin and target. A repeated `create-element`, whose repeat key is the concept and the name, is then the same pinning, and the name tells a visitor nothing the `d` doesn't.
     - A public pinning's `z` to its Pin, its `a` and its `polarity` are tag nodes, made as import makes them. Its `a` tag gets a `REFERENCES` edge to its target when the target is in the graph, and none otherwise. Readers resolve a target by its address.
     - A `z` naming a kind-`39999` wires no edge today. A direct Pin-to-pinning `HAS_ELEMENT` would be an edge that export reports as uncarried (`export/_letters.js`). So the pin operations find a Pin's pinnings by their `z` tag, and the graph's header model is left as it is.
   - **A pinning's JSON** is its section, `nostrPinning`.
     - A public pinning's holds its Pin, its target, its polarity and its curation (Decision 8), in the clear.
     - A private pinning's holds its Pin, `private`, and a `payload`: one NIP-44 string the Assistant encrypts to itself, which holds the target, polarity, context and curation (Decision 5).
   - **A pinning's letter carries no `json` tag.** The `nostr-pinning` header says so in its `x-tapestry` settings, and export leaves the tag out for that concept's elements. So the curation on the node never reaches the wire, as § 7 has it. The letter holds the draft's tags, plus a `name` that repeats the `d`.
   - **Extensions of the module** make this possible:
     - The helpers the element writes share (`graph/_elements.js`, with `graph/_eventless.js` for tags) take an optional fixed `d` and extra tags, for an app-layer concept whose wire form fixes them, and the pin operations use them. A `d` that is taken is refused, not given a suffix. The tags the module writes itself (`d`, `name`, `n`, `s`, `b`, `json`, and the concept's own `z`) can't be passed. A further `z`, such as a pinning's to its Pin, can, if it names no concept header. An instance that imports the letter files a node under every concept whose header one of its `z` tags names (`import/_letters.js:228-231`, :584), so a further `z` naming one would file the node under that concept there.
     - The same helpers change a tag's value on an own node, as `pin set` does to a pinning's polarity.
     - **The generic writes refuse the pin concepts' elements.** `graph create-element`, `add-to-concept`, `update-node`, `delete-node` and the membership writes refuse an element of `pin` or `nostr-pinning` as made elsewhere, as they already refuse the elements of other concepts that another operation looks after.
       - Two lists hold those concepts, and both gain the two. `create-element` and `add-to-concept` read `MADE_ELSEWHERE` (`graph/_elements.js:88`). `update-node`, `delete-node`, `remove-from-concept` and `move-element` read `CHANGED_ELSEWHERE` (:108), and so does `add-to-concept`, for the node itself (`add-to-concept.js:112`).
       - The refusal names the pin operation to use: `pin make` for `pin`, and `pin set` for `nostr-pinning`.
       - Firmware installs the two well-known Pins through neither list, as it installs every element. `pin` doesn't set the manifest's `updateElements`, so a reinstall leaves installed Pins as they are.
       - So the pin operations are the only operations that write the instance's Pins and pinnings, and the one-live-stance rule holds for every operation (Decision 7). Two paths that can write any node still bypass it: the legacy `/api/normalize/*` routes, which are owner actions (`src/middleware/routeAccess.js`), and raw write Cypher (catalog § 10, question 4).
     - A firmware element file takes the same `d` and tags, as a header file takes `headerTags`. Both installs honour them. Seed-firmware's builder is `src/firmware/target.js`. Today's install makes elements through `POST /api/normalize/create-element` (`src/firmware/install.js:325-329`), which already takes a `dTag` (`src/api/normalize/index.js:1908`) and needs the tags.
     - Export reads a concept header's `x-tapestry` settings for whether its elements' letters carry `json`.

3. **Whose a pinning is.**
   - **The owner pins through the graph from the UI, and the instance's agents through the external CLI.** The UI calls the operations when the signed-in person is the owner. An agent is an admin, and pins through the same operations. A pinning made that way is the instance's own, and the instance's Assistant is its letter's author (BIBLE §31).
   - **Everyone else signs their own pinnings** in the browser, in the new form, as they sign tag pins today. That includes an admin who pins from the UI. Their pinnings are letters, read from the relay and counted for their author's own point of view.
     - This keeps an admin's own Trusted Lists at their own addresses, and lets them unpin their old pins from the Tag page.
     - It narrows the direction put to the owner, under which every admin pinned through the graph. An admin still can, through the CLI.
   - **The owner's own signed pinnings,** made with the owner's own key in another client, are a correspondent's letters (BIBLE §31). They enter the instance's view only by an explicit act, `pin move`'s re-mint (Decision 8), never by being read (Decision 7).
     - An outside reader asking what the owner thinks may read them before the instance's, as a personally signed header wins in assistant-designation (BIBLE §31, "The external layer").
     - That is a reader's rule, for the draft, and this book doesn't build it.

4. **Writing a pinning, then sending it.**
   - **`pin set` writes, and never signs,** like every write (catalog, "Every write"; D1). The caller publishes a public pinning with export nostr, with the pinning as its `node` scope, to the instance's own relay and to any relays it names. The UI does both in turn, and an agent runs `export nostr` after `pin set`. That is D2's "create, then publish".
   - **If the send fails,** the pinning stands in the graph, which is the self, and the caller is told. Export's dry run lists the pinning as new or changed, and the next export sends it.
   - **A Pin goes out before its pinnings.** A letter whose tag names an own node with no letter is reported `unsent-reference` (`src/operations/catalog/export/_letters.js`). The firmware Pins have letters from the install, and the caller exports a Pin that `pin make` made before that Pin's first public pinning.
   - **The letter** is built as every element's is: its `d`, its `name`, its `z` to `nostr-pinning`, and every tag node it holds, which are its `z` to its Pin, its `a` and its `polarity`. It has no `json` (Decision 2).
   - **Its `d` is the draft's** (§ 3.1), `pin-<pinSlug>-<h8>-<owner8>`, where the owner is the instance's Assistant.
   - **Export never signs a node marked private,** in any scope, `everything` included (Decision 5).

5. **A private pinning is encrypted where it lies, and is never sent.**
   - **Never published** in this book, as the owner chose. Export skips it in every scope. The draft's encrypted letter (§ 9, W22) is left for when a private pinning has to leave the instance.
   - **Encrypted at rest.** Visitors can read every node, with all its tags and its JSON, today. The concept-graph routes, the read path of `/api/neo4j/query` and `/api/tapestry-key/:key` need no sign-in, and none of them filters by label or property (`src/middleware/routeAccess.js`; catalog § 10, question 1).
     - A filter on each of those routes, and on any Cypher a visitor may send, isn't a guard anyone could trust.
     - So a private pinning's target, polarity, context and curation are only in its payload (Decision 2), the form W22 gives the letter, and the node is marked `["private", "1"]`. It has no `a` or `polarity` tag node. Its Pin and its `d` stay in the clear, as in § 9.
     - This is how it is kept from visitors: by encryption, where the direction put to the owner said the read routes would hide it.
   - **Its `d` names no target.** The draft's `h8` hashes the target in plain (§ 3.1), so anyone could hash the known DList headers and Tags until one matches. A private pinning's `h8` is a keyed hash instead, under a key derived from the Assistant's secret. It stays one stable `d` per Pin and target, and reveals neither.
   - **Nor does anything written about it.** A change entry is a node, and visitors can read it (`src/operations/changes.js`). A private pinning's change entry records its `d`, its Pin and that it is private, and never its target, polarity, context or curation in the clear.
   - **Only the instance pins privately** in this book. A private pinning is made through the graph, so it is the instance's (Decision 3). A person who pins in the browser pins publicly: a private pinning of their own would need NIP-44 in their own signer.
   - **Who reads it.**
     - The pin operations decrypt for their callers, who are the owner and admins, since every operation is owner-and-admins (`src/operations/declaration.js`). So "private" means private from visitors, not from the instance's admins, whose operations read the whole graph.
     - Spawning and the Dictionary page decrypt inside the server.
     - A route that answers for a viewer named in its query string, as the Pinned tab's and the Dictionary's do, shows a private pinning only to that viewer's own session.
   - **Switching between public and private.** The two forms have different `d` tags for the same Pin and target, so `pin set` keeps one live stance across both: it writes the new form, and sets the other to `polarity 0`. Going private, the caller then sends the public pinning's `polarity 0`, so readers see it unpinned. The public pinning's history stays public, and the timing of the switch can be read beside the new private pinning's appearance.
   - **Going private where the owner's own public stance stands.** Two public stances signed by the owner can name the same target on the same Pin: an old tag pin, which is a `spawns-trusted-list` stance (§ 10), and a new-form pinning the owner signed in another client. Other instances read both, and Brainstorm-UI reads the old pins.
     - So `pin set` refuses to make a pinning private while either stands on the instance's relay, an old pin not yet deleted or the owner's new-form pinning at a polarity other than 0, and says why.
     - The UI then has the owner sign what clears it, in the browser: the old pin's NIP-09 deletion, or a `polarity 0` of the new-form pinning, since a new pinning is never deleted (Decision 6). It pins privately once that is sent. An agent is refused the same way, and the owner clears the stance.
     - Clearing it can't reach every relay that holds a copy (ledger `2026-09-27-revokes-do-not-travel`), so a copy can outlive the switch. And `pin set` sees only the instance's relay, so a public stance the owner signed elsewhere and never sent there goes unseen.
   - **Private keeps the pinning, not what its Pin makes.** A Trusted List that `spawns-trusted-list` publishes is public, and says what it lists. So where a person pins privately to a Pin whose action publishes, the UI says so before the click (Show and Tell's first question: "Do they know?").

6. **Pin, exclude, unpin: polarity, at one `d`.** `+` is `polarity 1`, `−` is `-1`, and an unpin is `polarity 0`, which replaces the pinning at its `d` (§ 3.1, § 4). The node stays, with polarity 0. A new pinning is never deleted with NIP-09: `polarity 0` carries its `z`, so it reaches the readers that find pinnings by their Pin, which today's deletions never do. Readers keep honouring the deletions of old pins. This answers § 11's question 2 with "adopt it", for G5.7 to write down.

7. **What counts as pinned is one stance, worked out when it's read.**
   - **One stance, from one source.** For a view, a Pin and a target, one stance counts. The target is pinned when its polarity is at least 0.5, excluded at −0.5 or less, and unpinned otherwise, `polarity 0` included (§ 3, § 4, § 6.1).
   - **The instance's view** is the owner's pins and Dictionary on the instance, and what its agents act on.
     - If the instance has any pinning of the target on the Pin, the stance is the instance's. The pin operations, the only writers of the instance's pinnings (Decision 2), keep at most one of its pinnings of a target on a Pin at a polarity other than 0, across the public and private forms (Decision 5). The stance is that one's, or unpinned when every one is at 0.
     - Otherwise, the owner's old tag pin counts, as it counts today, until `pin move` re-mints it.
   - **Anyone else's view.** If the person has a new-form pinning of the target on the Pin, the stance is their latest one at its `d`, at whatever polarity, and `0` is unpinned. Otherwise their own old pin counts.
   - **So an old pin never comes back.** Once a target has a new-form stance on a Pin, its old pin no longer counts there, whatever that stance's polarity.
   - **The owner's own signed pinnings** don't count in the instance's view until re-minted (Decision 3).
   - **Silence isn't pinned.** Anything the owner never pinned, or unpinned, isn't pinned in this book. § 6.1's community default is out of its scope (spec, "Out of scope").
   - **Nothing stores the result** (architecture invariant 3).

8. **How tag-pinning moves.**
   - **New pins of a Tag are `spawns-trusted-list` pinnings,** generic, as § 3's interim rule says, made from the Tag page's Pin button.
   - **What a pin spawns, and how, leaves the wire** (§ 7). A pinning's curation is which lists it spawns (people, notes), the observer, the method, the cutoff and the note method.
     - **For the instance's own pinnings,** it is in the pinning node's JSON: in the clear for a public pinning, whose letter carries no `json` (Decision 2), and in the payload for a private one. Either way it stays in the graph, and a backup carries it. That keeps the direction put to the owner, under which what a pin spawns is the instance's setting, off the wire. The setting is held on the pinning node, not in a settings file, so the graph holds it.
     - **For a person's own signed pinning,** it is in that person's prefs file on the instance (`/var/lib/brainstorm/user-prefs/<pubkey>.json`, `src/api/settings/userPrefsApi.js`), keyed by the pinning's `d`, where their point-of-view settings are. When a person pins again in the new form, the UI copies their old pin's curation into that file, so the observer and the cutoff carry over and the Trusted List keeps its `d`.
     - **A new-form pinning with no curation gets today's defaults,** not "unsupported". Today a pin whose curation can't be read is skipped, and the run then retracts the lists it spawned before (`parseCurationMethod`, `retractStaleTLs`).
   - **The observer still defaults to the pinner,** and to the owner for the instance's pinnings. So a moved pin's Trusted Lists keep their `d` tags, `tl-pin-<obs8>-<tagAuthor8>-<slug>` and `tl-pin-notes-…`, and whatever follows them keeps working.
   - **Spawning reads both forms.**
     - `enumeratePinnedTags` (`src/api/trustedList/refreshPinnedTags.js`) is the one gatherer for the daily task and the per-viewer refresh. It unions the old pins from the relay, the instance's pinnings from the graph, and people's signed new-form pinnings from the relay. It leaves out the owner's own new-form pinnings, which count only through their re-minted copies (Decision 7). It also leaves out letters the instance's Assistant signed, since the graph holds those, and a stale letter mustn't outvote it.
     - The per-viewer refresh counts the instance's pinnings as the owner's. Today it keeps a viewer's pins by their author.
     - A graph pinning is refreshed by its node, since a private one has no event id for `refreshOnePinnedTagById` to scan by.
     - A new-form pinning names its Tag by `a`, its stable address, while today's code finds the Tag by `e` (`parsePinTagEventId`). So the Tag is read at its address.
     - Which stance counts is Decision 7's.
   - **A source that fails stops the run.** Retraction trusts what the gatherer returns, so a graph read that failed and answered nothing would retract every list the graph's pinnings spawned. The graph source throws instead, and the run retracts nothing.
   - **The owner's old pins move by re-mint** (BIBLE §31).
     - One operation, `pin move`, writes each of the owner's tag pins as the instance's pinning, with its curation, in a single auditable act. It does the same for any new-form pinnings the owner signed in other clients.
     - It skips any target the instance already has a pinning of on that Pin, in either form. So it never writes over a stance the instance holds, and the instance keeps at most one live pinning of a target on a Pin (Decision 7).
     - Where the owner has both an old pin and a new-form pinning signed elsewhere for the same target, it re-mints the new-form one, as Decision 7 prefers new-form over old.
     - Once a Tag has the instance's stance, its old pin no longer counts (Decision 7). So the owner needn't sign the old pins' deletions, except before going private on one of those Tags (Decision 5).
     - Other people's old pins keep counting until they pin again in the new form, which their Tag page offers.
   - **ADR 0015's legacy key stays,** for reading old pins. The new concepts never use it, and the `LEGACY_*` constants stay where they are.
   - **"Most pinned"** (`aggregateTagPins`) counts each pinner once per Tag, by the stance that counts for them (Decision 7).
     - The owner's stance is the instance's view, and it passes the author filter, which keeps pinners above a rank, as the owner.
     - A private stance never counts, so an owner whose stance on a Tag is private counts for nothing there.
     - Whether it should count pins at all is the reuse hazard's question, and out of scope.
   - **NIP-51 exports** stay with the person who pins in the browser, signed by them, as in ADR 0017. The instance's own pinnings export nothing under the Assistant's key in this book.

9. **The Dictionary's Add and Veto are `add-to-dictionary` pinnings, each person's own.**
   - **Whose.** A Dictionary is per person (`ui/src/pages/dictionaries/Concepts.jsx`). The owner's Add and Veto are the instance's pinnings, and anyone else's are their own signed pinnings (Decision 3). The stance that counts is that of the person whose Dictionary it is (Decision 7).
   - **Add** pins the shared concept's header (`+`), then does what Add does today: a concept of the person's own, wired to the shared one and signed by their own Assistant (`Concepts.jsx`; § 8.1's action).
   - **Veto** pins it `−`, and **Restore** unpins it (`polarity 0`).
   - **The Concepts page** (`computeConceptDictionary`, which has no threshold) sets each row's `override` from that stance on the row's `sharedCoord` (`src/lib/trustedDictionary.js:199`): `'added'` for `+`, `'vetoed'` for `−` and `null` for none. A vetoed row stays listed, and marked. The page's code for that is in place, though today `override` is always `null` (`Concepts.jsx:31-33`).
   - **The Trusted Dictionary** (`computeDictionary`, behind `/api/trusted-dictionary`) sets its `override` the same way (`trustedDictionary.js:128`). There a `+` lets a shared concept past the evidence and threshold check (:111-112). That is the hand-added mark that automation never removes (`docs/DICTIONARY_PAGE_HANDOFF.md` § 3).
     - The check visits only the concepts that someone other than their author and the Assistant has filed under (`trustedDictionary.js:80-99`).
     - So the `+`-pinned concepts join the ones it visits, and a hand-added concept no one has filed under is kept with no evidence to count.
     - The check reads each concept's header from the headers the handler gathered, which are the kind-`39998` events on the instance's relay (`src/api/adoption/index.js:213-245`). So the handler first fetches, by its address, the header of each `+`-pinned concept the relay doesn't hold. One it can't find is left out of the Trusted Dictionary. After an Add, the person's own wired copy still shows it on the Concepts page. A `+` written without an Add, by `pin set` or `pin move`, has no wired copy. So it never shows on the Concepts page, and it shows in the Trusted Dictionary once its header is found.
   - **GUM₃,** the community's sum of these pinnings, stays out of scope.

10. **The operations: a `pin` group in the app layer.**
    - **A new group, `pin`,** in `src/operations/groups.js` ("a design change, made here"), with its operations under `src/operations/catalog/pin/`. Each is declared once, so its route, internal CLI command and `/docs` entry come from its declaration. The external CLI picks them up from `GET /api/tapestry/operations` with no change of its own.
    - **`pin make`** makes a Pin: an element of `pin`, at `d` = its slug, with the § 2 tags.
    - **`pin set`** pins, excludes or unpins a target on a Pin, publicly or privately (Decisions 4 to 6).
    - **`pin list`** lists the Pins.
    - **`pin read`** gives a Pin's pinnings, or one target's stance on every Pin, worked out as Decision 7 says, with private pinnings decrypted.
    - **`pin move`** re-mints the owner's old tag pins, and any new-form pinnings the owner signed in other clients (Decision 8).
    - **What they share.** Every one is owner-and-admins, as every operation is. They build on the module's shared element helpers, with Decision 2's extensions, and are the only operations that write the two concepts' elements (Decision 2). That departs from the catalog's app layer, whose operations are combinations of the module's ("The app layer"). The generic writes refuse these two concepts' elements, so the pin operations use the helpers, as `graph create-set` does for sets. The writes among them never sign (Decision 4).

11. **Readers outside Tapestry.** Tapestry writes only the new form. Brainstorm-UI's reader of a person's own pins learns the new form in a follow-up in its own repo. Until then it shows only old pins, which is all its switched-off writer could make.

12. **What the drafts gain, and where Tapestry differs from them.** Loom G5.7 writes down the Pins draft's. The Tapestry Concepts change is a follow-up of its own, filed with the stories.
    - an outside reader's rule: asked what a person pinned, it reads their own pinnings before their Assistant's, as assistant-designation does for headers (Decision 3);
    - `polarity 0` as the unpin (§ 11, question 2);
    - a private pinning's keyed `h8` (§ 3.1, § 9), and the plain hash's leak, which W22's encrypted letter has as well;
    - generic pinnings for moved pins, with what they spawn kept off the wire (§ 7, § 10);
    - Trusted Lists that keep their `tl-pin-` tags when their pins move, where § 10 has them "retracted in place as their replacements publish";
    - a pinning letter's `name` tag, which repeats its `d`;
    - a pinning letter with no `json` tag, where Tapestry Concepts carries an element's data in one (`protocols/drafts/tapestry-concepts.md`). That draft gains the exception, for a concept whose header says so;
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
  - The module grows: a fixed `d` and extra tags in the shared element helpers, firmware element files and both installs; two more made-elsewhere concepts; and an `x-tapestry` setting that export reads. All of this lands while the firmware move is still to come (ADR 0043).
  - A private pinning can be read only with the Assistant's key. Lose the key and it's lost. A restore that brings the key back brings it back.
  - Private means private from visitors. The instance's admins, its agents among them, read private pinnings through the operations.
  - A private pinning's existence shows, since its `d` and its Pin are in the clear (§ 9). A switch from public to private can be read from its timing.
  - Private hides the pinning, not what its Pin publishes (Decision 5).
  - Only the instance pins privately in this book, through the owner's UI or its agents' CLI. People who pin in the browser pin publicly.
  - Going private where the owner's own public stance stands waits for the owner to clear it (Decision 5). A copy on a relay the clearing never reaches outlives the switch, and a stance the owner never sent to the instance's relay isn't seen at all.
  - An admin who pins from the UI pins for themselves, not for the instance (Decision 3).
  - Another person's curation lives in their prefs file, outside the graph, so a backup doesn't carry it.
- **Follow-ups:**
  - Brainstorm-UI's reader of a person's own pins, in its repo (Decision 11).
  - The Pins draft's changes (Decision 12), for G5.7, and Tapestry Concepts' exception for letters with no `json`, a follow-up of its own.
  - Spawning Trusted Lists from DList headers pinned to `spawns-trusted-list` (§ 8.1's Supported DLists).
  - Private pinnings for people who pin in the browser, and W22's encrypted letter.
  - The community's pinnings in an owner's view (§ 6.1), GUM₃, and the reuse questions about "Most pinned".
  - A Pin as a list header in the graph, with the DList Header Declaration draft.
  - Curation as Trust Determination Methods of their own (§ 7).
  - Catalog § 10, question 1, still open for every other node that was never published.
- **Firmware reinstall required: yes.** Two new concepts, and two elements of `pin`. If they land before the first firmware release is cut (A10.45), that release carries them; otherwise a later one does.

## Implementation notes

- **The concepts.** `firmware/versions/v1.0.0/concepts/pin/` and `concepts/nostr-pinning/`, each with `concept-header.json` and `json-schema.json`, and `pin/elements/` with the two Pins, each with its `d` and tags (Decision 2). Global entries in `firmware/versions/v1.0.0/manifest.json`, in the `tag` category beside `tag-pinning`, with no `communityReference`, and a changelog line.
  - **`pin`'s section, `pin`:** `name`, `plural`, `description`, `spawns`, `for` (content-category coordinates) and `use` (`display`, or absent). `spawns` is a string: `list`, `score`, `concept`, `dictionary`, or a value a later action Pin defines, and it is absent for a Pin that triggers nothing.
  - **`nostr-pinning`'s header** sets, in its `x-tapestry` settings, that its elements' letters carry no `json`.
  - **`nostr-pinning`'s section, `nostrPinning`:**
    - `pin`, the Pin's coordinate.
    - For a public pinning: `target` (the target's coordinate), `polarity` (`1`, `0` or `-1`), and `curation` (`targetTypes`, `observer`, `method`, `cutoff`, `noteMethod`).
    - For a private one: `private: true`, and `payload`, a NIP-44 string whose plaintext is the JSON `{ target, polarity, context, curation }`.
- **The module.**
  - The shared element helpers. In `src/operations/catalog/graph/_elements.js`, the `d` at :360-367 and the tags at :389-391. In `graph/_eventless.js`, the tag changes, which `update-node` uses today to add a `name` tag (`update-node.js:27`, :313).
  - Both made-elsewhere lists gain `pin` and `nostr-pinning`:
    - `MADE_ELSEWHERE` (`_elements.js:88`), read at `create-element.js:115` and in `_memberships.js`;
    - `CHANGED_ELSEWHERE` (`_elements.js:108`), read at `update-node.js:172`, `delete-node.js:180` and `_memberships.js:203`.
  - The refusals' descriptions at `update-node.js:42`, `delete-node.js:54` and `_memberships.js:57` name the two concepts too.
  - For firmware element files: `src/firmware/target.js` (:321-338), which is seed-firmware's builder, and the old `POST /api/normalize/create-element` that today's install calls.
- **Export.** The own nodes it signs are chosen at `src/operations/catalog/export/_letters.js:57-69`, where a node marked private is left out, whatever the scope. The `json` tag is set aside at :146-151 and emitted in `build` (:371-373), where an element whose concept's header says so gets none.
- **The operations.**
  - `src/operations/groups.js` gains `pin`, and the operations go under `src/operations/catalog/pin/`.
  - NIP-44 comes from nostr-tools 2.10.4's `nip44`, with the Assistant's keys from `getOwnerAssistantKeys`.
  - The keyed `h8` is an HMAC-SHA256 under a key derived from the Assistant's secret with a fixed label. The story that builds private pinnings picks the derivation, and records it in an amendment here.
  - A private pinning's change entries (`src/operations/changes.js`) hold nothing in the clear that its node doesn't. Create-element's entry names the node, concept, name and slug (`create-element.js:199`), and the name is the `d`. Update-node's old and new values are payloads, never a target, polarity, context or curation.
- **Spawning.**
  - `enumeratePinnedTags` (`src/api/trustedList/refreshPinnedTags.js:80-86`) and `refreshOnePinnedTagById` (:257) take the graph's pinnings and the relay's new-form pinnings beside the old pins. The graph source throws when it fails.
  - The per-viewer refresh's author filter (:419) and `refreshOnePinnedTagById`'s pinner check (:256-268) take the instance's pinnings as the owner's.
  - `parseCurationMethod` and `parsePinTagEventId` (`src/api/profile-tags/index.js:587-616`) keep reading old pins. A new-form pinning takes its Tag from `a`, and its curation from its node or the prefs file, else the defaults.
- **The pin reads.** In `src/api/profile-tags/index.js`, `handlePins` (:1562), `handleTagById`'s `viewerPin` field (:838-855) and `aggregateTagPins` (:727-768) read pins through a wrapper of their own, not through `federatedScan` itself, which tag and assertion reads also use. A private pinning shows only to its viewer's own session.
- **The Dictionary.**
  - The Concepts page: `computeConceptDictionary`'s `override` at `src/lib/trustedDictionary.js:199`, with its inputs read where `assembleConceptDictionary` gathers them (`src/api/adoption/index.js:386-400`).
  - The Trusted Dictionary: `computeDictionary`'s `override` at :128, and its check at :111-112, behind `/api/trusted-dictionary` (`src/api/adoption/index.js`). The `+`-pinned coordinates join the set the check visits (:80-99), and :126's count of items takes none for a concept with no filer. The header of a `+`-pinned concept that the relay lacks is fetched before the check, which reads headers at :113-116.
  - Veto and Restore are enabled in `ui/src/pages/dictionaries/ConceptEntry.jsx` (:535, :565-571).
- **The UI.**
  - The Tag page's Pin button (`ui/src/pages/Tag.jsx:124-178`) calls `pin set` and then `export nostr` for the owner.
  - For everyone else it signs the new form in the browser (`ui/src/utils/publishTagPin.js`), and copies an old pin's curation into the prefs file.
  - A DList's page gets a Pin control of the same kind.
- **Tests the Tester moves** (Phase 3, not implementation):
  - `test/graph-rule-firmware.test.js`: GF6 holds the firmware concept order, and GF13 BIBLE §7's concept and category counts, which say 41 concepts today.
  - `test/operations/lifecycle/seed-firmware-target.test.js`: ST1 to ST5 pin today's install's addresses and tags, wherever a fixed `d` or extra tags change them. ST2's oracle, `test/helpers/todaysFirmwareRoutes.js`, needs the new `d` and tags too.

## Out of scope

- **The alert Pin and the alerts** (G6.4), and the alert Pin's entry in the draft (G6.5).
- **The community's pinnings** in an owner's view (§ 6.1), GUM₃, and whether "Most pinned" should count pins at all.
- **Pinning contexts** (§ 3, pending review).
- **Trusted Lists spawned from DList headers** pinned to `spawns-trusted-list`.
- **`spawns-score`, `spawns-concept` and the display Pins.** `includeScoreInTL` stays ignored, as it is today, rather than becoming a pinning on `spawns-score` (§ 10).
- **Private pinnings for people who pin in the browser,** W22's encrypted letter, and Trust Determination Methods as events of their own.
- **A Pin as a list header in the graph.**
- **Brainstorm-UI's reader,** which is that repo's follow-up.
- **NIP-51 exports of the instance's pinnings.**
- **Retiring ADR 0015's legacy key.**
- **Catalog § 10, question 1,** for every node that isn't a pinning.
