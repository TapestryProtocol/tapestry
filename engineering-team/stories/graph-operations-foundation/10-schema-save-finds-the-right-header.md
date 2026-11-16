# Story 10: Saving a concept's schema never lands on another author's header

**Status:** Approved
**Created:** 2026-11-15
**Type:** Bug

## Background

**What was seen.** The owner's local instance was upgraded to staging's `09dc9b7b` on 2026-11-15. A firmware install there at about 20:35 UTC logged:

> ⚠️ Concept "tag" has no JSON Schema node. Create one first via normalize skeleton.

and then `Pass 2 complete: 39 enriched, 0 skipped, 1 errors`. Staging's install of the same day logged no errors in Pass 2. The local instance holds two headers named "tag":

- **its own**, `39998:<TA>:tag`, a ConceptHeader with its schema `39999:<TA>:tag-schema`;
- **the community's**, `39998:82b75e47…:tag`, under the literal pubkey of ADR 0015. It was imported on 2026-06-13, and it is a ListHeader with no schema.

The install's schema save picked the community's header, found no schema on it, and gave up. The instance's own tag schema was not saved.

**Why.** `POST /api/normalize/save-schema` takes a concept's name and finds the header by that name among the headers of every author, keeping the first the database returns. When two headers share a name, which one it gets is up to the database. Three kinds of caller use it:

- **the firmware install's Pass 2**, which saves each firmware concept's schema;
- **apply-enumerations**, which saves each schema it adds enumerated values to, in Pass 3 or on its own route;
- **the owner**, through the Schema tab of a concept's page, and through the routes that make one of the instance's own concepts on first use: goals, resources, work records, proposals, priority signals, restore drills, adoption dispositions and trusted-dictionary snapshots.

Six firmware concepts share their names with a community header that the install itself brings in: tag, nostr user tag, tag pinning, nostr event tagging and tagging with specific tag (each under `82b75e47…`), and nostr relay (under `919ba08a…`). The install brings those headers in after Pass 2. So a first install on a fresh instance is clean, and every install after it can pick the wrong header.

**Seen on scratch stacks** (story 8's review, round 2): every install after the first failed Pass 2 for some of the tag concepts. It failed for 5 on a stack seeded to staging's shape and for 3 on a fresh one, with the same code. Those failures account for five of the six schemas whose json tags came out different after a second install (ledger row `2026-11-15-save-schema-finds-header-by-name`).

**Still unexplained.** The same second install also changed nostr relay's schema, and it moved `tagging-with-specific-tag-superset` and `tapestry-superset` between the elements of `set-superset` and `superset-superset`. Pass 2 didn't fail for nostr relay, so story 8's review left these with another cause, not yet found (story 8's test plan, Amendment 1).

**Worse than a failed save.** When the other author's header does have a schema, the save doesn't fail: it writes onto that schema instead, signed by this instance's Tapestry Assistant. The instance's own schema is left as it was, and nothing is logged.

**Who is affected:**
- the owner and admin agents who install firmware: every instance from its second install on;
- the owner editing a schema on a concept's page, when another author's header shares that concept's name;
- every instance that holds another author's header with the same name as one of its own concepts.

## User-facing description

As the owner, or an admin agent, I want a schema save to reach the concept I mean, so that installing firmware a second time, or editing a schema on a concept's page, never fails or writes onto someone else's concept because another author's header has the same name.

## Acceptance criteria

- [ ] **AC1. The install saves each firmware concept's schema on the instance's own header.**
  - Given an instance where another author's header shares a firmware concept's name, with no schema of its own (as the community's "tag" header has none), when the firmware install runs, then Pass 2 saves that concept's schema on `39998:<TA>:<slug>` and logs no error for it.
  - The same holds when the other author's header does have a schema of its own. That header and its schema are left exactly as they were.
- [ ] **AC2. Apply-enumerations saves to the schema it enumerated.**
  - Given the same instance, when apply-enumerations runs, in Pass 3 or from `POST /api/normalize/apply-enumerations`, then each schema it adds values to is saved on the concept that schema belongs to.
  - No other author's header or schema changes.
- [ ] **AC3. A save by name is never the database's choice.** Given a caller who names the concept only by its name, as every caller does today:
  - when exactly one header has that name, the save does what it does today, and answers the same way;
  - when several do and exactly one of them is the instance's own, written by its Tapestry Assistant, the save goes to that one;
  - when several do and none or more than one is the instance's own, the save changes nothing, and its error says the name is shared and names the headers that share it;
  - on the same graph, the same request always gets the same answer;
  - the primary-property record the save brings up to date in the same call belongs to the same concept as the schema it saved.
- [ ] **AC4. The concept page saves the schema it shows.**
  - Given the instance's own "tag" concept and another author's header named "tag", when the owner saves a schema on the Schema tab of the instance's own concept page, in the visual editor or in raw mode, then the schema saved is the one the page showed, and the page shows the saved schema after.
  - A caller can name the concept it means by its header's tapestryKey, which every node has, and the save then reaches that concept and no other. A key no node holds, or one that more than one node holds, changes nothing.
  - A concept that came from no event, as one `graph create-concept` makes (A10.16), is refused and nothing changes, whether it is named by its key or by its name. The save signs and publishes the schema, and a concept with no event is the instance's own private thought (BIBLE §30). *(Amended at the Test Design gate, 2026-11-15.)*
- [ ] **AC5. A second install saves what the first one did.**
  - Given a scratch stack after one firmware install, when a second install runs, then its Pass 2 logs 0 errors.
  - The schemas of the five tag concepts, on the instance's own headers, come out as the first install left them.
  - Every other difference between the graphs the two installs leave (nostr relay's schema and the two supersets above, as a start) is listed in the test plan with its cause. One that follows from this bug is gone. One with another cause gets a ledger row of its own.

## Concepts touched

- `39998:<TA>:tag`, `39998:<TA>:nostr-user-tag`, `39998:<TA>:tag-pinning`, `39998:<TA>:nostr-event-tag`, `39998:<TA>:tagging-with-specific-tag`, `39998:<TA>:nostr-relay`: the instance's own firmware concepts whose names other headers share. Their schemas are what the install has to save.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:<slug>` for the five tag concepts, and `39998:919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff:nostr-relay`: the community's headers, from the firmware manifest's `communityReference` entries. A schema save must never change them.

`<TA>` is each instance's own Tapestry Assistant, found at runtime. No concept definition changes, so the fix needs no firmware reinstall of its own. The handles were read from the firmware manifest, not from the concept graph: the stack on this Mac is the owner's agent-memory instance, so it wasn't queried.

## Out of scope

- **The other routes that find a header by name.** These include the skeleton route and the Health Audit (ledger row 230), the standalone `POST /api/normalize/reconcile-primary-property`, create-element, create-property, generate-property-tree (the Schema tab's other button), and wire-implicit-elements and prune-superset-edges when they are given one concept. They need the same treatment. This story fixes the schema save and the record it updates in the same call, and the rule it sets is theirs to follow.
- **Whether a schema save should write onto another author's concept at all,** when the owner asks for it on that concept's own page. The save signs as this instance's Tapestry Assistant, so the result is no longer the other author's event. This story only stops it from happening by accident.
- **`graph set-schema`**, the operation Loom tracks as A10.18. It is how a concept with no event will get its schema saved, without signing (AC4).
- **Running an install on staging, production or the owner's local instance.** That is the owner's call. This story's checks run on scratch stacks.

## Open questions

None. Both were settled by the owner at the planning gate, 2026-11-15:

- **AC3's rule stands as drafted.** When several headers share a name and the caller gives only the name, the save goes to the instance's own header, and refuses when there isn't exactly one. Refusing whenever a name is shared was the alternative. This rule keeps the routes that make the instance's own concepts, and any other caller that sends only a name, working as they do today.
- **No ADR.** Under Standard a bug skips Architecture when the fix is obvious, as story 8 did. How a caller names the header it means is a change to a documented route; the Implementer records it under Deviations, and the Reviewer checks it there.

One more was settled at the Test Design gate, 2026-11-15:

- **A caller names the header by its tapestryKey.** The test plan first proposed the header's address. The owner chose the tapestryKey: every node has one (ADR graph-operations-foundation/0003), while not every concept is guaranteed an address. The graph operations name a concept the same way (`graph mark-field`'s `concept`). Naming a concept by key can reach one with no event, which the name lookup never could, so AC4 now says what happens then.

## Deviations

- **The request names the header by `tapestryKey`**, the owner's choice at the Test Design gate. The field is optional and documented in `src/api/openapi.yaml`. A value that isn't a tapestryKey answers 400. A key no concept header holds, or one that more than one node holds, answers `success: false`, as a name no header has does today.
- **"The instance's own" header is the one written by the key the route signs with,** the Tapestry Assistant's, found at runtime (`nt().getPublicKey(getPrivkey())`), as create-concept's own check finds it.
- **The key lookup reads the concept headers by label** (`ListHeader|ClassThreadHeader|ConceptHeader`), not by `:TapestryNode`, which a node lacks until `tapestry-keys` has run on its instance. Headers are few, so the label scan costs little.
- **A concept with no event is refused when either its header or its schema node lacks `NostrEvent`.** The name lookup never sees such a header, since it reads only `:NostrEvent` headers, so by name such a concept still answers "not found", as today.
- **The primary-property fold reconciles the header the save found,** by its address. `reconcilePrimaryPropertyForConcept` takes that as an option. The standalone `POST /api/normalize/reconcile-primary-property` still finds its concept by name (Out of scope).
- **Pass 2 finds the header by its address,** `39998:<TA>:<slug>` with the TA resolved at runtime, and its schema node with it, as `readInstallState` does. It names the header to save-schema by its tapestryKey. A header with no key yet is sent by name, and the name rule finds the instance's own.
- **Apply-enumerations names its target header by its tapestryKey,** read from the ENUMERATES edge it already walks.
- **The concept page reads its header's tapestryKey** in its header query (`ConceptDetail.jsx`), and the Schema tab sends it with both saves. The client sends no key when it has none or is given the `{}` placeholder, so the save falls back to the name.
- **The routes that make the instance's own concepts on first use still save by name.** Each has just made the concept with the Tapestry Assistant's key, so the name rule finds it.
- **A header with more than one schema node** has its first by address saved, a fixed choice. Today's code took whichever the database gave first.

## Linked artifacts

- ADR: none. The owner chose the Standard bug path, with Architecture skipped, on 2026-11-15.
- Found by: story 5's firmware install on the owner's local instance, 2026-11-15, and story 8's review, round 2 (`engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.test-plan.md`, Amendments 1 and 2).
- Ledger: `ledger/2026-11-15-save-schema-finds-header-by-name.md`
- Test plan: `engineering-team/stories/graph-operations-foundation/10-schema-save-finds-the-right-header.test-plan.md`
- Review: (filled in after Review)
