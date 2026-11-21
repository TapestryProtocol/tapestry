# Book of Work: Deploys keep the tapestry image's Ubuntu packages current

**Slug:** container-apt-refresh
**Status:** Closed
**Opened:** 2026-11-21
**Closed:** 2026-11-21
**Strictness:** Standard. All five phases: a Bug, with Architecture, because how a build refreshes the packages is a
choice weighed against deploy time.

## Intent anchor

**Acceptance frame (no PRD).** This is the ask as restated and confirmed by David on 2026-11-21, with his three answers
at intake:
- the deploy that refreshes may take a few minutes longer, not a full rebuild;
- packages refresh at deploys only;
- the brains' image is included.

### Acceptance frame

- [x] **Weekly:** after every server deploy and every brain image build, the container's Ubuntu packages are no more
      than a week behind Ubuntu's archive.
      *(At close: this holds for staging and the brains, and for production from its next promotion. Tags and
      magic-carpet get it once their branches take `staging`; see the audit, §4 #1.)*
- [x] **Nothing else moves:** Neo4j, its plugins, strfry and Node's major version stay as pinned.
- [x] **Predictable and cheap:** only the deploy that refreshes is slower, by a few minutes. An operator can tell
      beforehand which deploy that is.
- [x] **Written down:** OPERATIONS.md, `docs/SAFE_TO_MERGE.md` and the cycle skills say how the refresh works and what
      it costs. There is a by-hand refresh for a target that hasn't deployed, and a note for tags and magic-carpet now.
- [x] **Done:** a PR to `staging`, from a branch cut from `origin/staging`, with CI's `stack-free` green. Merging it,
      and running the note on any server, wait for David's yes.
      *(At close: TapestryProtocol/tapestry#188. `stack-free` passed, and David merged it on 2026-11-21. The note
      hasn't been run.)*

## Epics in this book
- `container-apt-refresh`: the weekly package refresh in every build path. *(Done.)*

## Provenance
- **Mode:** Acceptance-frame
- **Confidence:** high

## Close artifacts *(filled by `/close-book`)*
- Build audit: [`audit.md`](./audit.md), the as-built record, with the retro in §7.
- Product feedback: [`prd-seed.md`](./prd-seed.md), the product-facing baseline.
