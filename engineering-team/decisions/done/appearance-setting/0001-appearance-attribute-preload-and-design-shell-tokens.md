# ADR 0001: An appearance attribute on `<html>`, set before the bundle loads; the design shell's colours become tokens

**Status:** Accepted
**Date:** 2026-10-31
**Story:** `engineering-team/stories/appearance-setting/1-appearance-switch-and-design-shell-dark.md`

## Context

The story asks for a per-browser choice of **System**, **Light** or **Dark** (default System), offered in the avatar
menu, on `/settings` and, signed out, beside **Sign in**. The choice must apply at once, survive reloads, never flash
the other look on load, and give the design-shell pages a dark look while every other page stays exactly as it is.

What the code has today (`staging` at `6d3bb659`):

- **No appearance mechanism at all.** No `prefers-color-scheme`, no theme class or attribute, nothing stored
  (`grep` over `ui/src`).
- **The shell.** `ui/index.html` is a bare template: `<div id="root">` and the module script. Every SPA route is
  served that file (`bin/control-panel.js:392-396`). There is no Content-Security-Policy anywhere (no `helmet`, no
  header in `docker/` or `setup/`), so an inline script in `<head>` runs.
- **Providers.** `ui/src/main.jsx` nests `ConfigProvider > AuthProvider > PovProvider > TrustProvider > App`.
- **The pre-render background is the admin dark.** Until React mounts, `body` paints `var(--bg)` from `:root`
  (`styles.css:6-30`, `#0d1117`). The design-shell pages repaint it light through
  `body:has(.bsd-page) { background: #f2f3f0; }` (`styles.css:9595`) only once they render. So **a design-shell page
  already flashes dark on every load today**, and the story's no-flash criterion can't be met by the attribute
  alone: something must paint the right background before React runs.
- **The design shell's palette** (`styles.css:9596-10562`, `.bsd-page` and the rules under it) declares 19 custom
  properties (`--bg`, `--text`, `--accent`, `--bsd-*` …, `styles.css:9598-9618`), but the section also holds
  **202 literal colours** (59 × `#ffffff`, 20 × `#fafaf9`, 11 × `#9aa1ac`, the amber/red/green status sets, a dozen
  `rgba(114, 55, 255, α)` accent tints, …). The `.dict-*` rules the Dictionary shares (`styles.css:9211-9595`) read
  variables 112 times and hold about 20 literals. Inline colours on the four pages: 30 in `ui/src/pages/dictionary`,
  all GitHub-style language swatches (data colours that read on either background), none in `treasure-map/` or
  `assistants/`.
- **The four design-shell pages** all render through `ui/src/components/BrainstormDesignShell.jsx`:
  `pages/dictionary/DictionaryShell.jsx` (`/dictionary`, `/dictionary/new`, `/dictionary/:coord…`),
  `pages/treasure-map/Index.jsx` (`MANAGE_TREASURE_MAP_PATH` = `/treasure-map`), `pages/treasure-map/Advanced.jsx`
  (`/treasure-map/advanced`) and `pages/assistants/Index.jsx` (`MY_ASSISTANTS_PATH` = `/assistants`); the constants
  live in `ui/src/config/avatarMenuLinks.js:54-61`.
- **The avatar menu.** `ui/src/components/BrainstormUserMenu.jsx` is rendered by the design shell, `TopBar.jsx` and
  about 17 Brainstorm pages directly. Signed out it returns only
  `<button className="bs-link-btn">Sign in with nostr</button>` (`:87-89`); signed in, a dropdown of sections
  ending in a footer with **Your pins** and **Settings**.
- **The Settings page** `ui/src/pages/BrainstormSettings.jsx` (`/settings`) renders its own top bar with
  `BrainstormUserMenu`, and signed out shows only "Sign in with nostr to personalize your search experience."
  (`:393-408`).
- **Precedent for per-browser preferences:** `localStorage` behind `try/catch`, e.g. `ui/src/hooks/useCurationCutoff.js:7,25`.
- **Precedent for node-testable UI logic:** pure CommonJS under `src/lib/`, imported by the UI through a Vite alias
  (`ui/vite.config.js`, seven `@tapestry/*` aliases plus `build.commonjsOptions.include`), because the node test
  runner can't execute `ui/src`.
- **Brainstorm-UI** (`client/src/lib/theme.tsx` at `60a28e83`): `localStorage.brainstorm_theme` holding
  `system|light|dark`, `matchMedia('(prefers-color-scheme: dark)')` tracked live under System, and a `dark` class on
  `<html>`. It has no pre-render script.

No concepts are touched, so there is no Concept Graph orientation to do and no firmware change. (The local graph at
:7778 is Grawk's agent-memory instance anyway.) No existing ADR covers appearance; nothing is superseded.

## Options considered

### Option A — A resolved `data-appearance` attribute on `<html>`, set by an inline pre-render script and kept by a React provider; the design shell's colours become tokens with a light and a dark value

- An inline script in `ui/index.html`'s `<head>` reads the stored choice, resolves it against the OS, and sets
  `<html data-appearance="light|dark">` before the bundle loads. On a design-shell path it also sets a one-shot
  pre-render hint so `body` paints the design shell's background, in the resolved look, before React mounts.
- An `AppearanceProvider` owns the choice from then on: state, storage, the OS listener, and the attribute.
- Every colour in the design-shell section becomes a custom property with today's value under `.bsd-page`
  and a dark value under `:root[data-appearance="dark"] .bsd-page`.

Pros: no flash on any design-shell page. One attribute every later family can read (stories 2 and 3 add their
token sets, nothing else). Light is today's values moved into variables, so Light can't drift. The resolution logic is
pure and testable in node.
Cons: the inline script is a hand copy of the resolution logic (it can't import), so a test must pin the two
together. The pre-render hint needs the list of design-shell paths until every family follows the setting (story 3).

### Option B — CSS `@media (prefers-color-scheme: dark)` for System, plus an attribute only for an explicit choice

System would need no JavaScript at all. But every dark token would be written twice: once inside the media query,
guarded by `:not([data-appearance="light"])`, and once under `[data-appearance="dark"]`. That's the duplication that
drifts, and an explicit choice still needs the same script, storage and provider. Rejected.

### Option C — Copy Brainstorm-UI literally: a `dark` class on `<html>` and the key `brainstorm_theme`

This is the closest to Brainstorm-UI. But the two apps are on different origins and never share storage, so the
same key buys nothing. A bare `dark` class is a generic name that any future rule or library may also use. The
values (`system|light|dark`) and the behaviour stay identical to Brainstorm-UI's under Option A; only the names
differ. Rejected in favour of A's names.

### Sub-option for the palette — dark overrides per rule instead of tokens

Write `:root[data-appearance="dark"] .bsd-page .bsd-x { color: … }` for every rule that holds a literal. That's about
200 duplicated selectors that must be kept in step with their light twins forever. Rejected in favour of tokens.

## Decision

We chose **Option A**: one resolved `data-appearance` attribute is the contract every page family reads. It's set
before the bundle by a small inline script and kept by a provider, with the design shell's colours moved into tokens
that carry a light and a dark value. It's the only option that meets the no-flash criterion. It also leaves stories 2
and 3 as palette-only work.

Sub-decisions:

1. **Names and values.** Storage key `tapestry_appearance`. Choices `system`, `light`, `dark`, default `system`. Any
   other stored value (or none, or storage that throws) reads as `system`. Resolved values on `<html>`:
   `data-appearance="light"` or `"dark"`, always present after the inline script runs.
2. **Nothing leaves the browser.** No `/api/user-prefs` write, no event, no account field. (The POV selection
   persists server-side; appearance deliberately doesn't. It's per browser, as the story says.)
3. **System tracks the OS live** through a `matchMedia('(prefers-color-scheme: dark)')` change listener, attached
   only while the choice is `system`.
4. **The pre-render hint is interim.** On a design-shell path (`/dictionary`, `/dictionary/…`, `/treasure-map`,
   `/treasure-map/…`, `/assistants`, `/assistants/…`) the script sets `data-preload-family="design"` on `<html>`, and
   CSS paints `body` with the design shell's page background in the resolved look while that attribute is present.
   The provider removes the attribute after its first render; from then on `body:has(.bsd-page)` takes over as it
   does today. This keeps a later SPA navigation to a dark page from inheriting a stale hint. Story 3 replaces the
   path list with one rule, since by then every Brainstorm family follows the setting.
5. **Light is today, byte for byte.** Each literal in the design-shell section maps to a token whose light value is
   exactly that literal. Converting is a refactor in Light and changes nothing a person sees there.
6. **Dark values** start from the table under Implementation notes and must satisfy the story's contrast criterion.
   Body text, muted text and link/accent tokens reach at least 4.5:1 on the surfaces they sit on. The table is
   a starting point; the contrast tests decide.
7. **Native controls follow.** `color-scheme: dark` on `.bsd-page` in Dark, so scrollbars, `<select>` lists and
   date pickers render dark too. Nothing outside `.bsd-page` gets `color-scheme`, so other families are unchanged.
8. **One control, three placements.** An `AppearanceControl` radio group labelled **Appearance**, with three options
   **System**, **Light** and **Dark** and the current one checked:
   - in the signed-in avatar dropdown, as its own section just above the footer, where Brainstorm-UI's account
     menu puts it;
   - signed out, a compact variant (three icon buttons with those accessible names) rendered by
     `BrainstormUserMenu` beside **Sign in with nostr**, so it appears wherever that button does;
   - on `/settings`, as a card in both the signed-in page and the signed-out one, above the sign-in prompt.
9. **Other families are untouched.** No rule outside the design-shell section reads `data-appearance` in this story,
   apart from the pre-render hint (sub-decision 4), which applies only on design-shell paths. `:root`'s admin
   variables don't change.

## Consequences

- **Enables** stories 2 and 3 as palette-only work: each family adds a light/dark token set keyed on
  `data-appearance`, and story 3 retires the path list in the inline script.
- **Constrains:** any new colour in the design-shell section must be a token, never a literal, or it won't follow
  Dark. The Reviewer should reject a new literal there.
- **Interim oddity, accepted in the story:** the control appears on the dark profile/feed/Settings pages, where a
  choice changes nothing visible until story 2 (and the search home until story 3).
- **Debt:** the inline script duplicates `resolveAppearance` and the path list. A test pins it (Implementation notes).
- **Firmware reinstall required?** No.

## Implementation notes

**Pure logic.** File: `src/lib/appearance.js` (CommonJS, no dependencies), aliased as `@tapestry/appearance` in
`ui/vite.config.js` (alias plus a `build.commonjsOptions.include` entry, as the existing seven). It exports:
- `STORAGE_KEY = 'tapestry_appearance'`, `CHOICES = ['system', 'light', 'dark']`, `DEFAULT_CHOICE = 'system'`;
- `normalizeChoice(value)` returns a member of `CHOICES`, else `DEFAULT_CHOICE`;
- `resolveAppearance(choice, systemPrefersDark)` returns `'light'` or `'dark'`;
- `readStoredChoice(storage)` and `writeStoredChoice(storage, choice)`, which never throw (a throwing or missing
  `storage` reads as the default, and a failed write returns `false`);
- `DESIGN_SHELL_PATH_PREFIXES = ['/dictionary', '/treasure-map', '/assistants']` and `isDesignShellPath(pathname)`,
  which matches the prefix exactly or followed by `/`.

**Pre-render script.** File: `ui/index.html`. A classic inline `<script>` in `<head>`, before the stylesheet and
module script, wrapped entirely in `try/catch`. It reads `localStorage[tapestry_appearance]`, normalizes it,
resolves it against `matchMedia`, and sets `data-appearance`. On a design-shell path it also sets
`data-preload-family="design"`. On any exception it still sets `data-appearance` from `matchMedia` alone, or
`light` if that throws too. It's a hand copy of the lib's behaviour, so keep it short and dependency-free.

**Provider.** File: `ui/src/context/AppearanceContext.jsx`. `AppearanceProvider` plus a `useAppearance()` hook
returning `{ choice, resolved, setChoice }`. Mount it outermost in `ui/src/main.jsx` (outside `ConfigProvider`):
it needs nothing from the others, and the signed-out top bar uses it.
- Initial `choice` comes from `readStoredChoice(window.localStorage)`, guarded because the property access itself
  can throw.
- `setChoice` updates state, calls `writeStoredChoice`, and sets the attribute synchronously, so the page changes
  with no reload. If the write fails, the choice still holds for this page.
- An effect manages the `matchMedia` listener while `choice === 'system'`.
- A mount effect removes `data-preload-family`.

**Control.** File: `ui/src/components/AppearanceControl.jsx`. It renders `role="radiogroup"` with
`aria-label="Appearance"` and three `role="radio"` buttons with `aria-checked`. It takes a `variant` prop:
`'menu'` (labelled segments for the dropdown), `'compact'` (icon-only, with `aria-label`s System, Light and Dark, for
signed-out) or `'card'` (for `/settings`, with a short line saying it's saved in this browser only). Its styles live
in `ui/src/styles.css` beside the `bs-usermenu` rules and use `currentColor` and translucent tints, so the same
control reads on the dark families and on the design shell in both looks. Design-shell tweaks go in the design-shell
section, as tokens.

**Placements.**
- `ui/src/components/BrainstormUserMenu.jsx`: signed out, return a wrapper holding `AppearanceControl variant="compact"`
  and the existing Sign in button. Signed in, add a `bs-usermenu-section` with a small "Appearance" label and
  `variant="menu"`, just before `bs-usermenu-footer`.
- `ui/src/pages/BrainstormSettings.jsx`: an Appearance card (`variant="card"`) in the signed-out branch above
  `.bss-empty`, and in the signed-in page as its own card. The page's own dark look is unchanged.

**Palette.** File: `ui/src/styles.css`, design-shell section (`body:has(.bsd-page)` at `:9595` to the end) and the
`.dict-*` rules at `:9211-9595`.
1. Replace every literal colour with a token. Reuse the existing 19 where the value matches (e.g. `#ffffff` →
   `var(--bg)` or `var(--bg-secondary)` by role). Otherwise add `--bsd-*` tokens named by role, not by value:
   `--bsd-surface`, `--bsd-surface-muted`, `--bsd-nav-glass`, `--bsd-accent-tint-05/08/10/12`, `--bsd-warn-bg/-ink/-line`,
   `--bsd-danger-*`, `--bsd-success-*`, `--bsd-shadow-*`, and so on.
2. Declare light values under `.bsd-page`, each equal to the literal it replaced.
3. Declare the dark set under `:root[data-appearance="dark"] .bsd-page`, with `color-scheme: dark`.
4. Give `body:has(.bsd-page)` and the pre-render hint (`:root[data-preload-family="design"] body`) the token-equivalent
   page background for each look. `body` is outside `.bsd-page`, so these two rules carry both values themselves.
5. The page gradient `linear-gradient(180deg, #f2f3f0 0%, #ffffff 100%)` becomes two tokens.

Dark starting values (role, then light value, then dark value):

| Token | Light (today) | Dark |
|---|---|---|
| `--bg-primary` / page top | `#f2f3f0` | `#0e1016` |
| page bottom | `#ffffff` | `#12151c` |
| `--bg`, `--bg-secondary` (surfaces, cards) | `#ffffff` | `#171a22` |
| `--bg-tertiary` | `#fafaf9` | `#1d212a` |
| `--border` | `#d6d9db` | `#2e3440` |
| `--bsd-line` | `#e8eae7` | `#262b35` |
| `--bsd-hairline` | `#f0f1ee` | `#1f232c` |
| `--text` | `#0a0e18` | `#eef0f4` |
| `--text-primary` | `#2a303b` | `#d5d9e0` |
| `--bsd-ink-2` | `#555d69` | `#b3b9c4` |
| `--text-muted` | `#6b7480` | `#9aa2ae` |
| `--bsd-faint` | `#8c929e` | `#7d8590` |
| `--accent`, `--purple` | `#7237ff` | `#a78bfa` |
| `--accent-hover` | `#612fd9` | `#c4b5fd` |
| `--bsd-navy` | `#2b174f` | `#c4b5fd` (as text) |
| `--red` / `--green` / `--orange` | `#b42318` / `#047857` / `#b45309` | `#f87171` / `#34d399` / `#fbbf24` |
| nav glass | `rgba(242, 243, 240, 0.78)` | `rgba(14, 16, 22, 0.78)` |

Status backgrounds (the amber `#fffbeb` and `#fef3c7`, the red `#fef2f2`) become translucent tints of the dark status
colour: about 0.12 α for backgrounds and 0.35 α for borders. White text on a solid accent or amber button stays
white.

**What the tests must pin (for the Tester).**
- The lib's functions over every choice, OS and storage combination, including storage that throws on access.
- The inline script and the lib agree. Execute `ui/index.html`'s inline script in a `vm` context with stub
  `localStorage`, `matchMedia` and `location` for each combination, and compare against `resolveAppearance` and
  `isDesignShellPath`.
- Light unchanged: no literal colour left in the design-shell section outside token declarations, and each light
  token equal to the literal it replaced.
- Contrast (WCAG AA) for the text and link tokens on their surfaces, in both looks.
- The browser behaviours the story lists: the control's placements signed in and out, an instant change, persistence
  across a reload, no flash (the first paint's background under a stored Dark on a light OS, and the reverse), the
  live OS change under System, and other families unchanged. These are B-class Playwright tests run against the
  scratch build.

## Out of scope

- Palettes for the profile/feed/Tags/About family, the Settings page's own look (story 2) and the search home
  (story 3). The admin `/tapestry/*` pages (book decision 2).
- Live sync of a choice between already-open tabs (a `storage` listener). New tabs and reloads pick it up, which
  is all the story asks.
- Sharing the choice with Brainstorm-UI or across devices.
- Recolouring the Dictionary's language swatches, which are data colours.

## Amendment 1 (2026-10-31, after review 1)

Review 1 found the decision incomplete in three places. These additions keep Option A and change nothing else.

1. **The search home has its own avatar menu.** `ui/src/pages/BrainstormSearch.jsx` renders its own `UserMenu`, not
   `BrainstormUserMenu`, so sub-decision 8's placements apply to both. Signed out, it shows the compact control beside
   Sign in in a `.bs-signin-group`; signed in, an Appearance section above the dropdown's footer.
2. **Phones: one button opens the three** (David, 2026-10-31). At 375px the signed-out bar was already full:
   logo, About and "Sign in with nostr" came to exactly 375px on `/` and `/setup`, so there is no room for three icons.
   - At 520px and below, the compact variant shows one button beside Sign in. It shows the current choice's icon and
     is named "Appearance: <choice>" (`aria-haspopup`, `aria-expanded`); pressing it opens the same three-option
     radio group in a small popover, which closes on a click outside it and on Escape.
   - Wider screens keep the three icons.
   - To keep the bar on one line, while signed out (`:has(.bs-signin-group)`) and only at 520px and below:
     - Sign in doesn't wrap and its side padding drops to 0.8rem;
     - the profile-family and Settings bars' side padding drops to 0.75rem and their gap to 0.5rem;
     - the design-shell bar's grid becomes `auto 1fr auto` (there's no alert in the middle column while signed out).
   - These are the only rules outside the design shell that change at phone widths, and only while signed out.
3. **Every pair the design shell paints follows the look**, not only its tokens. Palette step 1 now covers the
   Dictionary's shared `.dict-` rules too:
   - their literals read tokens with today's colour as the fallback (`var(--bsd-x, <literal>)`), so the admin pages
     resolve exactly as before;
   - text on the accent reads `--bsd-on-accent`;
   - text on the brand cyan reads `--bsd-on-cyan`;
   - text on `--text` (the Treasure Map's toast) reads `--bsd-on-text`;
   - `.dict-skin-light.dict-page` takes a dark `--dict-cyan` (`#56d4dd`);
   - the dark `--bsd-faint` is lifted to `#8b93a0` so it reaches 4.5:1 on the muted surface.
   - Tokens that matched an existing one in both looks were folded into it (`--bsd-surface` → `--bg`, the `-lit`
     twins, and so on). A use with a fallback keeps its own token, so the admin pages don't change.
4. **Keyboard:** each radio group has one tab stop (the checked option), and the arrow keys move the choice.
