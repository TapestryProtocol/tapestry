'use strict';
/**
 * Where the instance's own Cypher makes nodes — for story graph-operations-foundation #3 (Loom A10.3), ADR
 * graph-operations-foundation/0003 Decisions 8 and 9. Test-only.
 *
 *   literals(rel, text)      the string spans that can hold Cypher in one file: in JavaScript, its quoted strings and
 *                            template literals (a template's ${…} kept as written); in a shell script, its double-
 *                            quoted strings and here-documents; in an APOC command file, its double-quoted strings.
 *   nodeSites(text)          in one piece of Cypher, every node pattern a CREATE or MERGE clause makes: one with a
 *                            label or a property map. { variable (null when anonymous), labels, at, clause }.
 *   fileSites(rel, text)     nodeSites over a file's literals, each with its literal and its line.
 *   appliesKey(site, keyNode) whether the site's literal applies the key fragment to its variable: the fragment
 *                            written out (whitespace aside), ${keyNode('v')} in a template, or keyNode('v') in the
 *                            same JavaScript statement as the literal.
 *
 * The scanner is deliberately small. A JavaScript regex literal is skipped by the usual heuristic (a `/` where an
 * expression starts), and the suites check that it finds the sites they know of, so a scanner gone wrong fails loudly
 * rather than passing on nothing.
 */

const CLAUSE_END = /\b(CREATE|MERGE|SET|ON|WITH|RETURN|WHERE|MATCH|OPTIONAL|DELETE|DETACH|REMOVE|FOREACH|UNWIND|CALL|YIELD|UNION|ORDER|LIMIT|SKIP)\b/g;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

const kindOf = (rel) => {
  const base = rel.split('/').pop();
  if (/\.(js|jsx|cjs|mjs)$/.test(base)) return 'js';
  if (/\.sh$/.test(base)) return 'sh';
  if (/^apocCypherCommand/.test(base) || /\.cypher$/.test(base)) return 'apoc';
  return null;
};

// ── JavaScript ───────────────────────────────────────────────────────────────────────────────────────────────────

function readTemplate(src, i, out) {
  // src[i] === '`'
  let j = i + 1;
  while (j < src.length && src[j] !== '`') {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === '$' && src[j + 1] === '{') {
      let depth = 1;
      let k = j + 2;
      while (k < src.length && depth > 0) {
        const ch = src[k];
        if (ch === "'" || ch === '"') { k++; while (k < src.length && src[k] !== ch) { if (src[k] === '\\') k++; k++; } k++; continue; }
        if (ch === '`') { k = readTemplate(src, k, out); continue; }
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        k++;
      }
      j = k;
      continue;
    }
    j++;
  }
  out.push({ start: i, end: j + 1, kind: 'template' });
  return j + 1;
}

function jsLiterals(src) {
  const out = [];
  let i = 0;
  let last = ''; // the last significant token, for the regex-literal heuristic
  const regexMayStart = () => !last || /[(,=:[!&|?{};+\-*%<>~^]$/.test(last)
    || /^(return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/.test(last);
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === "'" || c === '"') {
      const start = i;
      i++;
      while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
      i++;
      out.push({ start, end: i, kind: 'quote' });
      last = 'x';
      continue;
    }
    if (c === '`') { i = readTemplate(src, i, out); last = 'x'; continue; }
    if (c === '/' && regexMayStart()) {
      i++;
      let inClass = false;
      while (i < src.length) {
        const ch = src[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '\n') break;
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) break;
        i++;
      }
      i++;
      while (/[a-z]/i.test(src[i] || '')) i++;
      last = 'x';
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      last = src.slice(i, j);
      i = j;
      continue;
    }
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return out;
}

// ── Shell and APOC files ─────────────────────────────────────────────────────────────────────────────────────────

function doubleQuoted(src, from = 0, to = src.length) {
  const out = [];
  let i = from;
  while (i < to) {
    const c = src[i];
    if (c === '#' && (i === 0 || /\s/.test(src[i - 1]))) { const e = src.indexOf('\n', i); i = e < 0 ? to : e; continue; }
    if (c === "'" && kindOfCurrent === 'sh') { const e = src.indexOf("'", i + 1); i = e < 0 ? to : e + 1; continue; }
    if (c === '"') {
      const start = i;
      i++;
      while (i < to && src[i] !== '"') { if (src[i] === '\\') i++; i++; }
      i++;
      out.push({ start, end: Math.min(i, to), kind: 'quote' });
      continue;
    }
    i++;
  }
  return out;
}
let kindOfCurrent = null;

function hereDocs(src) {
  const out = [];
  const re = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n/g;
  let m;
  while ((m = re.exec(src))) {
    const bodyStart = m.index + m[0].length;
    const endRe = new RegExp(`^\\s*${m[2]}\\s*$`, 'm');
    const rest = src.slice(bodyStart);
    const e = rest.search(endRe);
    const end = e < 0 ? src.length : bodyStart + e;
    out.push({ start: bodyStart, end, kind: 'heredoc' });
    re.lastIndex = end;
  }
  return out;
}

function shLiterals(src) {
  kindOfCurrent = 'sh';
  const docs = hereDocs(src);
  // Outside here-documents: double-quoted strings, with comments and single quotes skipped. Inside one: the body,
  // and its double-quoted strings (an apoc.periodic.iterate's statements), read without shell quoting.
  const out = [];
  let from = 0;
  for (const d of docs) {
    out.push(...doubleQuoted(src, from, d.start));
    out.push(d);
    kindOfCurrent = 'apoc';
    out.push(...doubleQuoted(src, d.start, d.end));
    kindOfCurrent = 'sh';
    from = d.end;
  }
  out.push(...doubleQuoted(src, from, src.length));
  kindOfCurrent = null;
  return out;
}
function apocLiterals(src) {
  kindOfCurrent = 'apoc';
  const out = doubleQuoted(src.replace(/^\s*\/\/.*$/gm, (l) => ' '.repeat(l.length)));
  kindOfCurrent = null;
  return out;
}

/** The spans of a file that can hold Cypher. */
function literals(rel, src) {
  const k = kindOf(rel);
  if (k === 'js') return jsLiterals(src);
  if (k === 'sh') return shLiterals(src);
  if (k === 'apoc') return apocLiterals(src);
  return [];
}

// ── Node patterns in CREATE and MERGE clauses ────────────────────────────────────────────────────────────────────

/** ${…} in a template replaced by a plain token, so the Cypher around it can be read. */
function blankInterpolations(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] === '{') {
      let depth = 1;
      let k = i + 2;
      while (k < text.length && depth > 0) { if (text[k] === '{') depth++; else if (text[k] === '}') depth--; k++; }
      out += '__X__';
      i = k;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

/** The top-level (…) groups in a clause, skipping what is inside quotes, braces and brackets. */
function parenGroups(clause) {
  const groups = [];
  let i = 0;
  let brace = 0;
  let bracket = 0;
  while (i < clause.length) {
    const c = clause[i];
    if (c === "'" || c === '"') { const e = clause.indexOf(c, i + 1); i = e < 0 ? clause.length : e + 1; continue; }
    if (c === '{') brace++;
    else if (c === '}') brace--;
    else if (c === '[') bracket++;
    else if (c === ']') bracket--;
    else if (c === '(' && brace === 0 && bracket === 0) {
      let depth = 1;
      let k = i + 1;
      while (k < clause.length && depth > 0) {
        const ch = clause[k];
        if (ch === "'" || ch === '"') { const e = clause.indexOf(ch, k + 1); k = e < 0 ? clause.length : e + 1; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        k++;
      }
      groups.push({ at: i, inner: clause.slice(i + 1, k - 1) });
      i = k;
      continue;
    }
    i++;
  }
  return groups;
}

/** Every node a CREATE or MERGE clause in `cypher` makes: a pattern with a label or a property map. */
function nodeSites(cypher) {
  const text = blankInterpolations(String(cypher));
  const sites = [];
  const re = /\b(CREATE|MERGE)\b/g;
  let m;
  while ((m = re.exec(text))) {
    const after = text.slice(m.index + m[0].length);
    if (/^\s*(CONSTRAINT|INDEX|OR\s+REPLACE|DATABASE|ALIAS|USER|ROLE)\b/i.test(after)) continue;
    if (/\bON\s+$/i.test(text.slice(Math.max(0, m.index - 6), m.index))) continue; // ON CREATE / ON MATCH
    CLAUSE_END.lastIndex = 0;
    const rest = after.replace(/^\s+/, '');
    let end = after.length;
    const ends = [...after.matchAll(CLAUSE_END)].filter((x) => x.index > 0);
    if (ends.length) end = ends[0].index;
    const clause = after.slice(0, end);
    for (const g of parenGroups(clause)) {
      const inner = g.inner.trim();
      const parsed = inner.match(/^([A-Za-z_][A-Za-z0-9_]*)?\s*((?::\s*`?[A-Za-z_][A-Za-z0-9_]*`?\s*)*)\s*(\{[\s\S]*\})?$/);
      if (!parsed) continue;
      const labels = (parsed[2] || '').split(':').map((x) => x.replace(/[`\s]/g, '')).filter(Boolean);
      if (!labels.length && !parsed[3]) continue;
      sites.push({ variable: parsed[1] || null, labels, at: m.index, clause: `${m[1]} ${clause.trim()}`.slice(0, 160) });
    }
    void rest;
  }
  return sites;
}

const lineAt = (src, i) => src.slice(0, i).split('\n').length;

/** Every node-making site in a file, with its literal and line. Nested literals: the innermost holds the site. */
function fileSites(rel, src) {
  const spans = literals(rel, src).sort((a, b) => (a.end - a.start) - (b.end - b.start));
  const seen = new Set();
  const out = [];
  for (const span of spans) {
    const text = src.slice(span.start, span.end);
    for (const s of nodeSites(text)) {
      // the raw position of this clause, to attribute it to its innermost span only
      const raw = span.start + rawIndex(text, s.at);
      const key = `${raw}:${s.variable}:${s.labels.join(':')}:${s.clause}`;
      const inner = spans.find((x) => x.start <= raw && raw < x.end);
      if (inner !== span || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...s, file: rel, line: lineAt(src, raw), span, literal: text });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}
/** Map an index in blankInterpolations(text) back to text. */
function rawIndex(text, blankAt) {
  let i = 0;
  let b = 0;
  while (i < text.length && b < blankAt) {
    if (text[i] === '$' && text[i + 1] === '{') {
      let depth = 1;
      let k = i + 2;
      while (k < text.length && depth > 0) { if (text[k] === '{') depth++; else if (text[k] === '}') depth--; k++; }
      i = k;
      b += 5;
      continue;
    }
    i++;
    b++;
  }
  return i;
}

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does the site's literal (or, in JavaScript, its statement) apply the key fragment to the site's variable? */
function appliesKey(site, keyNode, src) {
  const v = site.variable;
  if (!v || !IDENT.test(v)) return false;
  if (norm(site.literal).includes(norm(keyNode(v)))) return true;
  if (kindOf(site.file) !== 'js') return false;
  const call = new RegExp(`keyNode\\(\\s*(['"\`])${esc(v)}\\1\\s*\\)`);
  if (call.test(site.literal)) return true;
  // keyNode('v') in the same JavaScript statement: from the literal's end to the next ; at the top level
  if (src) {
    let depth = 0;
    let k = site.span.end;
    while (k < src.length) {
      const ch = src[k];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) break; depth--; } else if (ch === ';' && depth === 0) break;
      k++;
    }
    if (call.test(src.slice(site.span.end, k))) return true;
  }
  return false;
}

module.exports = { kindOf, literals, nodeSites, fileSites, appliesKey, norm, lineAt, blankInterpolations };
