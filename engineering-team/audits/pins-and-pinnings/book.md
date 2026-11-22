# Book of Work: Pins & Pinnings in Tapestry

**Slug:** pins-and-pinnings
**Status:** Open
**Opened:** 2026-11-22
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** Loom task G5.6, drafted from proposal P-163, which the owner accepted on 2026-11-22 as its builder. The bullets are G5.6's done-when as the roadmap states it. They were put to the owner on 2026-11-22 as this book's acceptance frame, together with the ADR's design, and the owner approved both ("Yes, write the ADR"), so they are the definition of done. The epic's spec is [docs/loom/G5.6.md](../../../docs/loom/G5.6.md).

### Acceptance frame

- [ ] **The Pins, local-first.** The pin concept and its first Pins are in the graph, made local-first.
- [ ] **Pinning.** A person can pin and unpin a DList or a Tag, publicly or privately.
- [ ] **Tag-pinning moved.** Tag-pinning's pins have moved onto the new Pins (Pins draft § 10), and their Trusted Lists still spawn.
- [ ] **Agents.** An agent has pinned through the external CLI.

Outside the frame: the alert Pin and its alerts (Loom G6.4), and the alert Pin's entry in the draft (G6.5); the update of the Pins draft to what this book builds, which is Loom G5.7; `spawns-score`, `spawns-concept` and the display Pins; pinning contexts; and counting one person's pinnings for other people.

## Epics in this book
- [pins-and-pinnings](../../epics/pins-and-pinnings.md) (named 2026-11-22, with its first ADR; Loom G5.6) — the `pin` and `nostr-pinning` concepts and their first Pins, pinnings in the graph, private pinnings, the Dictionary page's Add and Veto, and tag-pinning moved onto `spawns-trusted-list`.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/pins-and-pinnings/audit.md`
- Product feedback: `engineering-team/audits/pins-and-pinnings/prd-seed.md`
