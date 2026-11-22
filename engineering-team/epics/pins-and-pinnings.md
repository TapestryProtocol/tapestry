# Epic: pins-and-pinnings

**Created:** 2026-11-22
**Status:** Active

## Goal

Build the Pins & Pinnings draft ([protocols/drafts/pins.md](../../protocols/drafts/pins.md), Draft 3, a pre-NIP) in Tapestry: named Pins, one for each reason, and pinnings that put a DList header or a Tag on a Pin, publicly or privately, made in the graph first. The epic is Loom task G5.6, drafted from proposal P-163. Its spec is [docs/loom/G5.6.md](../../docs/loom/G5.6.md), and its design is [ADR pins-and-pinnings/0001](../decisions/pins-and-pinnings/0001-pins-and-pinnings-in-the-graph.md).

This epic realizes every bullet of book [engineering-team/audits/pins-and-pinnings/book.md](../audits/pins-and-pinnings/book.md).

## Why it matters

Today a pin means one thing: publish this Tag's Trusted Lists. The owner wants several reasons to pin, each with its own effect, and some with none: a Pin for the DLists his Dictionary page shows, a Pin for the Tags whose Trusted Lists he tracks, and a Pin for the DLists whose new items should reach him. A Pin per purpose also lets a pinner say which reading of their pin they endorse, which is Show and Tell's reuse hazard ([design-philosophies/show-and-tell.md](../../design-philosophies/show-and-tell.md), E12). And an agent working for the owner can pin only once pinning is a graph operation.

## Stories

Each story is planned when its Loom task is taken, and is numbered by its letter: G5.6.a is story 1, G5.6.b is story 2, and so on. The breakdown goes in a `## Stories` section of [docs/loom/G5.6.md](../../docs/loom/G5.6.md) once ADR 0001 is accepted.
