/**
 * The Tagging pipeline panel's shared pieces (tagging-edges Story 4 / ADR tagging-edges/0004 § UI): the section
 * frame with its data-testid / data-state hooks, the loading sentence over a static skeleton, a failed read with
 * Retry, a code shown with its explanation, and the formatters every section uses. Story 7 (ADR tagging-edges/0007
 * D15) adds where focus goes when one of the panel's prompts closes (useReturnFocus) and the section heading it can
 * land on.
 *
 * Colours come only from the eight status tokens, spacing only from the existing classes and the browser's
 * defaults: no length in an inline style, and nothing added to styles.css.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { explain } from '../../../utils/taggingPipelineView.js';

/** The view module's tones as design tokens. A state colour goes on text and borders, never on a background. */
export const TONE_COLOUR = Object.freeze({
  ok: 'var(--green)',
  warn: 'var(--orange)',
  bad: 'var(--red)',
  neutral: 'var(--text)',
});

/** A value the path has never produced (T9). Never 0. */
export const NOT_YET = 'not yet available';

/** A time as the viewer's locale prints it. */
export function when(iso) {
  if (typeof iso !== 'string' || iso === '') return 'not recorded';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** A whole figure, with the locale's thousands separator. `missing` is what a figure the status lacks reads. */
export function figure(n, missing = 'not recorded') {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString() : missing;
}

/** How long something took: tenths of a second under 10 s, then whole seconds, then minutes and seconds. */
export function took(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return 'an unrecorded time';
  if (ms < 10000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

/** Plural helper for counted nouns: "1 entry", "2 entries". `missing` is what a figure the status lacks reads. */
export function counted(n, one, many, missing = 'not recorded') {
  return `${figure(n, missing)} ${n === 1 ? one : many}`;
}

/**
 * A code as it is, with the sentence that explains it, or "not recognised" beside a code the panel does not know
 * (story "Explanations"; T6). A missing code reads "none".
 */
export function Explained({ kind, code }) {
  if (code === null || code === undefined) return <span>none</span>;
  const e = explain(kind, code);
  return (
    <span>
      <code>{String(e.code)}</code>
      {e.recognised ? `. ${e.text}` : ` (${e.text})`}
    </span>
  );
}

/**
 * One of the panel's five sections. A warning or failure colours its border; the background stays neutral. With a
 * `headingRef`, its heading can take focus when a prompt in it closes (ADR 0007 D15), but is never in the tab order.
 */
export function Section({ testId, state, title, tone, headingRef, children }) {
  const border = state === 'error' ? 'bad' : tone;
  return (
    <div
      className="settings-group"
      data-testid={testId}
      data-state={state}
      style={border === 'warn' || border === 'bad' ? { borderColor: TONE_COLOUR[border] } : undefined}
    >
      <h3 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h3>
      {children}
    </div>
  );
}

/**
 * Whether focus went with a prompt that has just closed: it is on the page itself, where it falls when the element
 * holding it is removed. Read once the prompt has gone, "focus was inside the prompt, or on the page" (ADR 0007 D15
 * `wasInside`) reads as this.
 */
function focusLost() {
  const a = typeof document === 'undefined' ? null : document.activeElement;
  return !a || a === document.body || a === document.documentElement;
}

/**
 * Where focus goes when one of the panel's prompts closes (story 7 AC-6; ADR 0007 D15), for Turn off, Stop and
 * Confirm. `open` is whether the owner's prompt is open; `headingRef`, when given, is the section heading's ref, held
 * by the parent that renders the Section. → { closed(how, wasInside), cancelled(), opener, line, heading }: the owner
 * puts `opener` on the control that opens the prompt, `line` on the line that says what happened, and `heading` on the
 * section's heading, and calls cancelled() from the prompt's Cancel. When `open` turns false the helper calls
 * closed('cancel' after cancelled(), else 'other'; wasInside as focusLost reads it), and after the next render:
 * - 'cancel' focuses the opener, when it is shown and enabled;
 * - otherwise, or when the opener is gone, the outcome line when shown, else the section's heading. Focus left on the
 *   heading moves to the outcome line when that line appears (Turn off closes before its answer comes).
 * It does nothing when wasInside is false, so a prompt that closes by itself never takes focus from elsewhere. Turn
 * on and Run a pass now are never an opener or a target. Effects only: no timer.
 */
export function useReturnFocus(open, headingRef) {
  const opener = useRef(null);
  const line = useRef(null);
  const ownHeading = useRef(null);
  const heading = headingRef || ownHeading;
  const [asked, setAsked] = useState(null);
  const onHeading = useRef(false);
  const wasOpen = useRef(open);
  const how = useRef('other');
  useEffect(() => {
    if (!asked) return;
    setAsked(null);
    const usable = (el) => !!el && el.isConnected && !el.disabled;
    onHeading.current = false;
    if (asked.how === 'cancel' && usable(opener.current)) opener.current.focus();
    else if (usable(line.current)) line.current.focus();
    else if (usable(heading.current)) {
      heading.current.focus();
      onHeading.current = true;
    }
  }, [asked, heading]);
  useEffect(() => {
    if (!onHeading.current) return;
    if (document.activeElement !== heading.current) onHeading.current = false;
    else if (line.current && line.current.isConnected) {
      line.current.focus();
      onHeading.current = false;
    }
  });
  const closed = useCallback((closedHow, wasInside) => {
    if (wasInside) setAsked({ how: closedHow });
  }, []);
  useEffect(() => {
    if (wasOpen.current && !open) {
      closed(how.current, focusLost());
      how.current = 'other';
    }
    wasOpen.current = open;
  }, [open, closed]);
  const cancelled = useCallback(() => { how.current = 'cancel'; }, []);
  return { closed, cancelled, opener, line, heading };
}

/**
 * What a section is loading, above a static skeleton: placeholder bars as token-coloured blocks, each holding a
 * non-breaking space so it is a line of text high (a block holding only collapsible whitespace has no height), with
 * no animation (ADR 0004 § UI "Loading").
 */
export function Loading({ what }) {
  return (
    <div>
      <p className="settings-hint">Loading {what}.</p>
      <div aria-hidden="true">
        <p style={{ background: 'var(--bg-tertiary)' }}>{'\u00a0'}</p>
        <p style={{ background: 'var(--bg-tertiary)' }}>{'\u00a0'}</p>
      </div>
    </div>
  );
}

/**
 * A read that failed: it names the read, shows the failure's code through explain, and offers Retry. When a good
 * answer came before, the figures below it are that answer's, labelled with the time it was read.
 */
export function ReadFailed({ what, error, readAt, onRetry }) {
  return (
    <div>
      <p style={{ color: TONE_COLOUR.bad }}>
        {what} could not be read. Code: <Explained kind="fetchCode" code={error ? error.code : null} />
      </p>
      <button className="btn-small" onClick={onRetry}>Retry</button>
      {readAt && <p className="settings-hint">The figures below were read at {when(readAt)}.</p>}
    </div>
  );
}

/** Labelled figures as a two-column table: each label beside its value. */
export function Figures({ rows }) {
  return (
    <table>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
