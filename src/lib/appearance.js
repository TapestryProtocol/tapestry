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

function isDesignShellPath(pathname) {
  const p = String(pathname || '');
  return DESIGN_SHELL_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

module.exports = {
  STORAGE_KEY,
  CHOICES,
  DEFAULT_CHOICE,
  DESIGN_SHELL_PATH_PREFIXES,
  normalizeChoice,
  resolveAppearance,
  readStoredChoice,
  writeStoredChoice,
  isDesignShellPath,
};
