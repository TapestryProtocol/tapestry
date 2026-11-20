# Story 37: `lifecycle seed-firmware` — install or update the built-in concepts without undoing local edits

**Status:** Approved
**Created:** 2026-11-20
**Type:** Feature
**Loom:** A10.37 — https://loom.brainstorm.world/t/A10.37

## Background

Loom's A10.37 asks for one of lifecycle's writes (catalog §8):

- **`seed-firmware`:** "Install or update the built-in concepts, by the bootstrap path, without undoing local edits", taking "`version?`" and answering "installed". The catalog's Today column: "Signs: `POST /api/firmware/install`, which can also undo local edits."

Done, for Loom, is when "it is declared once; answers at `/api/tapestry/lifecycle/seed-firmware` for the owner only; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

**What binds it: ADR graph-operations-first-slice/0043** (Loom A10.43, merged into staging). Firmware is to ship as pinned Tapestry releases, each installed as nodes of the instance's own. For this task:
- **Decision 1.** "Seed-firmware writes each member of a release as a node of the instance's own, at the address the instance gives it today", all under the instance's assistant's pubkey. "Each node records the release letter it was last installed from, by address and event id. An update moves the record to the newer release's letter."
- **Also Decision 1.** "The release element isn't written as a node." Seed-firmware writes an installed-firmware graph instead: "an element of the `graph` concept that lists the nodes it wrote", which "names the release they came from", and "`lifecycle status` reports that release as the instance's firmware version".
- **Also Decision 1.** "Seed-firmware's writes never sign." It writes "by the bootstrap path … not through copy-node's guards", "in the order today's install uses, and `rules check` (A10.31) is to run over the result." Until export nostr can run the install's signing step, "today's install stays the install. It signs as it writes."
- **Also Decision 1, on the community references.** Decision 5 "keeps a `b` an admin set, as a local edit", which lifts today's reinstall caveat (BIBLE §22; OPEN.md row 8).
- **Decision 5.** "A node the release changes is brought in line unless an admin has edited it. An edited node is left as it is, and reported. The graph-rule items are the exception: every install keeps them in line with the rulebook, and puts back an edit (ADR 0041)."
- **Decision 8.** "It reports what it changed and what it left as it was. It may first land with today's files as its source, so that its keeping of local edits is built before a release exists."
- **The record's form.** "The install record and copy-node's link back should take one form, set by whichever is built first" (Decision 1; the design doc's §5, question 2, "came from"). Copy-node (A10.24) is proposed on Loom, and nobody owns it, so this story is first.

**Why now.** The owner's goal (Loom P-160) is to publish the firmware as a Tapestry, which a new instance installs by import, so that the firmware no longer lives in the repo. Import nostr (A10.32) is on staging. Export nostr (A10.34), which makes the releases and is to be the install's signing step, is being built beside this story. This story builds the part that needs no release: it writes the firmware as the instance's own nodes, unsigned, and keeps local edits across an update. Its source is today's files. A release becomes its source in a later story.

Twelve facts about today's code shape the story. They come from reading staging `79c8a098` on 2026-11-20; nothing was run.

1. **What today's install writes.** `src/firmware/install.js` reads `firmware/active` (`versions/v1.0.0`): 41 concepts, 87 element files and 22 set files.
   - **The letters:** each concept's header and seven other core nodes (328 letters), the elements, the sets, and for each set a relationship letter at a random d-tag (`create-set`). That is 459 letters, each signed with the assistant's key, published to the local relay and imported (BIBLE §7).
   - **Pass 1, in order:**
     - 1a, the concepts;
     - 1b, the elements;
     - 1c, core nodes wired as elements of other concepts;
     - 1c½, the sets, and the manifest's existing sets;
     - 1c¾, each concept manifest's `HAS_ELEMENT` and `IS_A_SUPERSET_OF`;
     - 1d, a `HAS_ELEMENT` from every superset to what names it in a `z` tag;
     - 1d½, the headers as elements of concept-header;
     - 1d¾, `ENUMERATES`;
     - 1e, the pruning;
     - 1f, the tapestryKeys.
   - **Pass 2:** each schema's full content.
   - **The six community references:** `nostr-relay`, `tag`, `nostr-user-tag`, `tag-pinning`, `nostr-event-tag` and `tagging-with-specific-tag`. The pass seeds a `pointer` b on the instance's own header, and fetches the curator's header and superset from relays.
   - **Pass 3:** derive, apply enumerations and wire implicit elements; then the community references' edges.
2. **What it undoes.**
   - **The headers and core nodes.** Pass 1a calls create-concept with `overwrite: true` (`install.js:196-203`). That re-signs "the replaceable header and core nodes, replacing the concept's definition and schema while its items stay" (`src/api/normalize/index.js:1230`).
   - **The schemas.** Pass 2 re-signs each schema from its file. Pass 3b re-signs each schema an enumeration reaches, through save-schema (`index.js:6306`). So a reinstall puts back every firmware header, core node and schema as its file says.
   - **A re-pointed `b`.** The rebuilt header has no `b`, so the community-reference seed finds none and seeds the firmware's default again. That reverts an operator's re-pointed one (OPEN.md row 8; BIBLE §22).
   - **Links.** Step 1d re-adds a direct `HAS_ELEMENT` that a `z` tag backs, "even one pruned by hand". Step 1e prunes a direct link from a firmware superset that a longer path also reaches, even one the owner made (BIBLE §7; ledger row `2026-11-16-concurrent-links-leave-prunable-firmware-link`).
   - **The graph-rule items** are put back on purpose (ADR 0041, Decision 6).
   - **What it leaves alone:** any other element already there (create-element refuses its name, `index.js:1837`), and a set already there (`alreadyExisted`).
3. **Who starts it.** Three things start today's install:
   - the Dashboard's "Install Tapestry firmware" button;
   - `POST /api/firmware/install`, owner only (`OWNER_ACTION`, `src/middleware/routeAccess.js:207`);
   - the install at first start, which `TAPESTRY_FIRMWARE_ON_BOOT` turns on (`docker/entrypoint.sh:356`, `tools/firmware-on-boot.sh`). The brains launcher sets it (`deploy/launcher/lib/render.js:23`).
4. **The graph writes keep their hands off firmware, because of fact 2.**
   - **Thirteen graph writes refuse** a firmware concept, node, membership or link (`firmware-concept`, `firmware-node`, `firmware-membership`, `firmware-link`, `firmware-prunes`). Each says that a reinstall would rebuild it, and names seed-firmware as how firmware changes (`src/operations/catalog/graph/_concepts.js:107`, `update-node.js:43`, `delete-node.js:55`, `_memberships.js:62`, `link-set.js:19`, `unlink-set.js:21`). `rules repair` refuses one too, unless it is given `firmwareOverride`.
   - **So today an admin edits a firmware node** with today's signing routes (the Dashboard's editors, `set-b-tag`, `b-append`, `b-defer`), with a raw query, or with `rules repair` and its override.
   - **And adds to the firmware** with the graph writes, which make elements, sets and links of the instance's own under firmware concepts.
5. **A version doesn't say which files were installed.** The manifest's version has been 1.0.0 since 2026-03-28. Meanwhile files under `versions/v1.0.0` changed in a dozen commits this month: graph-rule's items on 2026-11-15, rule 11 on 2026-11-20. `lifecycle status`'s firmware part answers "the version of the firmware the instance carries (its active manifest's)" (`src/operations/catalog/lifecycle/status.js`), not what was installed.
6. **What counts as installed today.** `readInstallState` counts a concept only when a `NostrEvent` node is at its address (`src/api/firmware/index.js:128-152`). `lifecycle status`'s firmware part and `GET /api/ready` both use it, so a concept that no letter backs counts as missing.
7. **Nodes with no letter.** The graph writes make each node as "the node the nostr import would make of the letter its write would sign, recorded without signing" (`src/operations/catalog/graph/_eventless.js`).
   - It has the letter's address, kind and would-be author (the assistant), its name, its tapestryValue and its tags.
   - It has no `id` and no `NostrEvent` label (D7).
   - So a letter published for it later lands on the same node.
8. **Code reads the instance's own firmware letters.** The community-reference pass reads the local header from the local relay, and the Tapestries UI reads Tapestry elements there (ADR 0043, Decision 1). So until the signing step exists, a node that seed-firmware writes or changes has no current letter. Those readers see the letter today's install signed, or none.
9. **No "came from" record exists.** Nothing records which file or letter a firmware node came from. The design doc's §5, question 2, proposes a "came from" record, "set once, at import: the kind of source, its address and its author". ADR 0043's install record moves with each update, so it isn't set once.
10. **`rules check` runs one rule.** `GET /api/tapestry/rules/check` (A10.31.a) runs each rule that declares a scan, today only `property-has-one-parent`. It refuses the others (`not-checkable`).
11. **Who may call lifecycle.** The catalog makes lifecycle "owner only", and Loom's detail says "for the owner only".
    - **What's built:** every lifecycle operation so far (backup, restore, migrate, status, and the routes that list, download and upload backups) is for the owner and admins. The owner widened backup at its planning gate: "Owner and Admins can do both" (story graph-operations-foundation #2).
    - **What Loom's done-criteria need:** an agent, who is an admin, to use it through the external CLI.
12. **The rules a scratch stack lacks.** Neo4j's uniqueness rules are a precondition of the graph operations, with no run-time check (story 32, the owner's answer at Review). A scratch stack has them only after the Dashboard's fix and `lifecycle migrate --migration tapestry-keys` (ledger row `2026-11-20-scratch-stack-lacks-uniqueness-rules`).

## User-facing description

As the owner, or an admin agent, I want to put the firmware my instance carries into its graph with one call, and later bring it up to newer firmware the same way, so that the built-in concepts are there and current, as nodes of my instance's own.

As the same owner, I want an update to leave alone what my admins and I changed in the firmware, and to tell me what it changed and what it kept, so that taking new firmware never undoes our work. The graph rules are the exception: they always follow the rulebook.

As the owner, I want my instance to say which firmware it has installed, and when, not only which firmware it carries.

## Acceptance criteria

- [ ] **AC1 — Install the firmware the instance carries, unsigned.** Given an instance whose graph holds no firmware, with Neo4j's uniqueness rules in place (fact 12), when the caller calls `POST /api/tapestry/lifecycle/seed-firmware`:
  - **The nodes.** The graph holds what today's install makes from the same files (fact 1). Each node is at the address today's install gives it, under the instance's assistant's pubkey (ADR 0043, Decision 1). It carries the labels, tags and JSON that today's install's node carries, apart from `NostrEvent` and `id` (fact 7).
  - **The relationships** between those nodes are today's install's, made in today's install's order.
  - **The six community-reference headers** each carry the firmware's `pointer` b.
  - **Nothing is signed.** Nothing is written to any relay, the instance's own included, and no guard runs (the bootstrap path).
  - **The graph operations then work on it.** `graph create-concept` makes a concept instead of answering `not-installed`.
- [ ] **AC2 — Where each node came from, and what was installed.**
  - **Each node's install record.** Each node that seed-firmware writes or brings in line records what it was last installed from: the firmware file, and the content it was installed with. A release's letter takes the same place later, by its address and event id (ADR 0043, Decision 1). It is one form, which copy-node (A10.24) shares (fact 9). A read of the node answers it (`cache get`, ADR 0043 Decision 7).
  - **The installed-firmware graph.** Seed-firmware writes one of the instance's own elements of `39998:<TA>:graph`. It lists the nodes seed-firmware wrote, names what they came from (the firmware's version and which files, fact 5), and is brought up to date by each install.
  - **Status.** `lifecycle status`'s firmware part answers, beside the version the instance carries: the firmware installed (read from that graph), when it was installed, and how many of its nodes have changed since. Before any seed-firmware run, it says that none is recorded.
- [ ] **AC3 — Safe to repeat.** Run again with the same source, it changes nothing in the graph, records no change entry, signs nothing, and answers every node `unchanged`. Two calls at once install once.
- [ ] **AC4 — An update keeps local edits** (ADR 0043, Decision 5). Given firmware that seed-firmware installed, when the firmware the instance carries has changed and seed-firmware runs, then for each node:
  - one the source has and the graph doesn't is made, and reported `added`;
  - one nobody has changed since it was installed is brought in line with the source and its record moved forward, reported `changed`; it is `unchanged` when the source didn't change it;
  - one changed since it was installed, by any route (fact 4), is left as it is, with its record not moved, and reported `kept`. The report names what differs from what was installed: its JSON, its name, its tags (a re-pointed `pointer` b is one), or the relationships firmware made to it;
  - one the source no longer has is left as it is, and reported `not-in-source`. Nothing is deleted;
  - what the instance added stays as it is: its own elements and sets under firmware concepts, and its links to and from firmware nodes, a direct link from a firmware superset that today's install prunes included (fact 2);
  - **a node today's install made** has no install record yet. When it matches the source, it gets its record and is `unchanged`. When it differs, it is `kept`, reported as having no record of what was installed (open question 2);
  - **the caller can take the firmware's version on purpose:** a call can name kept nodes, or ask for all of them, to bring in line anyway. Each is then reported `changed`, and its record moves forward (open question 3).
- [ ] **AC5 — The graph rules follow the rulebook** (ADR 0041, Decisions 6 and 7; ADR 0043, Decision 5). Graph-rule's items are the exception to AC4:
  - each install brings every one of the assistant's items in line with its file, an edit included, and reports it `put-back`;
  - an item already in line is `unchanged`;
  - another author's item with a rule's name is never changed. Firmware's own item isn't made then, and the report says so.
- [ ] **AC6 — What it reports and records.**
  - **The answer gives:**
    - what was installed from: the version, and which files;
    - each node's outcome (`added`, `changed`, `unchanged`, `kept`, `put-back` or `not-in-source`), with its tapestryKey and address, and for `kept`, what differs;
    - the count of each outcome;
    - what `rules check` found over the firmware's nodes afterwards (fact 10; ADR 0043, Decision 1). It reports what it finds and undoes nothing.
  - **The change entry.** It records who installed and the nodes the install made or changed, and `graph history` finds it by each of them. A run that changes nothing records none (AC3).
- [ ] **AC7 — What it refuses, and how it reaches agents.**
  - **It refuses,** changes nothing, and says in words what was wrong, naming the input or the file:
    - a `version` the instance doesn't carry (it names the one it carries);
    - firmware files it can't read, or that don't hold together: a file missing, a file that isn't JSON, or a concept named that the firmware doesn't define. Nothing is written until every file has been read and checked, as nothing is written until every letter of a release has been (ADR 0043, Decision 4). So the instance keeps the firmware it had;
    - while another lifecycle job runs, and when the graph can't be reached.
  - **Who it's for.** It is for the owner and admins (open question 1). A caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403.
  - **How it's reached.** It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry lifecycle seed-firmware` with the same inputs, with no sign-in, and gets the route's answers.
  - **What stays as it was.** Today's install, its route, the Dashboard's button and the install at first start work as they did.
  - **The docs.** The catalog's §8 row, BIBLE §7 and BIBLE §11 say what it does.
  - **The live check.** On a scratch stack, an admin agent with its own key, through the external CLI and with no change to it:
    - installs the firmware on an instance that has none, and finds its concepts;
    - runs it again, and is told nothing changed;
    - after a firmware node is edited and the firmware the instance carries changes, runs it again, and is told which nodes it kept and which it changed.

Seven criteria, for one operation. AC1 and AC2 define what an install writes. AC3 to AC5 say what it does with what it finds already there, so the story stays one reviewable change, as story 32 did with seven.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- Every firmware concept, `39998:<TA>:<slug>` for each of the manifest's 41 (written: their nodes, at today's addresses).
- `39998:<TA>:graph` — graph (written: the installed-firmware graph is one of its elements).
- `39998:<TA>:graph-rule` — graph rule (written: its items follow the rulebook, AC5).
- The six community-reference concepts (fact 1) (written: their headers' `pointer` b).
- No firmware concept's definition changes.

## Out of scope

- **Releases.** Fetching a release, checking it against a pin, the firmware key and instance, the first release and its test copy, and the release convention are new stories (ADR 0043, Decision 8). Until then, `version` names a firmware the instance carries.
- **The signing step, and replacing today's install.** Export nostr (A10.34) is to sign what seed-firmware wrote. Until it can, today's install, its route, the Dashboard's button and the install at first start stay the install, unchanged (ADR 0043, Decision 1). So on an instance where seed-firmware changed a node, the instance's relay holds the old letter until the signing step (fact 8).
- **Today's community-reference pass** stays as it is: it fetches the curator's header and superset from relays, and makes their edges.
- **The equivalence check** (ADR 0043, Decision 7): two scratch instances with one key, one installed by today's install and one by seed-firmware. This story's own tests compare with today's install as far as the suites can.
- **Reading the installed firmware from the graph** where code reads the firmware module or the instance's own letters today (facts 6 and 8). `readInstallState` and `GET /api/ready` keep counting `NostrEvent` headers, so by them an instance installed by seed-firmware alone isn't ready until that story.
- **BIBLE §7, §14 and §22 for a release install,** and closing OPEN.md row 8, which waits until seed-firmware is the install.
- **Taking `firmware/` out of the repo.**
- **The graph writes' firmware refusals (fact 4)** stay, since today's install still rebuilds firmware. Revisiting them, and retiring ledger row `2026-11-16-concurrent-links-leave-prunable-firmware-link`, wait until seed-firmware is the install.
- **Deleting a firmware node** that the firmware no longer has.
- **Copy-node (A10.24),** beyond sharing the record's form.
- **Any change to today's UI.**
- **Merging to staging and shipping to production,** which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the story as drafted, with all three (2026-11-20).

1. **Who may call it?** *Resolved: the owner and admins,* as every lifecycle operation built so far (fact 11).
   - **Why:** Loom's done-criteria need an admin agent to use it through the external CLI, and a firmware update is upkeep an agent can run.
   - **The cost:** an admin can then change every firmware node in one call, which only the owner can start today. Loom's detail says "for the owner only", so that line becomes a deviation.
   - **The other choice:** owner only, as today's install route and the catalog have it. The agent's use then goes through the owner's key or the internal CLI, which is a deviation from Loom's done-criteria instead.
2. **What does an update do with a firmware node that today's install made, which has no install record?** Every instance today was installed that way. *Resolved: when the node matches the source, it gets its record and is `unchanged`. When it differs, nothing tells an admin's edit apart from a file that changed since the last install (fact 5), so it is `kept`,* reported as having no record of what was installed. Nothing is undone.
   - **The cost:** a firmware change made since an instance's last reinstall doesn't reach a node that differs, until the owner takes it (question 3).
   - **The other choice:** bring the node in line, as today's reinstall does. That undoes any edit made since the last install, once.
3. **Can the owner take the firmware's version of a node that was kept?** *Resolved: yes.* The call can name kept nodes, or all of them, to bring in line anyway, and each is reported `changed` (AC4).
   - **Why:** without it, a kept node takes no firmware change until someone edits it back, by hand, to what was installed.
   - **The other choice:** leave it to a later story, and keep this one to what ADR 0043 says.

**Settled by ADR 0043 and the design, with the story:**

- Nothing is signed, and nothing is sent to any relay. No guard runs (the bootstrap path). Today's order is kept, and `rules check` reports over the result.
- The addresses are today's (ADR 0043, Decision 1). `version` left out is the firmware the instance carries.
- A header with no `b` gets the firmware's `pointer` b on its node, unsigned. A `b` already there, seeded or set by an admin, is kept: ADR 0030's never-clobber rule, and ADR 0043's Decision 5.
- Graph-rule's items follow the rulebook (ADR 0041).

**For Architecture, not this gate:**

- **The install record's form** (fact 9): it is shared with copy-node. For a file, it says which file and what was installed.
- **How an update tells an edited node,** and which parts count: JSON, name, tags, labels, and the relationships firmware makes.
- **The installed-firmware graph's form:** what it lists (nodes, and the relationships firmware makes), how it names a file source, and when it was installed.
- **Matching today's install's nodes without signing** (fact 7; `_eventless.js`). That covers pass 2's and pass 3's schema content too: pass 3b copies the enumerations' values into schemas, which ADR 0019's rule 10 replaced.
- **Size and safety:** one transaction or many for 459 nodes with their tags and relationships; a job of its own, as migrate is; and whether it takes a backup first, as migrate does when data will change.
- **Locks:** two calls at once, and a graph write beside it.
- **The `pointer` b's reference** when the curator's header isn't in the graph. Today's pass fetches that header from relays, and the CI gate reads none.
- **Status:** where it reads the installed firmware, and its words for an instance that today's install installed.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
