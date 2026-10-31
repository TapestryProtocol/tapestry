import { useAppearance } from '../context/AppearanceContext';

/**
 * The Appearance control: System, Light or Dark (appearance-setting #1, ADR 0001 sub-decision 8).
 *
 * One radio group, three placements:
 *   'menu'    — labelled segments in the signed-in avatar menu;
 *   'compact' — three icon buttons beside Sign in, signed out;
 *   'card'    — labelled segments on /settings, with a line saying the choice stays in this browser.
 */

const OPTIONS = [
  { value: 'system', label: 'System', icon: '◐' },
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
];

export default function AppearanceControl({ variant = 'menu' }) {
  const { choice, setChoice } = useAppearance();
  const compact = variant === 'compact';

  return (
    <div className={`bs-appearance bs-appearance-${variant}`} role="radiogroup" aria-label="Appearance">
      {OPTIONS.map(({ value, label, icon }) => {
        const checked = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            className={`bs-appearance-option${checked ? ' is-active' : ''}`}
            onClick={() => setChoice(value)}
          >
            <span className="bs-appearance-icon" aria-hidden="true">{icon}</span>
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
