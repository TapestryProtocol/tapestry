/**
 * The held removals (tagging-edges Story 4 AC-2 "Held removals"; ADR tagging-edges/0004 § UI "The held list"): the
 * latest pass's held list, a page at a time, why each was held, and the owner's confirmation as the status reports
 * it.
 *
 * Confirming them (tagging-edges Story 7; ADR tagging-edges/0007 D9, D10, D13, D15): "Confirm held removals" shows
 * once the held list is read and no pass runs, for the owner; an admin sees it disabled, with the reason beside it.
 * It opens an inline prompt that says only what the panel's snapshot held when it opened; "Confirm the removals"
 * sends it, and Cancel sends nothing. The confirmation and its state are the panel's (TaggingPipelinePanel.jsx
 * confirmHeld, through sendConfirm's 15 s race); this file only renders and asks. The answer's line shows until the
 * next Confirm is sent, and focus returns as parts.jsx useReturnFocus sets out. The server still decides who may.
 */

import { useEffect, useRef } from 'react';
import { Explained, Loading, ReadFailed, Section, TONE_COLOUR, counted, figure, useReturnFocus, when } from './parts.jsx';
import { TimedLine } from './PassControls.jsx';

/**
 * The owner's confirmation, in passView's five states. The server decides whether it has expired. A pending one is
 * claimed by the first pass to pass its start checks before it expires, and that pass may still not honour it
 * (validateClaim in reconcileTaggingEdges.js, OPERATIONS §12.8): the pass section says which. One that no pass carries
 * out (expired, unreadable, or with an expiry that cannot be read) can be replaced by confirming again (story 7 D13);
 * `listShown` is true where the section shows the latest pass's held list, which Confirm acts on.
 */
function ConfirmationLine({ confirmation, listShown = false }) {
  const c = confirmation;
  if (!c || c.state === 'none') return <p className="settings-hint">No confirmation from the owner is waiting.</p>;
  if (c.state === 'pending') {
    return (
      <p style={{ color: TONE_COLOUR.warn }}>
        The owner's confirmation of pass {c.runId} is pending until {when(c.expiresAt)}. The first pass to pass its
        start checks before then claims it, and the pass section then says whether that pass honoured it.
      </p>
    );
  }
  if (c.state === 'expired') {
    return (
      <p style={{ color: TONE_COLOUR.warn }}>
        The owner's confirmation of pass {c.runId} expired at {when(c.expiresAt)}. No pass will carry it out.
        {listShown && ' The owner can confirm this held list again.'}
      </p>
    );
  }
  if (c.state === 'unreadable') {
    return (
      <p style={{ color: TONE_COLOUR.bad }}>
        The owner's confirmation cannot be read. Code: <Explained kind="countCode" code={c.code} /> No pass carries it
        out. Confirming again replaces it.
      </p>
    );
  }
  return (
    <p style={{ color: TONE_COLOUR.warn }}>
      The owner's confirmation of pass {c.runId} is waiting, but its expiry time cannot be read. No pass carries it
      out. Confirming again replaces it.
    </p>
  );
}

/** The prompt's line for when the removals happen (D10 item 2), by confirmView's `when` as the prompt opened on it. */
const WHEN_TEXT = Object.freeze({
  'lines-up': 'Confirming lines up a pass now, which carries them out.',
  'waiting-pass': 'A pass is already waiting. It takes this confirmation up, and nothing new is lined up.',
  'cannot-tell': 'The panel cannot tell whether a pass is waiting, so it cannot tell whether one will be lined up now. The answer will say what happened.',
});

/**
 * The Confirm prompt (ADR 0007 D10, story 5's and 6's pattern): a heading naming how many removals and which pass, when
 * they happen, that it covers this held list once and lapses after 24 hours, that a removal cannot be undone from the
 * panel, and, when the panel showed one no pass will carry out, that this one replaces it; then "Confirm the removals"
 * and "Cancel". It says only what `snapshot` (confirmView's, taken when it opened) holds. Focus moves to Cancel when it
 * opens, through an effect, with no timer; its send moves focus to the heading first (D15), and while it is under way
 * it stays open, both buttons disabled.
 */
function ConfirmPrompt({ snapshot, pending, onConfirm, onCancel }) {
  const cancel = useRef(null);
  const heading = useRef(null);
  useEffect(() => {
    const target = pending ? heading.current : cancel.current;
    if (target) target.focus();
  }, []);
  const send = () => {
    if (heading.current) heading.current.focus();
    onConfirm();
  };
  return (
    <div className="settings-group" style={{ borderColor: TONE_COLOUR.warn }}>
      <h4 ref={heading} tabIndex={-1}>
        Confirm the {counted(snapshot.count, 'held removal', 'held removals')} of pass {snapshot.runId}?
      </h4>
      <p>{WHEN_TEXT[snapshot.when] || WHEN_TEXT['cannot-tell']}</p>
      <p>The confirmation covers this held list once. If no pass takes it up within 24 hours, it lapses.</p>
      <p>
        A removal cannot be undone from the panel. A removed relationship comes back only if its tagging is on the
        relay again; then the real-time path, while it is on, or a later pass adds it back.
      </p>
      {snapshot.replaces && <p>This replaces the earlier confirmation, which no pass will carry out.</p>}
      <p>
        <button className="btn-small" disabled={pending} aria-busy={pending ? 'true' : undefined} onClick={send}>
          {pending ? 'Confirming…' : 'Confirm the removals'}
        </button>{' '}
        <button className="btn-small" ref={cancel} disabled={pending} onClick={onCancel}>Cancel</button>
      </p>
    </div>
  );
}

/** What the last confirmation's answer meant (confirmOutcome's line), and the refusal's HTTP status or code and cause. */
function ConfirmAnswer({ outcome, lineRef }) {
  return (
    <p ref={lineRef} tabIndex={-1} style={{ color: TONE_COLOUR[outcome.tone] }}>
      <TimedLine line={outcome} />
      {outcome.outcome === 'refused' && outcome.httpStatus !== null && ` HTTP status: ${outcome.httpStatus}.`}
      {outcome.code && <> Code: <code>{outcome.code}</code></>}
      {outcome.cause && <> Cause: <code>{outcome.cause}</code></>}
    </p>
  );
}

/**
 * A confirmation the latest pass used up before it failed or was stopped (D13): the removals it did not apply can be
 * confirmed again only once a later pass holds them again.
 */
function UsedUpLine({ latest }) {
  return (
    <p style={{ color: TONE_COLOUR.warn }}>
      The latest pass, {String(latest.runId)}, took up the owner's confirmation and then
      {latest.outcome === 'stopped' ? ' was stopped' : ' failed'}, so it used the confirmation up. The removals it did
      not apply can be confirmed again only once a later pass holds them again: Run a pass now, or the next scheduled
      pass.
    </p>
  );
}

function HeldPage({ runId, heldTotal, page, onPage }) {
  const items = page.items;
  const first = items.length ? page.offset + 1 : page.offset;
  const reasons = [...new Set(items.map((it) => it.reason))];
  return (
    <div>
      <p>
        Showing {figure(first)} to {figure(page.offset + items.length)} of {figure(page.total)} for pass {runId}.
      </p>
      <ul>
        {items.map((it) => (
          <li key={it.address}><code>{it.address}</code> <code>{String(it.reason)}</code></li>
        ))}
      </ul>
      {reasons.length > 0 && (
        <div className="settings-hint">
          <p>Why these were held:</p>
          <ul>
            {reasons.map((r) => <li key={String(r)}><Explained kind="heldReason" code={r} /></li>)}
          </ul>
        </div>
      )}
      <button className="btn-small" disabled={page.offset === 0} onClick={() => onPage(page.offset - page.limit)}>
        Previous
      </button>{' '}
      <button
        className="btn-small"
        disabled={page.offset + items.length >= page.total}
        onClick={() => onPage(page.offset + page.limit)}
      >
        Next
      </button>
      {page.total !== heldTotal && (
        <p className="settings-hint">
          The report counts {counted(heldTotal, 'held removal', 'held removals')}, and the list on the data volume
          holds {figure(page.total)}.
        </p>
      )}
    </div>
  );
}

/**
 * `pass` is passView of the status body, or null before a good answer. `reportFailed` is true when the status read
 * has failed with no good answer before it. `runId` is the latest pass's run id when it holds removals and no pass
 * runs, else null. `held` is the list's read: { runId, offset, state, page, error }. Story 7: `role` is the viewer's
 * ('owner', 'admin' or null); `confirmable` is confirmView of the status, the list and `runId`, or null; `confirm` is
 * the panel's { snapshot, pending, outcome }; `onAskConfirm()` opens the prompt, `onCancelConfirm()` closes it, and
 * `onConfirm()` sends the confirmation it shows.
 */
export default function HeldSection({
  pass, reportFailed, runId, held, onPage, onRetry, role, confirmable, confirm, onAskConfirm, onConfirm, onCancelConfirm,
}) {
  const title = 'Held removals';
  const focus = useReturnFocus(!!confirm.snapshot);
  if (!pass && reportFailed) {
    // Its own read has not failed, so the section is not 'error': it waits on the pass report.
    return (
      <Section testId="tp-held" state="loading" title={title} headingRef={focus.heading}>
        <p className="settings-hint">The held list waits for the pass report, which could not be read.</p>
      </Section>
    );
  }
  if (!pass) {
    return (
      <Section testId="tp-held" state="loading" title={title} headingRef={focus.heading}>
        <Loading what="the held list, once the pass report is in" />
      </Section>
    );
  }
  const confirmation = <ConfirmationLine confirmation={pass.confirmation} />;
  // The prompt stays wherever the section is while its confirmation is under way (D10 "never while under way"); the
  // panel closes it otherwise once a read makes Confirm unavailable. The answer's line shows in every branch.
  const prompt = confirm.snapshot && (
    <ConfirmPrompt
      snapshot={confirm.snapshot}
      pending={confirm.pending}
      onConfirm={onConfirm}
      onCancel={() => { focus.cancelled(); onCancelConfirm(); }}
    />
  );
  const answer = confirm.outcome && !confirm.pending && (
    <ConfirmAnswer outcome={confirm.outcome} lineRef={focus.line} />
  );
  if (pass.running) {
    return (
      <Section testId="tp-held" state="empty" title={title} headingRef={focus.heading}>
        <p>A pass is running. The held list returns when it ends.</p>
        {pass.confirmation.state !== 'none' && confirmation}
        {prompt}
        {answer}
      </Section>
    );
  }
  if (!runId) {
    return (
      <Section testId="tp-held" state="empty" title={title} headingRef={focus.heading}>
        <p>{pass.latest ? 'The latest pass held no removals.' : 'No pass has run, so nothing is held.'}</p>
        {pass.confirmation.state !== 'none' && confirmation}
        {confirmable && confirmable.usedUp && <UsedUpLine latest={pass.latest} />}
        {prompt}
        {answer}
      </Section>
    );
  }

  const heldTotal = pass.latest.held.total;
  // Until the list of this run id has answered, the section is loading (a restart after a newer pass included).
  const state = held.runId === runId ? held.state : 'loading';
  // D9: the owner's Confirm, or an admin's disabled one with the reason beside it, exactly when confirmView offers it.
  const offered = state === 'ready' && !!confirmable && confirmable.offer && (role === 'owner' || role === 'admin');
  const control = !prompt && offered && (
    <p>
      <button
        className="btn-small"
        ref={focus.opener}
        disabled={role !== 'owner'}
        onClick={role === 'owner' ? onAskConfirm : undefined}
      >
        Confirm held removals
      </button>
      {role !== 'owner' && ' Only the owner can confirm held removals.'}
    </p>
  );
  return (
    <Section testId="tp-held" state={state} title={title} tone="warn" headingRef={focus.heading}>
      <p>The latest pass, {runId}, held {counted(heldTotal, 'removal', 'removals')} for the owner to confirm.</p>
      <ConfirmationLine confirmation={pass.confirmation} listShown />
      {prompt}
      {control}
      {answer}
      {state === 'loading' && <Loading what="the held list" />}
      {state === 'error' && <ReadFailed what="The held list" error={held.error} onRetry={onRetry} />}
      {state === 'ready' && <HeldPage runId={runId} heldTotal={heldTotal} page={held.page} onPage={onPage} />}
    </Section>
  );
}
