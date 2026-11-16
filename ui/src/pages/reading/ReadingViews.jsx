import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import BrainstormUserMenu from '../../components/BrainstormUserMenu';
import { createBrain } from './brainData';
import { Board } from './dcPlayer';
import './reading.css';

/**
 * /reading — the reading views (experimental): this instance's concept graph read as a Table, an
 * Outline, a Drift from thing to thing, and a Dictionary of whose concepts are here.
 *
 * Each view is a board from the design canvas (./boards/*.dc.html), played by dcPlayer.jsx; the
 * data comes from readVerbs.js, which reads the graph through the open Cypher endpoint and the
 * relays through the existing relay endpoints. Outline also writes (writeVerbs.js): the signed-in
 * owner can edit a thing's title and text and make a new item in a kind or a Set. They were built as
 * the brainstorm-harness's `brain-view`, and this page serves the same boards from the instance
 * itself, so a hosted instance needs nothing installed to be read this way.
 *
 * VIEWS lists the main views; adding one is a line here and a board in ./boards/ (scoped: false
 * for a view about the whole instance: the scope picker greys out). The hash keeps the place:
 * #/<view>/<scope key>[/<item id>], the item being the thing the view has open (Brain.state.item).
 * Opening a thing, or picking a scope, is a history entry, so Back and Forward walk the things you
 * opened; going Back applies the place without writing a new one.
 */
const VIEWS = [
  { key: 'table', label: 'Table', board: 'Table', about: 'one group as rows, columns or time' },
  { key: 'outline', label: 'Outline', board: 'Outline', about: 'the scope as an outline; one thing read in full, its context as sentences' },
  { key: 'plan', label: 'Plan', board: 'Plan', about: 'a plan in order: each item’s state, what blocks what, and what it hangs on' },
  { key: 'drift', label: 'Drift', board: 'Drift', about: 'go from thing to thing; it suggests what connects to what you have looked at' },
  { key: 'dictionary', label: 'Dictionary', board: 'Community', about: 'this instance among other people’s concepts: ours, copies, taken in, on the community relay; and the people', scoped: false },
];

// The boards' logic reads one global data source (their canvas runs them the same way).
const Brain = typeof window !== 'undefined' ? (window.Brain = window.Brain || createBrain()) : null;

function place() {
  const [v, s, i] = window.location.hash.replace(/^#\/?/, '').split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  return { view: VIEWS.find((x) => x.key === v) || VIEWS[0], scope: s || null, item: i || null };
}
const hashOf = (view, scope, item) => '#/' + view.key + '/' + encodeURIComponent(scope || '') + (item ? '/' + encodeURIComponent(item) : '');

// The history: a change of scope and item in one go (a click that moves the scope and opens a thing)
// is ONE entry; a place applied from the hash (Back, Forward, a link) writes nothing new.
const nav = { view: null, applying: false, queued: null };
function writePlace(push) {
  if (!nav.view) return;
  if (nav.queued) { nav.queued.push = nav.queued.push || push; return; }
  nav.queued = { push };
  Promise.resolve().then(() => {
    const q = nav.queued; nav.queued = null;
    const h = hashOf(nav.view, Brain.state.scope, Brain.state.item);
    if (window.location.hash === h) return;
    if (q.push) window.history.pushState(window.history.state, '', h); else window.history.replaceState(window.history.state, '', h);
  });
}

export default function ReadingViews() {
  const { taPubkey, ownerPubkey } = useConfig();
  const { user, login, logout } = useAuth();
  const [view, setView] = useState(() => place().view);
  const [scope, setScope] = useState(() => Brain.state.scope);
  const [scopes, setScopes] = useState(Brain.state.scopes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const signedIn = !!(user && user.pubkey);
  const isOwner = !!(user && user.classification === 'owner');

  useEffect(() => { if (taPubkey) Brain.configure({ taPubkey, ownerPubkey }); }, [taPubkey, ownerPubkey]);
  useEffect(() => { Brain.configure({ signedIn, isOwner }); }, [signedIn, isOwner]);

  useEffect(() => {
    if (Brain.state.item == null) Brain.state.item = place().item;
    let t;
    const offs = [
      Brain.on('busy', (n) => setBusy(n > 0)),
      Brain.on('scope', (s) => { setScope(s); writePlace(!nav.applying); }),
      Brain.on('item', () => writePlace(!nav.applying)),
      Brain.on('error', (m) => { setError('Could not read the graph: ' + m); clearTimeout(t); t = setTimeout(() => setError(null), 8000); }),
    ];
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
      if (pick) { nav.applying = true; Brain.set('scope', pick); nav.applying = false; }
    }).catch(() => {});
  }, []);

  // Back, Forward, a typed hash or a view link: apply the place, writing nothing new
  useEffect(() => {
    const fromHash = () => {
      const p = place();
      nav.applying = true;
      try {
        if (p.scope && p.scope !== Brain.state.scope && Brain.state.scopes.some((s) => s.key === p.scope)) Brain.set('scope', p.scope);
        Brain.set('item', p.item);
        setView(p.view);
      } finally { nav.applying = false; }
    };
    window.addEventListener('popstate', fromHash);
    window.addEventListener('hashchange', fromHash);
    return () => { window.removeEventListener('popstate', fromHash); window.removeEventListener('hashchange', fromHash); };
  }, []);

  useEffect(() => {
    nav.view = view;
    writePlace(false);
    document.title = 'Reading: ' + view.label;
  }, [view]);

  const onGo = useCallback((id) => Brain.emit('go', id), []);
  const switcherProps = useMemo(() => ({ onGo }), [onGo]);
  const viewProps = useMemo(() => ({}), []);
  const groups = [['project', 'Projects'], ['concept', 'Top concepts']];
  // a scope picked here starts that scope afresh: nothing open in it yet
  const pickScope = (k) => { Brain.set('item', null); Brain.set('scope', k); };

  return (
    <div className="reading-page">
      <header className="reading-bar">
        <Link to="/tapestry/" className="reading-brand" title="Back to the Tapestry dashboard">Tapestry</Link>
        <span className="reading-tag" title="An experimental page: its look and data may change">reading · experimental</span>
        <nav className="reading-views" aria-label="Views">
          {VIEWS.map((v) => (
            <a key={v.key} href={hashOf(v, scope, null)} title={v.about} aria-current={v === view ? 'page' : undefined}>{v.label}</a>
          ))}
        </nav>
        <span className="reading-spacer" />
        <label className="reading-scope" title={view.scoped === false ? 'This view is about the whole instance, not one scope' : ''}
          style={view.scoped === false ? { opacity: 0.45 } : undefined}>
          <span className="reading-scope-label">Scope</span>
          <select aria-label="Scope" value={scope || ''} disabled={view.scoped === false || !scopes.length}
            onChange={(e) => pickScope(e.target.value)}>
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
        <span className="reading-who" title={isOwner ? 'Signed in as this instance’s owner: Outline can edit and add' : signedIn ? 'Signed in, not as the owner: read-only' : 'Not signed in: read-only'}>
          {isOwner ? 'owner · can edit' : 'read-only'}
        </span>
        <span className="reading-auth"><BrainstormUserMenu user={user} login={login} logout={logout} /></span>
      </header>
      <main className="reading-view">
        {taPubkey ? <Board key={view.key} name={view.board} props={viewProps} />
          : <p className="reading-wait">Finding this instance’s assistant…</p>}
      </main>
      {error && <div className="reading-error" role="status">{error}</div>}
    </div>
  );
}
