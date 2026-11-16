'use strict';
/**
 * The graph rule concept's elements, made from the rulebook and the rules' code — story graph-operations-first-slice
 * #41 (Loom A10.41), ADR graph-operations-first-slice/0041 Decisions 2 to 5 and Amendment 1.
 *
 * Each rule's wording is written once, in the rulebook, docs/GRAPH_RULES.md (ADR graph-rules/0001 Decision 5). This
 * script makes one element file per entry there, into firmware's concepts/graph-rule/elements/, from the entry and from
 * what the rule's code declares (src/operations/rules/<name>.js). A stack-free test fails while the committed files
 * differ from what it makes, so they are never kept by hand.
 *
 *   node src/firmware/graph-rules.js           write the files, and remove any that no entry makes; on any problem,
 *                                              write nothing, list the problems and exit 1
 *   node src/firmware/graph-rules.js --check   write nothing; exit 1 when a file would change, appear or go
 *
 * Its parts are pure: parseRulebook(text), itemsFor({ entries, rules, ruleFiles, ruleProblems }) and
 * elementFiles(items). It opens nothing: no database and no network.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const RULEBOOK = path.join(REPO, 'docs/GRAPH_RULES.md');
const RULES_DIR = path.join(REPO, 'src/operations/rules');

/** The eight fields every entry has, by their labels (Decision 3), and their keys in an item (Decision 2). */
const LABELS = Object.freeze({
  Says: 'says',
  Kind: 'kind',
  'Refuses or reports': 'refusesOrReports',
  Check: 'check',
  Repair: 'repair',
  'Enforced by': 'enforcedBy',
  Status: 'status',
  Source: 'source',
});
const STATUSES = Object.freeze(['proposed', 'enforced', 'retired']);

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ENTRY_HEADING = /^## (\d+)\.(.*)$/;
const ONLY_A_NAME = /^ `([^`]+)`$/;
const FIELD_LINE = /^- \*\*([^*]+?):\*\*(?: (.*))?$/;
const REFUSAL = /`([a-z][a-z0-9]*(?:-[a-z0-9]+)*)` \((\d{3})\)/g;
const CODE_FILE = /`src\/operations\/rules\/([^`/]+)\.js`/g;

/** A field's lines as its text: each line after the first loses up to two leading spaces, and blank ends go. */
function fieldText(lines) {
  const out = lines.map((l, i) => (i === 0 ? l : l.replace(/^ {1,2}/, '')).replace(/\s+$/, ''));
  while (out.length && !out[0]) out.shift();
  while (out.length && !out[out.length - 1]) out.pop();
  return out.join('\n');
}

/**
 * The rulebook's entries (Decision 3) → { entries: [{ number, name, fields, alsoSays }], problems: [{ rule, message }] }.
 * fields holds the eight fields by key, the first of each label; alsoSays the entry's other fields, in order.
 */
function parseRulebook(text) {
  const problems = [];
  const read = [];
  let entry = null;
  let field = null;

  const endField = () => {
    if (entry && field) entry.raw.push({ label: field.label, text: fieldText(field.lines) });
    field = null;
  };
  const endEntry = () => {
    endField();
    if (entry && !entry.broken) read.push(entry);
    entry = null;
  };

  for (const line of String(text).split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      endEntry();
      const heading = ENTRY_HEADING.exec(line);
      if (!heading) {
        // Another level-2 heading ends the entry before it, and isn't one. One that names a rule in backticks is a
        // mistyped entry's heading, which would otherwise drop the entry unseen (ADR 0041 Amendment 2.2).
        const named = /`([^`]+)`/.exec(line);
        if (named) problems.push({ rule: named[1], message: `The heading "${line}" names ${named[1]} in backticks, but it isn't an entry's heading, so no entry is made from it. An entry's heading is its number, a full stop and its rule's name in backticks, and nothing else: "## <n>. \`${named[1]}\`".` });
        continue;
      }
      const named = ONLY_A_NAME.exec(heading[2]);
      if (!named) {
        problems.push({ rule: null, message: `The heading "${line}" starts like an entry's, but an entry's heading is its number, a full stop and its rule's name in backticks, and nothing else: "## ${heading[1]}. \`<name>\`".` });
        entry = { broken: true };
        continue;
      }
      entry = { number: Number(heading[1]), name: named[1], raw: [], stray: false };
      continue;
    }
    const f = FIELD_LINE.exec(line);
    if (!entry) {
      // The preamble, or a level-2 section that isn't an entry: a field line here belongs to no entry.
      if (f) problems.push({ rule: null, message: `The line "${line.slice(0, 80)}" is a ${f[1].trim()} field outside any entry. A field belongs under an entry's heading, "## <n>. \`<name>\`".` });
      continue;
    }
    if (entry.broken) continue; // an entry whose heading can't be read, already a problem
    if (f) {
      endField();
      field = { label: f[1].trim(), lines: [f[2] || ''], closed: false };
    } else if (field) {
      if (field.closed) continue;
      if (!line.trim() || /^[ \t]/.test(line)) {
        field.lines.push(line);
      } else {
        // A field's text goes on only on blank or indented lines (ADR 0041 Amendment 2.2). The line joins nothing, and
        // the field takes no more lines until the next field or heading.
        problems.push({ rule: entry.name, message: `Entry ${entry.name} has a line after its ${field.label} field that isn't indented: "${line.trim().slice(0, 60)}". A field's text goes on only on lines indented below its bullet, and nothing but fields belongs in an entry.` });
        field.closed = true;
      }
    } else if (line.trim()) {
      entry.stray = true;
    }
  }
  endEntry();

  const numbers = new Map();
  read.forEach((e, i) => {
    const rule = e.name;
    if (!KEBAB.test(rule)) problems.push({ rule, message: `Entry ${e.number} names its rule "${rule}", which isn't kebab-case. A rule's name is lowercase words joined by hyphens, as its code file's is.` });
    if (e.number !== i + 1) problems.push({ rule, message: `Entry "${rule}" is numbered ${e.number}, but it is entry ${i + 1} in the file: numbers run 1, 2, 3… in file order.` });
    if (numbers.has(rule)) problems.push({ rule, message: `The name ${rule} heads entries ${numbers.get(rule)} and ${e.number}: each rule's name is its own.` });
    else numbers.set(rule, e.number);
    if (e.stray) problems.push({ rule, message: `Entry ${rule} has text before its first field. Every line of an entry belongs to a field: a bullet starting with its label in bold, and the lines below it.` });
    const counts = new Map();
    for (const r of e.raw) counts.set(r.label, (counts.get(r.label) || 0) + 1);
    for (const label of Object.keys(LABELS)) {
      if (!counts.has(label)) problems.push({ rule, message: `Entry ${rule} has no ${label} field. Every entry has the eight: ${Object.keys(LABELS).join(', ')}.` });
    }
    for (const [label, n] of counts) {
      if (n > 1) problems.push({ rule, message: `Entry ${rule} has its ${label} field ${n} times. A field appears once in an entry.` });
    }
  });

  const entries = read.map((e) => {
    const fields = {};
    const alsoSays = [];
    for (const r of e.raw) {
      const key = LABELS[r.label];
      if (key) { if (!(key in fields)) fields[key] = r.text; } else alsoSays.push({ label: r.label, text: r.text });
    }
    return { number: e.number, name: e.name, fields, alsoSays };
  });
  return { entries, problems };
}

/** Markdown as plain text: links, code spans and emphasis marks gone, white space single. */
function plain(md) {
  return String(md)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?=[^\w*]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** An abbreviation whose full stop ends no sentence, just before a full stop. */
const ABBREVIATION = /(?:^|[\s([])(?:e\.g|i\.e|cf|vs)$/i;

/**
 * The first sentence of a field, as plain text, its first letter capitalized (Decision 2's word.description). It ends
 * at a full stop, question mark or exclamation mark followed by white space and a capital letter, or by the end of the
 * text, and never at "e.g.", "i.e.", "cf." or "vs." (ADR 0041 Amendment 2.3).
 */
function firstSentence(md) {
  const text = plain(md);
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ends = /[.!?](?=\s+[A-Z]|\s*$)/g;
  let m;
  while ((m = ends.exec(text))) {
    if (m[0] === '.' && ABBREVIATION.test(text.slice(0, m.index))) continue;
    return capital(text.slice(0, m.index + 1));
  }
  return capital(text);
}

const titleOf = (name) => name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const withoutFullStop = (s) => String(s || '').replace(/\.$/, '');
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/** One entry's element JSON: its word wrapper (Decision 2), keys in the ADR's order. */
function elementJson(entry, { about, status, rule }) {
  const f = entry.fields;
  return {
    word: {
      slug: entry.name,
      name: entry.name,
      title: titleOf(entry.name),
      description: firstSentence(f.says || ''),
      wordTypes: ['word', 'graphRule'],
    },
    graphRule: {
      name: entry.name,
      number: entry.number,
      says: f.says || '',
      kind: f.kind || '',
      about,
      refusesOrReports: f.refusesOrReports || '',
      check: f.check || '',
      repair: f.repair || '',
      enforcedBy: f.enforcedBy || '',
      status,
      source: withoutFullStop(f.source),
      alsoSays: entry.alsoSays.map((a) => ({ label: a.label, text: a.text })),
      code: rule
        ? {
          file: `src/operations/rules/${entry.name}.js`,
          summary: rule.summary,
          refuses: rule.refuses,
          refusals: rule.refusals.map((r) => ({ code: r.code, status: r.status, when: r.when })),
        }
        : null,
    },
  };
}

/**
 * The items, and what keeps the rulebook and the code from drifting apart (Decision 5).
 *   entries       parseRulebook's
 *   rules         the loaded rules, loadRules().rules
 *   ruleFiles     the rule files in src/operations/rules/, by file name, index.js left out
 *   ruleProblems  the loader's problems, [{ file, problem }]
 * → { items: [{ name, json }], problems: [{ rule, message }] }
 */
function itemsFor({ entries = [], rules = [], ruleFiles = [], ruleProblems = [] } = {}) {
  const problems = [];
  const loaded = new Map(rules.map((r) => [r.name, r]));
  const files = new Set(ruleFiles.map((f) => String(f).replace(/\.js$/, '')));
  const named = new Set(entries.map((e) => e.name));

  for (const p of ruleProblems) {
    const name = path.basename(String((p && p.file) || ''), '.js') || null;
    problems.push({ rule: name, message: `The rules loader left out ${p && p.file}: ${p && p.problem}. Fix the file, so that its rule can be made into an item.` });
  }
  for (const name of [...files].sort()) {
    if (!named.has(name)) problems.push({ rule: name, message: `src/operations/rules/${name}.js has no entry in docs/GRAPH_RULES.md. Write its entry, "## <n>. \`${name}\`", before it merges (ADR graph-operations-foundation/0004 Decision 12).` });
  }

  const items = [];
  for (const e of entries) {
    const rule = e.name;
    const f = e.fields;
    const hasFile = files.has(rule);
    const code = loaded.get(rule) || null;

    const fileNamed = [...String(f.enforcedBy || '').matchAll(CODE_FILE)].map((m) => m[1]);
    for (const n of fileNamed) {
      if (n !== rule) problems.push({ rule, message: `Entry ${rule}'s Enforced by names src/operations/rules/${n}.js, but a rule's code file is named for it: src/operations/rules/${rule}.js.` });
      else if (!hasFile) problems.push({ rule, message: `Entry ${rule}'s Enforced by names src/operations/rules/${rule}.js, which isn't there.` });
    }
    if (hasFile && !fileNamed.includes(rule)) problems.push({ rule, message: `src/operations/rules/${rule}.js is there, but entry ${rule}'s Enforced by doesn't name it. Say where the code is: "The rule's code is in \`src/operations/rules/${rule}.js\`."` });

    const status = withoutFullStop(f.status).trim();
    if (!STATUSES.includes(status)) problems.push({ rule, message: `Entry ${rule}'s Status is "${f.status || ''}", but a rule is proposed, enforced or retired (ADR graph-rules/0001 Decision 6).` });
    else if (hasFile && status !== 'enforced') problems.push({ rule, message: `Entry ${rule} has code, src/operations/rules/${rule}.js, but its Status is ${status}. A rule with code is enforced.` });

    const kind = String(f.kind || '');
    const about = /^a graph rule\b/.test(kind) ? 'the graph' : /^a letter rule\b/.test(kind) ? 'events' : null;
    if (!about) problems.push({ rule, message: `Entry ${rule}'s Kind starts "${kind.slice(0, 40)}", but a Kind starts "a graph rule" or "a letter rule".` });

    if (code) {
      const listed = new Set([...String(f.refusesOrReports || '').matchAll(REFUSAL)].map((m) => `${m[1]} (${m[2]})`));
      const declared = new Set(code.refusals.map((r) => `${r.code} (${r.status})`));
      const show = (s) => (s.size ? [...s].join(', ') : 'none');
      if (code.refuses === false && listed.size) {
        problems.push({ rule, message: `Entry ${rule} lists refusals, ${show(listed)}, but its code only reports (refuses: false).` });
      } else if (code.refuses === true && !listed.size) {
        problems.push({ rule, message: `Entry ${rule}'s Refuses or reports lists no refusal, but its code refuses with ${show(declared)}. Write each as its code in backticks and its status in parentheses.` });
      } else if (!sameSet(listed, declared)) {
        problems.push({ rule, message: `Entry ${rule} lists the refusals ${show(listed)}, but its code refuses with ${show(declared)}.` });
      }
    }

    items.push({ name: rule, json: elementJson(e, { about, status, rule: code }) });
  }
  return { items, problems };
}

/** Each item's file: its name, and its JSON indented by two spaces with a newline (Decision 4). */
function elementFiles(items) {
  return items.map((it) => ({ file: `${it.name}.json`, text: `${JSON.stringify(it.json, null, 2)}\n` }));
}

/** The real rulebook and rules → { files, problems }. */
function make() {
  const { loadRules } = require('../operations/rules');
  const { rules, problems: ruleProblems } = loadRules();
  const ruleFiles = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.js') && f !== 'index.js').sort();
  const parsed = parseRulebook(fs.readFileSync(RULEBOOK, 'utf8'));
  const made = itemsFor({ entries: parsed.entries, rules, ruleFiles, ruleProblems });
  return { files: elementFiles(made.items), problems: [...parsed.problems, ...made.problems] };
}

/** Where the files go: the active firmware's graph-rule concept. */
function elementsDir() {
  const firmware = require('../api/normalize/firmware');
  return path.join(firmware.firmwareDir(), 'concepts/graph-rule/elements');
}

function main(argv) {
  const check = argv.includes('--check');
  const { files, problems } = make();
  if (problems.length) {
    console.error(`graph-rules: ${problems.length} problem(s) with docs/GRAPH_RULES.md and src/operations/rules/, so nothing was written:`);
    for (const p of problems) console.error(`  - ${p.rule ? `${p.rule}: ` : ''}${p.message}`);
    return 1;
  }
  const dir = elementsDir();
  const want = new Map(files.map((f) => [f.file, f.text]));
  const have = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  const changed = [...want.keys()].filter((f) => !have.includes(f) || fs.readFileSync(path.join(dir, f), 'utf8') !== want.get(f));
  const gone = have.filter((f) => !want.has(f));
  const where = path.relative(REPO, dir);

  if (check) {
    if (!changed.length && !gone.length) { console.log(`graph-rules: the ${files.length} items in ${where} are current.`); return 0; }
    console.error(`graph-rules: the items in ${where} are out of date. To write or change: ${changed.join(', ') || 'none'}. To remove: ${gone.join(', ') || 'none'}. Run \`node src/firmware/graph-rules.js\` and commit the folder.`);
    return 1;
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const f of changed) fs.writeFileSync(path.join(dir, f), want.get(f));
  for (const f of gone) fs.unlinkSync(path.join(dir, f));
  console.log(`graph-rules: ${files.length} items in ${where}; wrote ${changed.length ? changed.join(', ') : 'nothing'}, removed ${gone.length ? gone.join(', ') : 'nothing'}.`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { parseRulebook, itemsFor, elementFiles };
