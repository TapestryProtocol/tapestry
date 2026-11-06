import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import { createBrain } from './brainData';
import { Board } from './dcPlayer';
import './reading.css';

/**
 * /reading — the reading views (experimental): this instance's concept graph read as a Table, an
 * Outline, a Drift from thing to thing, and a Dictionary of whose concepts are here.
 *
 * Each view is a board from the design canvas (./boards/*.dc.html), played by dcPlayer.jsx; the
 * data comes from readVerbs.js, which reads the graph through the open Cypher endpoint and the
 * relays through the existing relay endpoints. Read-only: nothing here writes. They were built as
 * the brainstorm-harness's `brain-view`, and this page serves the same boards from the instance
 * itself, so a hosted instance needs nothing installed to be read this way.
 *
 * VIEWS lists the main views; adding one is a line here and a board in ./boards/ (scoped: false
 * for a view about the whole instance: the scope picker greys out). The hash keeps the place:
 * #/<view>/<scope key>.
 */
const VIEWS = [
  { key: 'table', label: 'Table', board: 'Table', about: 'one group as rows, columns or time' },
  { key: 'outline', label: 'Outline', board: 'Outline', about: 'the scope as an outline; one thing read in full, its context as sentences' },
  { key: 'drift', label: 'Drift', board: 'Drift', about: 'go from thing to thing; it suggests what connects to what you have looked at' },
  { key: 'dictionary', label: 'Dictionary', board: 'Community', about: 'this instance among other people’s concepts: ours, copies, taken in, on the community relay; and the people', scoped: false },
];

// The boards' logic reads one global data source (their canvas runs them the same way).
const Brain = typeof window !== 'undefined' ? (window.Brain = window.Brain || createBrain()) : null;

function place() {
  const [, v, s] = decodeURIComponent(window.location.hash).match(/^#\/([^/]*)\/?(.*)$/) || [];
  return { view: VIEWS.find((x) => x.key === v) || VIEWS[0], scope: s || null };
}

export default function ReadingViews() {
  const { taPubkey, ownerPubkey } = useConfig();
  const [view, setView] = useState(() => place().view);
  const [scope, setScope] = useState(() => Brain.state.scope);
  const [scopes, setScopes] = useState(Brain.state.scopes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (taPubkey) Brain.configure({ taPubkey, ownerPubkey }); }, [taPubkey, ownerPubkey]);

  useEffect(() => {
    const offs = [
      Brain.on('busy', (n) => setBusy(n > 0)),
      Brain.on('scope', (s) => setScope(s)),
    ];
    let t;
    offs.push(Brain.on('error', (m) => { setError('Could not read the graph: ' + m); clearTimeout(t); t = setTimeout(() => setError(null), 8000); }));
    return () => { offs.forEach((f) => f()); clearTimeout(t); };
  }, []);

  // the instance's scopes, once: the hash's, else the biggest project
  useEffect(() => {
    if (Brain.state.scopes.length) return;
    const want = place().scope;
    Brain.api('scopes').then((d) => {
      Brain.state.scopes = d.scopes;
      setScopes(d.scopes);
      const pick = d.scopes.find((s) => s.key === want) ? want : (d.scopes[0] || {}).key;
      if (pick) Brain.set('scope', pick);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onHash = () => {
      const p = place();
      setView(p.view);
      if (p.scope && p.scope !== Brain.state.scope && Brain.state.scopes.some((s) => s.key === p.scope)) Brain.set('scope', p.scope);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const h = '#/' + view.key + '/' + (scope || '');
    if (decodeURIComponent(window.location.hash) !== h) window.history.replaceState(window.history.state, '', h);
    document.title = 'Reading: ' + view.label;
  }, [view, scope]);

  const onGo = useCallback((id) => Brain.emit('go', id), []);
  const switcherProps = useMemo(() => ({ onGo }), [onGo]);
  const viewProps = useMemo(() => ({}), []);
  const groups = [['project', 'Projects'], ['concept', 'Top concepts']];

  return (
    <div className="reading-page">
      <header className="reading-bar">
        <Link to="/tapestry/" className="reading-brand" title="Back to the Tapestry dashboard">Tapestry</Link>
        <span className="reading-tag" title="An experimental page: read-only, and its look and data may change">reading · experimental</span>
        <nav className="reading-views" aria-label="Views">
          {VIEWS.map((v) => (
            <a key={v.key} href={'#/' + v.key + '/' + (scope || '')} title={v.about} aria-current={v === view ? 'page' : undefined}>{v.label}</a>
          ))}
        </nav>
        <span className="reading-spacer" />
        <label className="reading-scope" title={view.scoped === false ? 'This view is about the whole instance, not one scope' : ''}
          style={view.scoped === false ? { opacity: 0.45 } : undefined}>
          Scope
          <select aria-label="Scope" value={scope || ''} disabled={view.scoped === false || !scopes.length}
            onChange={(e) => Brain.set('scope', e.target.value)}>
            {!scopes.length && <option value="">Loading…</option>}
            {groups.map(([k, label]) => {
              const items = scopes.filter((s) => s.kind === k);
              return items.length ? (
                <optgroup key={k} label={label}>
                  {items.map((s) => <option key={s.key} value={s.key}>{s.label}  ({s.count})</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
        <span className="reading-jump"><Board name="Switcher" props={switcherProps} /></span>
        <span className={'reading-busy' + (busy ? ' on' : '')} title="reading the graph" />
      </header>
      <main className="reading-view">
        {taPubkey ? <Board key={view.key} name={view.board} props={viewProps} />
          : <p className="reading-wait">Finding this instance’s assistant…</p>}
      </main>
      {error && <div className="reading-error" role="status">{error}</div>}
    </div>
  );
}
