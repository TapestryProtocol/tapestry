import { useState, useEffect, useRef } from 'react';
import { useAppearance } from '../context/AppearanceContext';

/**
 * The Appearance control: System, Light or Dark (appearance-setting #1, ADR 0001 sub-decision 8 and Amendment 1).
 *
 * One radio group, three placements:
 *   'menu'    — labelled segments in the signed-in avatar menu;
 *   'compact' — three icon buttons beside Sign in, signed out; on phones (CSS, ≤ 520px) one button showing the current
 *               choice, which opens the three (David, 2026-10-31: the bar has no room for three there);
 *   'card'    — labelled segments on /settings, with a line saying the choice stays in this browser.
 *
 * Keyboard: one tab stop per group (the checked option); the arrow keys move the choice, as a radio group does.
 */

const OPTIONS = [
  { value: 'system', label: 'System', icon: '◐' },
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
];

function RadioGroup({ variant, choice, setChoice, onPick = setChoice, iconsOnly, autoFocus = false }) {
  const refs = useRef([]);
  const index = Math.max(0, OPTIONS.findIndex((o) => o.value === choice));

  useEffect(() => {
    if (autoFocus && refs.current[index]) refs.current[index].focus();
  }, [autoFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    setChoice(OPTIONS[next].value);
    if (refs.current[next]) refs.current[next].focus();
  }

  return (
    <div className={`bs-appearance bs-appearance-${variant}`} role="radiogroup" aria-label="Appearance" onKeyDown={onKeyDown}>
      {OPTIONS.map(({ value, label, icon }, i) => {
        const checked = choice === value;
        return (
          <button
            key={value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            aria-label={iconsOnly ? label : undefined}
            title={iconsOnly ? label : undefined}
            className={`bs-appearance-option${checked ? ' is-active' : ''}`}
            onClick={() => onPick(value)}
          >
            <span className="bs-appearance-icon" aria-hidden="true">{icon}</span>
            {!iconsOnly && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function AppearanceControl({ variant = 'menu' }) {
  const { choice, setChoice } = useAppearance();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const toggleRef = useRef(null);

  // The phone popover closes on a click outside it and on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); if (toggleRef.current) toggleRef.current.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (variant !== 'compact') return <RadioGroup variant={variant} choice={choice} setChoice={setChoice} />;

  const current = OPTIONS.find((o) => o.value === choice) || OPTIONS[0];
  // A choice pressed in the phone popover closes it, and focus goes back to its button; the arrow keys only move it.
  const chooseAndClose = (value) => {
    setChoice(value);
    setOpen(false);
    if (toggleRef.current) toggleRef.current.focus();
  };
  // Tabbing out of the control closes the popover too. A blur that names no next element is not a Tab: WebKit blurs on
  // every press of a <button> without focusing it, so that blur is left alone, and a press outside is the mousedown
  // handler's to close.
  const onBlur = (e) => {
    if (open && e.relatedTarget && wrapRef.current && !wrapRef.current.contains(e.relatedTarget)) setOpen(false);
  };
  return (
    <div className="bs-appearance-compact-wrap" ref={wrapRef} onBlur={onBlur}>
      <RadioGroup variant="compact" choice={choice} setChoice={setChoice} iconsOnly />
      <button
        ref={toggleRef}
        type="button"
        className={`bs-appearance-toggle${open ? ' is-open' : ''}`}
        aria-label={`Appearance: ${current.label}`}
        title={`Appearance: ${current.label}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="bs-appearance-icon" aria-hidden="true">{current.icon}</span>
      </button>
      {open && (
        <div className="bs-appearance-popover">
          <RadioGroup variant="menu" choice={choice} setChoice={setChoice} onPick={chooseAndClose} autoFocus />
        </div>
      )}
    </div>
  );
}
