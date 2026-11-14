'use strict';
/**
 * The graph's rules, each defined once, one file each: src/operations/rules/<name>.js (story
 * graph-operations-foundation #4, ADR graph-operations-foundation/0004 Decision 4; design D3). The rules document,
 * docs/GRAPH_RULES.md, says what each one holds.
 *
 * A rule is a plain object:
 *   name        its file's name
 *   summary     one line: what it holds
 *   refuses     true for a guard that refuses a write; false for one that only reports (design §5, question 3)
 *   refusals    [{ code, status (4xx), when }]: what a write that breaks it is refused with
 *   violations  async (items, read) => [{ item, code, message }] — the rule's one definition. The write path calls it
 *               as a guard, with the write's items and its transaction's read; rules check (A10.31) will call it as a
 *               check, with a read session and the items it scans.
 *
 * The loader reads the folder once. A rule that breaks a rule above is left out and reported, and a guard that names
 * it makes its declaration invalid. Loading opens nothing (ADR graph-operations-foundation/0001 Decision 10): a rule
 * requires what it reads when violations() runs.
 */

const fs = require('fs');
const path = require('path');

const FILE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.js$/;
const CODE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
let loaded = null;

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Every rule `rule`, found in `<name>.js`, breaks, as sentences. */
function problemsOf(rule, name) {
  if (!isObject(rule)) return ['the file does not export a rule object'];
  const problems = [];
  if (rule.name !== name) problems.push(`its name ${JSON.stringify(rule.name)} must be ${JSON.stringify(name)}, the file's name`);
  if (typeof rule.summary !== 'string' || !rule.summary.trim()) problems.push('it has no summary');
  if (typeof rule.refuses !== 'boolean') problems.push('refuses must be true (it refuses a write) or false (it only reports)');
  if (!Array.isArray(rule.refusals)) problems.push('its refusals must be a list of { code, status, when }');
  else {
    for (const r of rule.refusals) {
      if (!isObject(r) || !CODE.test(String(r.code))) { problems.push(`a refusal's code ${JSON.stringify(r && r.code)} must be kebab-case`); continue; }
      if (!Number.isInteger(r.status) || r.status < 400 || r.status > 499) problems.push(`its refusal '${r.code}' must have a 4xx status`);
      if (typeof r.when !== 'string' || !r.when.trim()) problems.push(`its refusal '${r.code}' must say when it happens`);
    }
  }
  if (typeof rule.violations !== 'function') problems.push('it has no violations(items, read)');
  return problems;
}

/** Load the rules, once. → { rules, problems: [{ file, problem }] } */
function loadRules() {
  if (loaded) return loaded;
  const rules = [];
  const problems = [];
  for (const f of fs.readdirSync(__dirname).sort()) {
    if (f === 'index.js' || !FILE.test(f)) continue;
    const name = f.slice(0, -3);
    let rule;
    try {
      rule = require(path.join(__dirname, f));
    } catch (e) {
      problems.push({ file: `rules/${f}`, problem: `it failed to load: ${String((e && e.message) || e).split('\n')[0]}` });
      continue;
    }
    const issues = problemsOf(rule, name);
    if (issues.length) { problems.push({ file: `rules/${f}`, problem: issues.join('; ') }); continue; }
    rules.push(rule);
  }
  for (const p of problems) console.warn(`[operations] left out ${p.file}: ${p.problem}`);
  loaded = Object.freeze({ rules: Object.freeze(rules), problems: Object.freeze(problems) });
  return loaded;
}

/** The rule named `name`, or null. */
function findRule(name) {
  return loadRules().rules.find((r) => r.name === name) || null;
}

module.exports = { loadRules, findRule };
