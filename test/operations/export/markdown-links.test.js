'use strict';
/**
 * The markdown links helper, src/lib/markdownLinks.js — graph-rules/0002's one helper, which export nostr rewrites
 * tapestry: links with, and which renderers and the dead-link check will share. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/34-export-nostr.md (AC3: "found with a CommonMark
 *          parser", code spans and blocks left alone, reference definitions found)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md (Decision 7; Implementation notes)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md
 *
 * Unit tests, in-process: the helper parses text and opens nothing. Each test requires it itself, so while it doesn't
 * exist each test fails saying so. Its API, as Test Design pins it (the ADR's sketch, with the link and a name for an
 * autolink added):
 *   await findLinks(text) → [{ form, destination, start, end }]
 *     form: inline | image | autolink | definition | reference. For an inline link, an image, an autolink and a
 *     definition, start and end are the destination's offsets, so text.slice(start, end) is it as written (plainly,
 *     with no escape and no angle brackets); for a reference, the offsets of the reference itself
 *   await rewriteLinks(text, decide) → { text, links: [{ form, destination, action, to }] }
 *     decide(destination, link) is called for each destination that starts with tapestry:, and no other, and answers
 *     { to } (the destination becomes to), { drop: true, name } (the link becomes its text, an image its alt, a
 *     reference its text with its definition taken out, an autolink `name`, or nothing when name is left out) or null
 *     (left as it is); action is rewritten, dropped or kept for each tapestry: link
 *
 *   ML1  inline links and images are found, each form and destination, at the destination's offsets
 *   ML2  autolinks are found, at their offsets
 *   ML3  a reference definition, and the full, collapsed and shortcut references that use it, are found, each reference
 *        with the definition's destination
 *   ML4  none is found in a code span, a fenced code block or an indented one, nor where CommonMark sees no link (an
 *        escaped bracket, a space before the parenthesis), while a link beside them is
 *   ML5  a rewrite changes only each destination, every other byte as it was (a title, emphasis, a list, white space)
 *   ML6  a dropped inline link becomes its text, a dropped image its alt text
 *   ML7  a dropped reference becomes its text, and its definition is taken out
 *   ML8  a dropped autolink becomes the name decide gives, or nothing when it gives none
 *   ML9  only tapestry: destinations reach decide, with the link; null leaves a link as it is (kept); links in code never
 *        reach it
 */

const fs = require('fs');
const path = require('path');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, assert } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: export nostr — the markdown links helper');

const FILE = path.join(ROOT, 'src/lib/markdownLinks.js');
function helper() {
  if (!fs.existsSync(FILE)) throw new Error('src/lib/markdownLinks.js does not exist yet (ADR graph-operations-first-slice/0034 Decision 7: findLinks(text) and rewriteLinks(text, decide), with micromark 4)');
  const h = require(FILE);
  assert(typeof h.findLinks === 'function' && typeof h.rewriteLinks === 'function', `src/lib/markdownLinks.js exports findLinks and rewriteLinks; got ${show(Object.keys(h))}`);
  return h;
}

const K = (n) => `0000000${n}-aaaa-4bbb-8ccc-dddddddddddd`;
const T = (n) => `tapestry:${K(n)}`;
const forms = (links) => links.map((l) => `${l.form} ${l.destination}`).sort();
function atOffsets(text, links) {
  for (const l of links.filter((x) => x.form !== 'reference')) {
    assert(Number.isInteger(l.start) && Number.isInteger(l.end) && text.slice(l.start, l.end) === l.destination, `${l.form} ${l.destination}: text.slice(start, end) is its destination; got ${show([l.start, l.end, text.slice(l.start, l.end)])}`);
  }
}

test('ML1 [AC3, Decision 7]: inline links and images are found, each with its form and destination, at its offsets', async () => {
  const { findLinks } = helper();
  const text = `See [Rex](${T(1)}) and ![a dog](${T(2)}), and [the web](https://example.com/page).`;
  const links = await findLinks(text);
  assert(JSON.stringify(forms(links)) === JSON.stringify([`image ${T(2)}`, `inline ${T(1)}`, 'inline https://example.com/page'].sort()), `the two links and the image; got ${show(links)}`);
  atOffsets(text, links);
});

test('ML2 [AC3, Decision 7]: autolinks are found, at their offsets', async () => {
  const { findLinks } = helper();
  const text = `Here: <${T(3)}> and <https://example.com/x>.`;
  const links = await findLinks(text);
  assert(JSON.stringify(forms(links)) === JSON.stringify([`autolink ${T(3)}`, 'autolink https://example.com/x'].sort()), `both autolinks; got ${show(links)}`);
  atOffsets(text, links);
});

test('ML3 [AC3, Decision 7]: a reference definition is found, with the full, collapsed and shortcut references that use it', async () => {
  const { findLinks } = helper();
  const text = `Meet [Rex][r], [r][] and [r].\n\n[r]: ${T(4)}\n`;
  const links = await findLinks(text);
  const defs = links.filter((l) => l.form === 'definition');
  const refs = links.filter((l) => l.form === 'reference');
  assert(defs.length === 1 && defs[0].destination === T(4), `one definition, with its destination; got ${show(defs)}`);
  atOffsets(text, defs);
  assert(refs.length === 3 && refs.every((l) => l.destination === T(4) && l.start < l.end && /Rex|r/.test(text.slice(l.start, l.end))), `three references, each with the definition's destination and its own place in the text; got ${show(refs)}`);
});

test('ML4 [AC3, Decision 7]: none is found in a code span, a code block, or where CommonMark sees no link, while a link beside them is', async () => {
  const { findLinks } = helper();
  const text = [
    `Code \`[x](${T(5)})\` here.`,
    '',
    '```',
    `[y](${T(6)})`,
    '```',
    '',
    `    [z](${T(7)})`,
    '',
    `Escaped \\[e](${T(9)}) and spaced [s] (${T(9)}), and [real](${T(8)}).`,
    '',
  ].join('\n');
  const links = await findLinks(text);
  assert(JSON.stringify(forms(links)) === JSON.stringify([`inline ${T(8)}`]), `only the real link is found: none in code, none where CommonMark sees none; got ${show(links)}`);
});

test('ML5 [AC3, Decision 7]: a rewrite changes only each destination, every other byte as it was', async () => {
  const { rewriteLinks } = helper();
  const text = `  *See* [Rex](${T(1)} "his title")  and ![a dog](${T(2)})\n\n- item [web](https://example.com)\n- two\n`;
  const to = { [T(1)]: 'nostr:naddr1first', [T(2)]: 'nostr:naddr1second' };
  const out = await rewriteLinks(text, (d) => ({ to: to[d] }));
  const want = text.replace(T(1), to[T(1)]).replace(T(2), to[T(2)]);
  assert(out && out.text === want, `only the destinations changed; got ${show(out && out.text)} want ${show(want)}`);
  const rewritten = (out.links || []).filter((l) => l.action === 'rewritten');
  assert(JSON.stringify(rewritten.map((l) => `${l.destination}>${l.to}`).sort()) === JSON.stringify([`${T(1)}>${to[T(1)]}`, `${T(2)}>${to[T(2)]}`].sort()), `each rewrite is listed, with what it became; got ${show(out.links)}`);
});

test('ML6 [AC3, Decision 7]: a dropped inline link becomes its text, and a dropped image its alt text', async () => {
  const { rewriteLinks } = helper();
  const out = await rewriteLinks(`see [Rex the dog](${T(1)}) now, ![a dog](${T(2)}).`, () => ({ drop: true }));
  assert(out.text === 'see Rex the dog now, a dog.', `the link's text and the image's alt are kept; got ${show(out.text)}`);
  assert((out.links || []).filter((l) => l.action === 'dropped').length === 2, `both are listed dropped; got ${show(out.links)}`);
});

test('ML7 [AC3, Decision 7]: a dropped reference becomes its text, and its definition is taken out', async () => {
  const { rewriteLinks } = helper();
  const out = await rewriteLinks(`Meet [Rex][r] and [r].\n\n[r]: ${T(4)}\n\nThe end.\n`, () => ({ drop: true }));
  assert(out.text.startsWith('Meet Rex and r.') && out.text.includes('The end.'), `each reference becomes its text; got ${show(out.text)}`);
  assert(!out.text.includes('[r]:') && !out.text.includes('tapestry:'), `its definition is taken out; got ${show(out.text)}`);
});

test('ML8 [AC3, Decision 7]: a dropped autolink becomes the name decide gives, or nothing when it gives none', async () => {
  const { rewriteLinks } = helper();
  const named = await rewriteLinks(`<${T(3)}> is here`, () => ({ drop: true, name: 'Rex' }));
  assert(named.text === 'Rex is here', `the autolink becomes the name given; got ${show(named.text)}`);
  const unnamed = await rewriteLinks(`<${T(3)}> is here`, () => ({ drop: true }));
  assert(unnamed.text === ' is here', `with no name, it is taken out; got ${show(unnamed.text)}`);
});

test('ML9 [AC3, Decision 7]: only tapestry: destinations reach decide, with the link; null leaves a link as it is; links in code never reach it', async () => {
  const { rewriteLinks } = helper();
  const text = `[a](https://example.com) [b](${T(1)}) <${T(2)}> [c](nostr:naddr1zzz) \`[d](${T(9)})\``;
  const calls = [];
  const out = await rewriteLinks(text, (d, link) => {
    calls.push({ d, form: link && link.form });
    return d === T(2) ? { to: 'nostr:naddr1two' } : null;
  });
  assert(JSON.stringify(calls.map((c) => c.d).sort()) === JSON.stringify([T(1), T(2)].sort()), `decide is asked about the two tapestry: links only, never https:, nostr: or one in code; asked ${show(calls)}`);
  assert(calls.find((c) => c.d === T(1)).form === 'inline' && calls.find((c) => c.d === T(2)).form === 'autolink', `decide is given the link, with its form; got ${show(calls)}`);
  assert(out.text === text.replace(T(2), 'nostr:naddr1two'), `null left [b] as it was; only the autolink changed; got ${show(out.text)}`);
  const action = (d) => ((out.links || []).find((l) => l.destination === d) || {}).action;
  assert(action(T(1)) === 'kept' && action(T(2)) === 'rewritten', `the links say kept and rewritten; got ${show(out.links)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
