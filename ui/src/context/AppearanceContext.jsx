import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { readStoredChoice, writeStoredChoice, resolveAppearance } from '@tapestry/appearance';

/**
 * The Appearance setting (appearance-setting #1, ADR 0001): System, Light or Dark, kept in this browser only.
 *
 * index.html's pre-render script has already set `<html data-appearance>` before this mounts; from here on this
 * provider owns it — the choice, the stored copy, and, under System, the computer's live setting. Nothing is sent to
 * the server.
 */

const DARK_QUERY = '(prefers-color-scheme: dark)';

const AppearanceContext = createContext({ choice: 'system', resolved: 'light', setChoice: () => {} });

export function useAppearance() {
  return useContext(AppearanceContext);
}

// `window.localStorage` itself throws when storage is blocked, so even reaching it is guarded.
function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

function systemPrefersDark() {
  try { return window.matchMedia(DARK_QUERY).matches; } catch { return false; }
}

function apply(resolved) {
  document.documentElement.setAttribute('data-appearance', resolved);
}

export function AppearanceProvider({ children }) {
  const [choice, setChoiceState] = useState(() => readStoredChoice(browserStorage()));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const resolved = resolveAppearance(choice, systemDark);

  // The pre-render hint has done its job once React has rendered; body:has(.bsd-page) takes over (ADR sub-decision 4).
  useEffect(() => {
    document.documentElement.removeAttribute('data-preload-family');
  }, []);

  // Under System, follow the computer live (ADR sub-decision 3).
  useEffect(() => {
    if (choice !== 'system') return undefined;
    let mql;
    try { mql = window.matchMedia(DARK_QUERY); } catch { return undefined; }
    const onChange = (e) => setSystemDark(e.matches);
    setSystemDark(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [choice]);

  useEffect(() => { apply(resolved); }, [resolved]);

  const setChoice = useCallback((next) => {
    const nextResolved = resolveAppearance(next, systemPrefersDark());
    apply(nextResolved); // at once, before React re-renders
    writeStoredChoice(browserStorage(), next); // a failed write still holds for this page
    setChoiceState(next);
  }, []);

  return (
    <AppearanceContext.Provider value={{ choice, resolved, setChoice }}>
      {children}
    </AppearanceContext.Provider>
  );
}
