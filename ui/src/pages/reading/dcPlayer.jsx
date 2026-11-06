/**
 * Plays the design canvas's .dc.html boards inside this app, on React.
 *
 * A board is one file: an <x-dc> template (holes {{a.b}}, <sc-for>, <sc-if>, <dc-import>, <helmet>)
 * and a logic class (`class Component extends DCLogic`, with renderVals(), state/setState and the
 * React lifecycle). This reads that format and renders it, so a board designed on the canvas runs
 * here unchanged in its template. It knows nothing about the graph: brainData.js does the data.
 *
 * The boards are bundled as text (import.meta.glob ?raw): no request to load one, and no path on
 * the server. A port of the brainstorm-harness's reading/dc.js (which plays them on Preact); the
 * React differences are in `reactProps`: style strings become objects, attribute names become React's,
 * and an attribute present with no value is true.
 */
import React from 'react';

const SOURCES = import.meta.glob('./boards/*.dc.html', { query: '?raw', import: 'default', eager: true });
const sourceOf = (name) => SOURCES[`./boards/${name}.dc.html`];

const VOID = new Set(['br', 'input', 'img', 'link', 'meta', 'hr', 'col', 'area', 'base', 'source', 'wbr']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#'
  ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
  : ENT[e] !== undefined ? ENT[e] : m));

// A small parser for the template subset. The browser's own HTML parser is no use here: it
// lowercases onClick, and it moves an <sc-for> out of a <tbody>.
function parse(src) {
  const root = { tag: '#root', attrs: [], kids: [] }, stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|</g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const t = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === t) { stack.length = i; break; }
      continue;
    }
    if (m[2]) {
      const tag = m[2].toLowerCase(), attrs = [];
      const ar = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let a;
      while ((a = ar.exec(m[3] || ''))) {
        const has = a[2] !== undefined || a[3] !== undefined || a[4] !== undefined;
        attrs.push([a[1], has ? decode(a[2] ?? a[3] ?? a[4]) : null]);   // null: present, no value
      }
      const el = { tag, attrs, kids: [] };
      top.kids.push(el);
      if (VOID.has(tag) || m[4]) continue;
      if (tag === 'style' || tag === 'script') {   // raw text up to the closing tag
        const end = src.indexOf('</' + tag, re.lastIndex);
        el.raw = src.slice(re.lastIndex, end < 0 ? src.length : end);
        re.lastIndex = end < 0 ? src.length : src.indexOf('>', end) + 1;
      } else stack.push(el);
      continue;
    }
    top.kids.push({ text: decode(m[5] !== undefined ? m[5] : m[0]) });
  }
  return root;
}

const attr = (n, k) => { const a = n.attrs.find((x) => x[0] === k); return a ? a[1] : undefined; };
const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// holes: a dotted lookup, or a literal; a whole-value hole keeps its raw value
function look(path, scope) {
  if (path === 'true') return true;
  if (path === 'false') return false;
  if (path === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  if (/^'.*'$|^".*"$/.test(path)) return path.slice(1, -1);
  let v = scope;
  for (const k of path.split('.')) { if (v == null) return undefined; v = v[k]; }
  return v;
}
function val(str, scope, text) {   // in text, the spaces beside a hole are kept
  if (str == null) return str;
  const whole = (text ? /^\{\{\s*([^}]+?)\s*\}\}$/ : /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/).exec(str);
  if (whole) return look(whole[1], scope);
  if (str.indexOf('{{') < 0) return str;
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, p) => { const v = look(p, scope); return v == null ? '' : String(v); });
}

// ── React's spelling of the template's attributes ──────────────────────────
const RENAME = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength',
  minlength: 'minLength', colspan: 'colSpan', rowspan: 'rowSpan', autofocus: 'autoFocus', autocomplete: 'autoComplete',
  spellcheck: 'spellCheck', contenteditable: 'contentEditable', crossorigin: 'crossOrigin', srcset: 'srcSet',
  enterkeyhint: 'enterKeyHint', inputmode: 'inputMode', 'xlink:href': 'xlinkHref',
};
const BOOLEAN = new Set(['disabled', 'checked', 'readOnly', 'required', 'selected', 'multiple', 'autoFocus', 'hidden', 'open', 'muted', 'controls']);
const STYLES = new Map();
function styleObject(s) {   // "font-size: 13px; --x: y" -> { fontSize: '13px', '--x': 'y' }, remembered per string
  if (typeof s !== 'string') return s;
  let o = STYLES.get(s);
  if (o) return o;
  o = {};
  let depth = 0, quote = null, start = 0;
  const decls = [];
  for (let i = 0; i <= s.length; i++) {   // split on ; outside parentheses and quotes (url(data:…;base64,…))
    const c = s[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if ((c === ';' && depth === 0) || i === s.length) { decls.push(s.slice(start, i)); start = i + 1; }
  }
  for (const d of decls) {
    const i = d.indexOf(':');
    if (i < 0) continue;
    const k = d.slice(0, i).trim(), v = d.slice(i + 1).trim();
    if (!k) continue;
    o[k.startsWith('--') ? k : camel(k.replace(/^-ms-/, 'ms-')).replace(/^-([a-z])/, (_, c) => c.toUpperCase())] = v;
  }
  STYLES.set(s, o);
  return o;
}
function reactName(k) {
  if (RENAME[k]) return RENAME[k];
  if (/^(data|aria)-/.test(k) || /^on[A-Z]/.test(k)) return k;
  return k.includes('-') ? camel(k) : k;
}

function kids(list, scope, def) {
  const out = [];
  for (const n of list) {
    const r = one(n, scope, def);
    if (Array.isArray(r)) out.push(...r); else if (r != null && r !== '') out.push(r);
  }
  return out;
}
function one(n, scope, def) {
  if (n.text !== undefined) {
    if (!n.text.trim() && n.text.indexOf('\n') >= 0) return null;   // layout whitespace, as JSX drops it
    const v = val(n.text, scope, true);
    return v == null ? '' : String(v);
  }
  if (n.tag === 'sc-for') {
    const list = val(attr(n, 'list') || '', scope) || [], as = attr(n, 'as') || 'item', out = [];
    list.forEach((it, i) => { const s = Object.create(scope); s[as] = it; s.$index = i; out.push(...kids(n.kids, s, def)); });
    return out;
  }
  if (n.tag === 'sc-if') return val(attr(n, 'value') || '', scope) ? kids(n.kids, scope, def) : null;
  if (n.tag === 'helmet') return null;
  if (n.tag === 'dc-import') {
    const props = {};
    let name = '';
    for (const [k, v] of n.attrs) {
      if (k === 'name') name = val(v, scope);
      else if (!k.startsWith('hint-')) props[camel(k)] = val(v, scope);
    }
    return React.createElement(Board, { key: name, name, props });
  }
  const props = {};
  for (const [k, v] of n.attrs) {
    if (k.startsWith('hint-')) continue;
    let x = v === null ? true : val(v, scope);
    const key = reactName(k);
    if (x === undefined) continue;
    if (/^on[A-Z]/.test(k) && typeof x !== 'function') continue;
    if (key === 'style') x = styleObject(x);
    else if (BOOLEAN.has(key)) x = x === '' || (x !== 'false' && !!x);
    if (n.tag === 'a' && k === 'href' && typeof x === 'string' && /\.dc\.html$/.test(x)) x = '#/' + x.replace(/^.*\//, '').replace(/\.dc\.html$/, '').toLowerCase();
    props[key] = x;
  }
  if ((n.tag === 'input' || n.tag === 'textarea') && 'value' in props && !props.onChange) props.readOnly = true;   // React: a value nothing changes
  if (n.tag === 'input' && 'checked' in props && !props.onChange) props.readOnly = true;
  return React.createElement(n.tag, props, ...(n.raw !== undefined ? [n.raw] : kids(n.kids, scope, def)));
}

// ── loading a board: its template, its helmet (fonts, styles: once), its logic class ──
export class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState() {}
  forceUpdate() {}
}
const DEFS = {}, INJECTED = new Set();
function load(name) {
  if (!DEFS[name]) {
    const src = sourceOf(name);
    if (src == null) throw new Error(`no board ${name}.dc.html`);
    const s = src.indexOf('<x-dc>'), e = src.lastIndexOf('</x-dc>');
    const tree = parse(src.slice(s + 6, e));
    for (const hm of tree.kids.filter((k) => k.tag === 'helmet')) {
      for (const k of hm.kids) {
        if (!k.tag) continue;
        const sig = k.tag + (attr(k, 'href') || k.raw || '');
        if (INJECTED.has(sig)) continue;
        INJECTED.add(sig);
        const el = document.createElement(k.tag);
        k.attrs.forEach(([a, v]) => el.setAttribute(a, v ?? ''));
        if (k.raw !== undefined) el.textContent = k.raw;
        document.head.appendChild(el);
      }
    }
    const sm = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
    // The board's own logic, as the canvas wrote it: it runs with this app's privileges, like any bundled code.
    const Cls = new Function('DCLogic', (sm ? sm[1] : 'class Component extends DCLogic { renderVals() { return {}; } }') + '\nreturn Component;')(DCLogic);
    DEFS[name] = { name, body: tree.kids.filter((k) => k.tag !== 'helmet'), Cls };
  }
  return DEFS[name];
}

const errStyle = { color: '#B4442E', padding: 16, whiteSpace: 'pre-wrap' };

/** One board on the page: its logic object lives here, and its setState re-renders it. */
export class Board extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tick: 0 };
    try { this.def = load(props.name); } catch (e) { this.err = e; }
    if (this.def) {
      const L = new this.def.Cls(props.props || {}), host = this;
      L.props = props.props || {};
      L.state = L.state || {};
      L.setState = function (u, cb) {
        const nx = typeof u === 'function' ? u(L.state, L.props) : u;
        L.state = { ...L.state, ...nx };
        if (host.alive) host.setState((s) => ({ tick: s.tick + 1 }), cb);
      };
      L.forceUpdate = (cb) => { if (host.alive) host.forceUpdate(cb); };
      this.logic = L;
    }
  }
  componentDidMount() {
    this.alive = true;
    if (this.logic && this.logic.componentDidMount) this.logic.componentDidMount();
  }
  componentDidUpdate() {   // as React: after every update, with the props and state before it
    const L = this.logic;
    if (L && L.componentDidUpdate && this.prev) L.componentDidUpdate(this.prev.props, this.prev.state);
  }
  componentWillUnmount() {
    this.alive = false;
    if (this.logic && this.logic.componentWillUnmount) this.logic.componentWillUnmount();
  }
  render() {
    if (this.err) return <pre style={errStyle}>{String(this.err)}</pre>;
    const L = this.logic;
    this.prev = { props: L.props, state: this.lastState };
    L.props = this.props.props || {};
    this.lastState = L.state;
    let v;
    try { v = L.renderVals(); } catch (e) {
      console.error(e);
      return <pre style={errStyle}>{this.def.name + ': ' + (e.stack || e)}</pre>;
    }
    const out = kids(this.def.body, v, this.def);
    return out.length === 1 ? out[0] : React.createElement(React.Fragment, null, ...out);
  }
}
