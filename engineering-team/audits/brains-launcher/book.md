# Book of Work: A team member launches their own brain in under three minutes

**Slug:** brains-launcher
**Status:** Open
**Opened:** 2026-11-04

## Intent anchor

**Acceptance frame (no PRD).** An internal launcher at `tapestry.ninja` gives an allowlisted team member their own
Tapestry instance at `<slug>.tapestry.ninja`, owned by their nostr pubkey and starting blank. The design spec came out
of the owner's call with David on 2026-11-04, and the owner agreed the changes to it the same day. It runs on the
stops the spec names (the human handovers) rather than a stop per phase, at the owner's word.

### Acceptance frame

- [ ] The owner launches `avi` from the page and it is `running` in under three minutes.
- [ ] The owner signs in with a NIP-07 extension and is the owner; the lists page shows headers and no items; router
      presets are all off.
- [ ] The owner adds their agent's npub on the admins page, and the agent can sign in as admin.
- [ ] David and Vinney launch theirs, and one roll takes all three forward.
- [ ] One brain is destroyed and restored within the grace week with its data intact.
- [ ] `docker stats` totals with three brains idle sit under the budget the cap was set from.
- [ ] `deploy/launcher/test/isolation.sh` is green.

## Epics

- `brains-launcher` (`engineering-team/epics/brains-launcher.md`)
