import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * The Settings page's Accounts tab (setup-create-account #2, ADR setup-create-account/0002 § 5): the owner's
 * "Open sign-up" switch, settings key signUp.open. While it's on, a signed-in guest may make themselves a
 * customer from the Create your account page.
 *
 * It reads the page's GET /api/settings and saves through the page's handleSave, which shows the saved or
 * error message. The checkbox always shows the server's state, so a refused save leaves it as it was. Only the
 * owner may change it (the server refuses anyone else); an admin sees it, disabled.
 */

// Approved with the story: engineering-team/stories/setup-create-account/2-open-sign-up.md § Copy, and ADR 0002 § 5.
export const ACCOUNT_SETTINGS_COPY = {
  switchLabel: 'Open sign-up',
  description: "Let anyone who signs in make themselves a customer here. Each new customer gets a Tapestry Assistant that this instance holds for them, and their scores are calculated in this instance's regular customer runs.",
  ownerOnly: 'Only the owner can change this.',
};
const COPY = ACCOUNT_SETTINGS_COPY;

export default function AccountSettings({ settings, onSave }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const isOwner = user?.classification === 'owner';
  const open = settings?.signUp?.open === true;

  async function toggle(e) {
    if (!isOwner || busy) return;
    setBusy(true);
    try {
      await onSave({ signUp: { open: e.target.checked } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-group" style={{ padding: '1rem' }}>
      <label>
        <input type="checkbox" checked={open} onChange={toggle} disabled={!isOwner || busy} />
        {' '}{COPY.switchLabel}
      </label>
      <p className="settings-hint" style={{ margin: '0.5rem 0 0' }}>{COPY.description}</p>
      {!isOwner && <p className="settings-hint" style={{ margin: '0.5rem 0 0' }}>{COPY.ownerOnly}</p>}
    </div>
  );
}
