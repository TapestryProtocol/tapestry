/**
 * The reading views' one data source and their shared state, as `window.Brain` — the global the
 * boards' logic reads (the same surface the brainstorm-harness's reading/brain.js gives them there).
 *
 * Brain.api(verb, params) answers one question (readVerbs.js: scopes, scope, node, group, search,
 * path, community) and merges the document into one cache; nothing asks for the whole graph.
 * Brain.doc() is that cache in the shape the boards' prep(d) reads ({nodes, links, link_types}), and
 * Brain.on('change') fires after every merge.
 *
 * Shared state, for everything above a single view (the page's bar): Brain.state.scope
 * (Brain.set('scope', key) fires 'scope'), and Brain.emit('go', id) from jump-to-anything, which the
 * open view answers.
 */
import { VERBS } from './readVerbs';

export function createBrain() {
  const N = {}, L = {}, LT = {}, subs = {}, inflight = {}, done = {};
  const state = { scope: null, scopes: [], instance: null };
  let snap = null, version = 0, config = { taPubkey: null, ownerPubkey: null };
  let ready, setReady;
  ready = new Promise((r) => { setReady = r; });

  function on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return () => { subs[ev] = (subs[ev] || []).filter((f) => f !== fn); }; }
  function emit(ev, x) { (subs[ev] || []).slice().forEach((f) => { try { f(x); } catch (e) { console.error(e); } }); }
  function set(k, v) { if (state[k] === v) return; state[k] = v; emit(k, v); }

  /** The instance's Tapestry Assistant decides whose things are "ours": the page hands it over once ConfigContext has it. */
  function configure(c) {
    config = { ...config, ...c };
    if (config.taPubkey) setReady();
  }

  // a node seen in several documents keeps its best scope and every answer any of them gave
  function merge(doc) {
    (doc.link_types || []).forEach((t) => { LT[t.type] = t; });
    (doc.nodes || []).forEach((n) => {
      const o = N[n.id];
      if (!o) { N[n.id] = n; return; }
      N[n.id] = { ...o, ...n, part: n.part === 'structure' && o.part !== 'structure' ? o.part : n.part, answers: { ...o.answers, ...n.answers } };
    });
    (doc.links || []).forEach((l) => { L[l.from + '|' + l.type + '|' + l.to] = l; });
    snap = null; version++;
    emit('change', version);
  }

  function doc() {
    if (!snap) snap = { nodes: Object.values(N), links: Object.values(L), link_types: Object.values(LT), version };
    return snap;
  }

  // The same question in flight is shared; an answer is reused for a minute (the community document,
  // which reads two relays, for five), then asked again: the instance may have changed. {fresh} asks now.
  function api(verb, params = {}) {
    const { fresh, ...p } = params || {};
    const key = verb + ' ' + JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]));
    const ttl = verb === 'community' ? 300000 : 60000;
    if (!fresh && done[key] && Date.now() - done[key].at < ttl) return Promise.resolve(done[key].doc);
    if (fresh) delete inflight[key];
    if (!inflight[key]) {
      const fn = VERBS[verb];
      if (!fn) return Promise.reject(new Error('no read verb ' + verb));
      emit('busy', Object.keys(inflight).length + 1);
      inflight[key] = ready.then(() => fn(p, config.taPubkey, config)).then((d) => {
        delete inflight[key]; emit('busy', Object.keys(inflight).length);
        if (verb === 'community') d.read_at = Math.floor(Date.now() / 1000);
        done[key] = { doc: d, at: Date.now() };
        merge(d);
        return d;
      }).catch((e) => {
        delete inflight[key]; emit('busy', Object.keys(inflight).length);
        emit('error', verb + ': ' + (e.message || e));
        throw e;
      });
    }
    return inflight[key];
  }

  // fn now and after every merge, at most once a frame
  function watch(fn) {
    let queued = false;
    const off = on('change', () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fn(); }); });
    fn();
    return off;
  }

  return { api, merge, doc, on, emit, set, watch, state, configure, node: (id) => N[id], has: (id) => !!N[id], live: true };
}
