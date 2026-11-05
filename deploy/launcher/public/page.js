'use strict';
(function launcherPage() {
  const POLL_MS = 3000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const $ = (id) => document.getElementById(id);

  let me = null;
  const openDetails = new Map(); // slug -> the signed detail, once the owner has asked for it
  let pollTimer = null;

  function element(tag, props = {}, ...children) {
    const el = Object.assign(document.createElement(tag), props);
    el.append(...children);
    return el;
  }

  async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function toBase64(text) {
    return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
  }

  /** Every call but the status read is signed for its exact URL and method, with the hash of its body. */
  async function signedFetch(method, path, body) {
    const text = body === undefined ? undefined : JSON.stringify(body);
    const tags = [['u', `${location.origin}${path}`], ['method', method]];
    if (text !== undefined) tags.push(['payload', await sha256Hex(text)]);
    const event = await window.nostr.signEvent({ kind: 27235, created_at: Math.floor(Date.now() / 1000), tags, content: '' });
    const res = await fetch(path, {
      method,
      headers: { authorization: `Nostr ${toBase64(JSON.stringify(event))}`, ...(text ? { 'content-type': 'application/json' } : {}) },
      body: text,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  function daysLeft(reapAfter) {
    return Math.max(0, Math.ceil((Date.parse(reapAfter) - Date.now()) / DAY_MS));
  }

  function statusWords(b) {
    if (b.queued) return 'queued, waiting for another brain to finish';
    if (b.phase) return b.phase;
    if (b.status === 'stopped') {
      const n = daysLeft(b.reapAfter);
      return `stopped. Restore within ${n} ${n === 1 ? 'day' : 'days'}, or its data is deleted`;
    }
    return b.status;
  }

  function isBusy(b) {
    return b.queued || Boolean(b.phase) || b.status === 'creating';
  }

  async function act(slug, run) {
    $('launch-error').textContent = '';
    const { status, json } = await run();
    if (status >= 400) {
      $('launch-error').textContent = json.message || 'That did not work.';
    }
    openDetails.delete(slug);
    await refresh();
  }

  function button(label, onClick) {
    return element('button', { type: 'button', textContent: label, onclick: onClick });
  }

  function detailPanel(d) {
    const rows = [
      ['Image', d.imageTag],
      ['Neo4j', d.url ? `${d.url}/browser/` : ''],
      ['Neo4j connect URL', d.url ? `bolt+s://${new URL(d.url).host}:443` : ''],
      ['Neo4j user', 'neo4j'],
      ['Neo4j password', d.neo4jPassword],
    ];
    if (d.lastError) rows.unshift(['Last error', d.lastError]);
    const list = element('dl');
    for (const [k, v] of rows) list.append(element('dt', { textContent: k }), element('dd', { textContent: v }));
    return element('div', { className: 'detail' }, list, element('pre', { textContent: d.logTail || 'No log yet.' }));
  }

  function brainRow(b) {
    const mine = b.ownerPubkey === me;
    const name = b.status === 'running'
      ? element('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer', className: 'brain-name', textContent: new URL(b.url).host })
      : element('span', { className: 'brain-name', textContent: new URL(b.url).host });
    const row = element('li', { className: 'brain' }, element('div', { className: 'brain-head' },
      name,
      element('span', { className: 'muted', textContent: mine ? 'yours' : b.ownerLabel }),
      element('span', { className: 'status', textContent: statusWords(b) })));

    if (!mine) return row;

    const actions = element('div', { className: 'actions' });
    if (!isBusy(b)) {
      if (b.status === 'running') {
        actions.append(button('Destroy', () => {
          if (window.confirm(`Destroy ${b.slug}? Its containers go. Its data is kept for 7 days, and you can restore it until then.`)) {
            act(b.slug, () => signedFetch('DELETE', `/api/brains/${b.slug}`));
          }
        }));
      }
      if (b.status === 'failed') {
        actions.append(
          button('Retry', () => act(b.slug, () => signedFetch('POST', '/api/brains', { slug: b.slug }))),
          button('Destroy', () => {
            if (window.confirm(`Destroy ${b.slug}?`)) act(b.slug, () => signedFetch('DELETE', `/api/brains/${b.slug}`));
          }),
        );
      }
      if (b.status === 'stopped') {
        actions.append(
          button('Restore', () => act(b.slug, () => signedFetch('POST', `/api/brains/${b.slug}/restore`))),
          button('Start fresh', () => {
            const typed = window.prompt(`Start fresh deletes the data ${b.slug} still holds, for good, and launches it again blank. Type ${b.slug} to go ahead.`);
            if (typed === b.slug) act(b.slug, () => signedFetch('POST', `/api/brains/${b.slug}/fresh`));
          }),
        );
      }
    }
    const shown = openDetails.get(b.slug);
    actions.append(button(shown ? 'Hide details' : 'Details and log', async () => {
      if (openDetails.has(b.slug)) {
        openDetails.delete(b.slug);
      } else {
        const { status, json } = await signedFetch('GET', `/api/brains/${b.slug}`);
        if (status === 200) openDetails.set(b.slug, json);
      }
      render();
    }));
    row.append(actions);
    if (shown) row.append(detailPanel(shown));
    return row;
  }

  let brains = [];

  function render() {
    $('brains').replaceChildren(...brains.map(brainRow));
    $('no-brains').hidden = brains.length > 0;
  }

  /** Busy brains are watched with the unsigned status read, so a create does not ask for a signature every few seconds. */
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (!brains.some(isBusy)) return;
    pollTimer = setTimeout(async () => {
      let settled = false;
      await Promise.all(brains.filter(isBusy).map(async (b) => {
        const res = await fetch(`/api/brains/${b.slug}/status`, { cache: 'no-store' });
        if (!res.ok) { settled = true; return; }
        const next = await res.json();
        Object.assign(b, { status: next.status, phase: next.phase, queued: next.queued });
        if (!isBusy(b)) settled = true;
      }));
      if (settled) {
        await refresh();
      } else {
        render();
        schedulePoll();
      }
    }, POLL_MS);
  }

  async function refresh() {
    const { status, json } = await signedFetch('GET', '/api/brains');
    if (status === 403) {
      $('signed-out').hidden = true;
      $('not-listed').hidden = false;
      return;
    }
    if (status !== 200) {
      $('signed-out').hidden = false;
      $('signed-in').hidden = true;
      $('sign-in-error').textContent = json.message || 'That did not work. Try again.';
      return;
    }
    brains = json.brains;
    $('signed-out').hidden = true;
    $('signed-in').hidden = false;
    $('domain').textContent = `.${location.host}`;
    render();
    schedulePoll();
  }

  $('sign-in').addEventListener('click', async () => {
    $('sign-in-error').textContent = '';
    if (!window.nostr) {
      $('sign-in-error').textContent = 'No nostr extension found. Install one, such as Alby or nos2x, and reload this page.';
      return;
    }
    try {
      me = await window.nostr.getPublicKey();
      await refresh();
    } catch (err) {
      $('sign-in-error').textContent = 'The extension did not sign. Try again.';
    }
  });

  $('launch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const slug = $('slug').value.trim();
    const submit = e.target.querySelector('button');
    submit.disabled = true;
    try {
      const { status, json } = await signedFetch('POST', '/api/brains', { slug });
      if (status >= 400) {
        $('launch-error').textContent = json.message || 'That did not work.';
      } else {
        $('launch-error').textContent = '';
        $('slug').value = '';
        await refresh();
      }
    } catch {
      $('launch-error').textContent = 'The extension did not sign. Try again.';
    } finally {
      submit.disabled = false;
    }
  });
}());
