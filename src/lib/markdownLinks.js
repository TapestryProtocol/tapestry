'use strict';
/**
 * The links in a piece of markdown, found with a CommonMark parser (micromark 4), and rewritten in place — the one
 * helper graph-rules/0002 Decision 3 calls for, which export nostr uses for tapestry: links (story
 * graph-operations-first-slice #34, AC3; ADR graph-operations-first-slice/0034 Decision 7) and renderers and the
 * dead-link check can share.
 *
 *   await findLinks(text) → [{ form, destination, start, end }], in the order they stand in the text
 *     form         inline (a link with its destination in parentheses), image, autolink (<scheme:…>), definition
 *                  ([label]: destination) or reference (a full, collapsed or shortcut reference to a definition)
 *     destination  as written, with no angle brackets; a reference's is its definition's
 *     start, end   the destination's offsets, so text.slice(start, end) is it; a reference's are its own, the whole
 *                  [text][label]
 *   await rewriteLinks(text, decide) → { text, links: [{ form, destination, action, to }] }
 *     decide(destination, link) is asked about each inline link, image, autolink and definition whose destination
 *     starts with tapestry:, and no other; the references that use a definition follow its answer. It answers
 *       { to }              the destination becomes `to`, every other character as it was;
 *       { drop: true, name } the link goes and its text stays: an inline link becomes its text, an image its alt
 *                           text, a reference its text with its definition taken out, an autolink `name` (nothing
 *                           when it gives none);
 *       null                the link is left as it is.
 *     links lists each tapestry: link, rewritten, dropped or kept, with `to` for one rewritten.
 *
 * A link inside a code span or a code block is never one: CommonMark sees none there, and neither does this. micromark
 * marks each part of a link with its exact offsets in the text, so a rewrite changes only what it names. micromark is
 * an ES module, loaded once with import() and kept.
 */

const TAPESTRY = 'tapestry:';

let loading = null;
/** micromark's parse, preprocess and postprocess, imported once. */
function micromark() {
  if (!loading) loading = import('micromark').catch((err) => { loading = null; throw err; });
  return loading;
}

/** A label as CommonMark matches references to definitions: white space collapsed, trimmed, case folded. */
function identifier(label) {
  return String(label).replace(/[\t\n\r ]+/g, ' ').replace(/^ | $/g, '').toLowerCase().toUpperCase();
}

/**
 * Every link of `text`, with what a rewrite needs: { form, destination, start, end, whole: [start, end],
 * label: [start, end] | null, id (a definition's or a reference's identifier) }.
 */
async function scan(text) {
  const { parse, preprocess, postprocess } = await micromark();
  const events = postprocess(parse().document().write(preprocess()(String(text), undefined, true)));
  const slice = (t) => String(text).slice(t.start.offset, t.end.offset);
  const found = [];
  const definitions = [];
  const open = []; // the links and images being read, innermost last
  let autolink = null;
  let definition = null;
  for (const [kind, token] of events) {
    const type = token.type;
    if (kind === 'enter') {
      if (type === 'link' || type === 'image') {
        open.push({ image: type === 'image', whole: [token.start.offset, token.end.offset], label: null, destination: null, resource: false, reference: null });
      } else if (type === 'labelText' && open.length && !open[open.length - 1].label) {
        open[open.length - 1].label = [token.start.offset, token.end.offset];
      } else if (type === 'resource' && open.length) {
        open[open.length - 1].resource = true;
      } else if (type === 'resourceDestinationString' && open.length) {
        open[open.length - 1].destination = [token.start.offset, token.end.offset];
      } else if (type === 'referenceString' && open.length) {
        open[open.length - 1].reference = slice(token);
      } else if (type === 'autolink') {
        autolink = { whole: [token.start.offset, token.end.offset], destination: null };
      } else if (type === 'autolinkProtocol' && autolink) {
        autolink.destination = [token.start.offset, token.end.offset];
      } else if (type === 'definition') {
        definition = { whole: [token.start.offset, token.end.offset], id: null, destination: null };
      } else if (type === 'definitionLabelString' && definition) {
        definition.id = identifier(slice(token));
      } else if (type === 'definitionDestinationString' && definition) {
        definition.destination = [token.start.offset, token.end.offset];
      }
      continue;
    }
    if ((type === 'link' || type === 'image') && open.length) {
      const l = open.pop();
      const labelText = l.label ? String(text).slice(l.label[0], l.label[1]) : '';
      if (l.resource) {
        const d = l.destination || [l.whole[1], l.whole[1]];
        found.push({ form: l.image ? 'image' : 'inline', start: d[0], end: d[1], whole: l.whole, label: l.label || null, id: null });
      } else {
        found.push({ form: 'reference', start: l.whole[0], end: l.whole[1], whole: l.whole, label: l.label || null, id: identifier(l.reference !== null ? l.reference : labelText) });
      }
    } else if (type === 'autolink' && autolink) {
      if (autolink.destination) found.push({ form: 'autolink', start: autolink.destination[0], end: autolink.destination[1], whole: autolink.whole, label: null, id: null });
      autolink = null;
    } else if (type === 'definition' && definition) {
      if (definition.destination) {
        const d = { form: 'definition', start: definition.destination[0], end: definition.destination[1], whole: definition.whole, label: null, id: definition.id };
        found.push(d);
        definitions.push(d);
      }
      definition = null;
    }
  }
  // CommonMark: the first definition of a label is the one its references use.
  const byId = new Map();
  for (const d of definitions) if (!byId.has(d.id)) byId.set(d.id, d);
  const out = [];
  for (const l of found) {
    if (l.form === 'reference') {
      const d = byId.get(l.id);
      if (!d) continue;
      out.push({ ...l, destination: String(text).slice(d.start, d.end), definition: d });
    } else {
      out.push({ ...l, destination: String(text).slice(l.start, l.end) });
    }
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

const publicLink = (l) => ({ form: l.form, destination: l.destination, start: l.start, end: l.end });

async function findLinks(text) {
  return (await scan(text)).map(publicLink);
}

/** The end of a definition, with the line ending after it, so taking it out leaves no empty line of its own. */
function definitionEnd(text, end) {
  if (text.startsWith('\r\n', end)) return end + 2;
  if (text[end] === '\n' || text[end] === '\r') return end + 1;
  return end;
}

async function rewriteLinks(text, decide) {
  const source = String(text);
  const links = await scan(source);
  const answers = new Map(); // a definition (or any other link) → decide's answer
  const listed = [];
  const asked = (l) => {
    if (!answers.has(l)) {
      const a = decide(l.destination, publicLink(l));
      answers.set(l, a && typeof a === 'object' ? a : null);
    }
    return answers.get(l);
  };
  const edits = [];
  for (const l of links) {
    if (!l.destination.startsWith(TAPESTRY)) continue;
    const answer = l.form === 'reference' ? asked(l.definition) : asked(l);
    const to = answer && typeof answer.to === 'string' ? answer.to : null;
    const drop = !!(answer && answer.drop === true && to === null);
    listed.push({ form: l.form, destination: l.destination, action: to !== null ? 'rewritten' : drop ? 'dropped' : 'kept', ...(to !== null ? { to } : {}) });
    if (to !== null) {
      // A reference's destination is its definition's, which is rewritten once, for all of them.
      if (l.form !== 'reference') edits.push({ start: l.start, end: l.end, text: to });
    } else if (drop) {
      if (l.form === 'autolink') edits.push({ start: l.whole[0], end: l.whole[1], text: typeof answer.name === 'string' ? answer.name : '' });
      else if (l.form === 'definition') edits.push({ start: l.whole[0], end: definitionEnd(source, l.whole[1]), text: '' });
      else edits.push({ start: l.whole[0], end: l.whole[1], label: l.label });
    }
  }
  // Edits nest only as a link inside another's text does: each is applied from the outermost in.
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const render = (start, end) => {
    let out = '';
    let at = start;
    for (const e of edits) {
      if (e.start < at || e.start < start || e.end > end) continue;
      out += source.slice(at, e.start) + (e.label !== undefined ? (e.label ? render(e.label[0], e.label[1]) : '') : e.text);
      at = e.end;
    }
    return out + source.slice(at, end);
  };
  return { text: render(0, source.length), links: listed };
}

module.exports = { findLinks, rewriteLinks };
