import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import TopBar from '../../components/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import useProfiles from '../../hooks/useProfiles';
import useAssistantSetupState from '../../hooks/useAssistantSetupState';
import { MY_ASSISTANT_PATH, ASSISTANT_MANAGEMENT_PATH } from '../../config/avatarMenuLinks';
import { CREATE_ACCOUNT_STEP, SETUP_COPY } from './steps';
import { CREATE_ACCOUNT_COPY as COPY } from './createAccountCopy';
import { createAccountState } from './createAccountState';

/**
 * /setup/create-account — the Create your account page, /setup's step 1 (setup-create-account #1,
 * ADR setup-create-account/0001). It replaces setup-page-scaffold #1's placeholder.
 *
 * One state per kind of visitor, from sign-in alone (./createAccountState.js): checking, signed out,
 * done (holds an Assistant, whatever the role), may create (an admin or an active customer), a guest,
 * and an owner whose Assistant key is missing. Opening the page only reads. The one write is the
 * may-create button, POST /api/assistant/provision-key, after which the person lands on the Edit
 * Assistant Profile page; refreshUser() is what makes /setup and the Setup Alert see the new Assistant
 * (SetupStatusContext keys its request on user.assistantPubkey).
 *
 * The look is classes the setup and Assistant pages already define, and no stylesheet rule of its own
 * (ADR 0001 Amendment 1): inline styles here are layout only.
 */

const npubOf = (hex) => {
  try { return nip19.npubEncode(hex); } catch { return hex; }
};

/** A kind 0's name, display_name first; null for no profile or a failed lookup (PROFILE_LOOKUP_FAILED). */
const nameOf = (profile) => {
  if (!profile || typeof profile !== 'object' || profile.__lookupFailed) return null;
  const name = profile.display_name || profile.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
};

const WRAP = { overflowWrap: 'anywhere' };

/** /setup's done row (pages/setup/Index.jsx DoneStep), for step 1. Not a link. */
function DoneRow() {
  return (
    <div className="bs-setup-step is-done">
      <span className="bs-setup-step-marker is-done" aria-hidden="true">✓</span>
      <span className="bs-setup-step-body">
        <span className="bs-setup-step-head">
          <span className="bs-sr-only">{SETUP_COPY.doneSrPrefix}</span>
          <span className="bs-setup-step-label">{CREATE_ACCOUNT_STEP.label}</span>
          <span className="bs-setup-step-badge is-done">{SETUP_COPY.doneBadge}</span>
        </span>
        <span className="bs-setup-step-text">{CREATE_ACCOUNT_STEP.doneText}</span>
      </span>
    </div>
  );
}

function Card({ children }) {
  return <div className="bss-card" style={{ marginTop: '1.25rem' }}>{children}</div>;
}

function Done({ assistantPubkey }) {
  const profiles = useProfiles([assistantPubkey]);
  const { status } = useAssistantSetupState();
  const name = nameOf(profiles?.[assistantPubkey]);
  return (
    <>
      <DoneRow />
      <Card>
        <p className="bs-assistant-note">{COPY.assistantLabel}{name ? ` ${name}` : ''}</p>
        <p className="bs-assistant-note" style={{ ...WRAP, fontFamily: 'monospace' }}>{npubOf(assistantPubkey)}</p>
        {/* Only a finished "no profile" says so: loading and a failed check say nothing (the hook's rule). */}
        {status === 'needs-setup' && (
          <p className="bs-assistant-note">
            {COPY.noProfile} <Link to={MY_ASSISTANT_PATH}>{COPY.setUpProfile}</Link>
          </p>
        )}
        <p className="bs-assistant-note">
          <Link to={`/user/${assistantPubkey}`}>{COPY.viewProfile}</Link>
          {' · '}
          <Link to={ASSISTANT_MANAGEMENT_PATH}>{COPY.manage}</Link>
        </p>
      </Card>
    </>
  );
}

function MayCreate() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('idle'); // idle | working | failed
  const [reason, setReason] = useState('');

  async function create() {
    setPhase('working');
    setReason('');
    try {
      const res = await fetch('/api/assistant/provision-key', { method: 'POST' });
      let data = null;
      try { data = await res.json(); } catch { /* not JSON */ }
      // A 409 means another tab won the lock: the person now holds exactly one Assistant (ADR § Decision 3).
      if ((res.ok && data && data.success === true) || res.status === 409) {
        try { await refreshUser(); } catch { /* the editor reads its own status; the shared status re-asks on load */ }
        navigate(MY_ASSISTANT_PATH);
        return;
      }
      setReason((data && typeof data.error === 'string' && data.error) || `HTTP ${res.status}`);
      setPhase('failed');
    } catch (err) {
      setReason((err && err.message) || 'the request did not reach the server');
      setPhase('failed');
    }
  }

  return (
    <Card>
      <p className="bs-assistant-note">{COPY.mayCreateLine}</p>
      <button type="button" className="bs-link-btn" onClick={create} disabled={phase === 'working'}>
        {phase === 'working' ? COPY.creating : COPY.createButton}
      </button>
      {phase === 'failed' && (
        <p className="bs-error" role="alert" style={{ margin: '0.75rem 0 0' }}>{COPY.failedPrefix}{reason}</p>
      )}
    </Card>
  );
}

/** A signed-in guest with no Assistant: ask the owner. Story 2 gives it its sign-up branch. */
export function GuestNoAssistant() {
  const { ownerPubkey, ownerProfile } = useConfig();
  const ownerName = nameOf(ownerProfile) || (ownerPubkey ? npubOf(ownerPubkey) : null);
  return (
    <Card>
      <p className="bs-assistant-note">{COPY.guestLine}</p>
      <p className="bs-assistant-note">
        {COPY.askOwner}
        {ownerPubkey
          ? <>: <Link to={`/user/${ownerPubkey}`} style={WRAP}>{ownerName}</Link>.</>
          : '.'}
      </p>
    </Card>
  );
}

export function SetupCreateAccount() {
  const { user, loading, login } = useAuth();
  const state = createAccountState(user, loading);

  let body;
  if (state === 'checking') {
    body = <Card><p className="bs-assistant-note">{COPY.checking}</p></Card>;
  } else if (state === 'signed-out') {
    body = (
      <Card>
        <p className="bs-assistant-note">{CREATE_ACCOUNT_STEP.text}</p>
        <p className="bs-assistant-note">{COPY.signedOutLine}</p>
        {/* The top bar's sign-in; failures are reported by the shared sign-in modal. */}
        <button type="button" className="bs-link-btn" onClick={() => login().catch(() => {})}>
          {SETUP_COPY.signInButton}
        </button>
      </Card>
    );
  } else if (state === 'done') {
    body = <Done assistantPubkey={user.assistantPubkey} />;
  } else if (state === 'may-create') {
    body = <MayCreate />;
  } else if (state === 'owner-key-missing') {
    body = <Card><p className="bs-assistant-note">{COPY.ownerKeyMissing}</p></Card>;
  } else {
    body = <GuestNoAssistant />;
  }

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to="/setup" className="bs-setup-back">← Back to setup</Link>
        <h1 className="bs-setup-title">{CREATE_ACCOUNT_STEP.label}</h1>
        {body}
      </main>
    </div>
  );
}
