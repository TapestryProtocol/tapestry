/**
 * The Appearance setting: System, Light or Dark, kept per browser (story appearance-setting/1, ADR 0001).
 *
 * A choice resolves to the look a page shows: System follows the computer's `prefers-color-scheme`, Light and Dark
 * hold whatever the computer says. The resolved look goes on `<html data-appearance="light|dark">`, which every page
 * family's palette reads.
 *
 * `ui/index.html` carries a hand copy of `normalizeChoice`, `resolveAppearance` and `isDesignShellPath` in its
 * pre-render script (it runs before any module can load); test/appearance-setting.test.js P2 keeps the two in step.
 *
 * Pure CJS, zero requires (the broadcastOutcome / bValueForms idiom). Imported by the browser through the
 * `@tapestry/appearance` alias in ui/vite.config.js.
 */

'use strict';

const STORAGE_KEY = 'tapestry_appearance';
const CHOICES = ['system', 'light', 'dark'];
// David, 2026-10-31: a first-time visitor follows the computer.
const DEFAULT_CHOICE = 'system';

// The design-shell pages (BrainstormDesignShell). The pre-render script paints their background before React mounts;
// story 3 retires this list once every Brainstorm family follows the setting (ADR 0001 sub-decision 4).
const DESIGN_SHELL_PATH_PREFIXES = ['/dictionary', '/treasure-map', '/assistants'];
// The reading pages (story appearance-setting/2, ADR 0002 sub-decision 5): their pre-render hint paints the light canvas
// in Light. Story 3 adds the working pages' paths. The lists stay: a default for every other path would make a page in
// no family (NotFound) flash light (ADR 0004, Option B).
const READING_PATH_PREFIXES = ['/about', '/about-brainstorm-search', '/how-search-works', '/brainstorm-skill', '/personalization',
  '/settings', '/user', '/feed', '/event'];
// The working pages (story appearance-setting/3, ADR 0003 sub-decision 5): the same 'profile' hint. /assistant is matched
// only after the design shell, so /assistants is never taken for it. /information-for-agents is a developer page
// (ADR 0004 sub-decision 4).
const WORKING_PATH_PREFIXES = ['/tags', '/tag', '/pins', '/pin', '/assistant', '/setup', '/developers', '/information-for-agents'];
// The search home (story appearance-setting/4): an exact path, since every path starts with it.
const SEARCH_HOME_PATH = '/';

function normalizeChoice(value) {
  return CHOICES.includes(value) ? value : DEFAULT_CHOICE;
}

function resolveAppearance(choice, systemPrefersDark) {
  const c = normalizeChoice(choice);
  if (c === 'system') return systemPrefersDark ? 'dark' : 'light';
  return c;
}

// Never throws: storage that is missing, blocked or throwing reads as the default.
function readStoredChoice(storage) {
  try {
    return normalizeChoice(storage ? storage.getItem(STORAGE_KEY) : null);
  } catch {
    return DEFAULT_CHOICE;
  }
}

// Never throws: returns false when the choice couldn't be kept (it still holds for the page).
function writeStoredChoice(storage, choice) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, normalizeChoice(choice));
    return true;
  } catch {
    return false;
  }
}

function underAny(prefixes, pathname) {
  const p = String(pathname || '');
  return prefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

function isDesignShellPath(pathname) {
  return underAny(DESIGN_SHELL_PATH_PREFIXES, pathname);
}

function isReadingPath(pathname) {
  return underAny(READING_PATH_PREFIXES, pathname);
}

function isWorkingPath(pathname) {
  return underAny(WORKING_PATH_PREFIXES, pathname);
}

function isSearchHomePath(pathname) {
  return pathname === SEARCH_HOME_PATH;
}

// The pre-render hint a path gets: 'design', 'profile' or null.
function preloadFamily(pathname) {
  if (isDesignShellPath(pathname)) return 'design';
  if (isReadingPath(pathname) || isWorkingPath(pathname) || isSearchHomePath(pathname)) return 'profile';
  return null;
}

module.exports = {
  STORAGE_KEY,
  CHOICES,
  DEFAULT_CHOICE,
  DESIGN_SHELL_PATH_PREFIXES,
  READING_PATH_PREFIXES,
  WORKING_PATH_PREFIXES,
  SEARCH_HOME_PATH,
  normalizeChoice,
  resolveAppearance,
  readStoredChoice,
  writeStoredChoice,
  isDesignShellPath,
  isReadingPath,
  isWorkingPath,
  isSearchHomePath,
  preloadFamily,
};
