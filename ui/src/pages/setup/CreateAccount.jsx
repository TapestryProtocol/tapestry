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
 * and an owner whose Assistant key is missing. Story 2 (ADR setup-create-account/0002 § 4) adds a
 * deactivated customer and a guest who may sign up while the owner's open sign-up is on.
 *
 * Opening the page only reads. The writes are the may-create button, POST /api/assistant/provision-key,
 * and the sign-up button, POST /api/auth/sign-up-new-customer. After either, the person lands on the Edit
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

const firstString = (...values) => values.find((v) => typeof v === 'string' && v) || null;

/**
 * One press of the create or sign-up button (ADR 0001 § Decision 3, ADR 0002 § 4): "working" and disabled
 * while the request runs; on success, or when another tab already won (`lostRace`), refreshUser() and on to
 * the Edit Assistant Profile page; otherwise "failed" with the reason, and the button again.
 */
function usePressToEditor(url, { lostRace, reasonOf }) {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('idle'); // idle | working | failed
  const [reason, setReason] = useState('');

  async function press() {
    setPhase('working');
    setReason('');
    try {
      const res = await fetch(url, { method: 'POST' });
      let data = null;
      try { data = await res.json(); } catch { /* not JSON */ }
      if ((res.ok && data && data.success === true) || lostRace(res, data)) {
        try { await refreshUser(); } catch { /* the editor reads its own status; the shared status re-asks on load */ }
        navigate(MY_ASSISTANT_PATH);
        return;
      }
      setReason(reasonOf(data) || `HTTP ${res.status}`);
      setPhase('failed');
    } catch (err) {
      setReason((err && err.message) || 'the request did not reach the server');
      setPhase('failed');
    }
  }

  return { phase, reason, press };
}

function MayCreate() {
  const { phase, reason, press } = usePressToEditor('/api/assistant/provision-key', {
    // A 409 means another tab won the lock: the person now holds exactly one Assistant (ADR 0001 § Decision 3).
    lostRace: (res) => res.status === 409,
    reasonOf: (data) => firstString(data && data.error),
  });

  return (
    <Card>
      <p className="bs-assistant-note">{COPY.mayCreateLine}</p>
      <button type="button" className="bs-link-btn" onClick={press} disabled={phase === 'working'}>
        {phase === 'working' ? COPY.creating : COPY.createButton}
      </button>
      {phase === 'failed' && (
        <p className="bs-error" role="alert" style={{ margin: '0.75rem 0 0' }}>{COPY.failedPrefix}{reason}</p>
      )}
    </Card>
  );
}

/** A guest while the owner's open sign-up is on (ADR 0002 § 4). */
function MaySignUp() {
  const { phase, reason, press } = usePressToEditor('/api/auth/sign-up-new-customer', {
    // Another tab signed this person up first: they are a customer with one Assistant (ADR 0002 § 3).
    lostRace: (res, data) => res.status === 409 && !!data && data.code === 'already-customer',
    reasonOf: (data) => firstString(data && data.error, data && data.message),
  });

  return (
    <Card>
      <p className="bs-assistant-note">{COPY.signUpLine1}</p>
      <p className="bs-assistant-note">{COPY.signUpLine2}</p>
      <button type="button" className="bs-link-btn" onClick={press} disabled={phase === 'working'}>
        {phase === 'working' ? COPY.signingUp : COPY.signUpButton}
      </button>
      {phase === 'failed' && (
        <p className="bs-error" role="alert" style={{ margin: '0.75rem 0 0' }}>{COPY.signUpFailedPrefix}{reason}</p>
      )}
    </Card>
  );
}

/** ": {owner}." with the owner named and linked, or "." when the instance doesn't say who its owner is. */
function OwnerTail() {
  const { ownerPubkey, ownerProfile } = useConfig();
  const ownerName = nameOf(ownerProfile) || (ownerPubkey ? npubOf(ownerPubkey) : null);
  return ownerPubkey
    ? <>: <Link to={`/user/${ownerPubkey}`} style={WRAP}>{ownerName}</Link>.</>
    : '.';
}

/** A signed-in guest with no Assistant, while open sign-up is off: ask the owner. */
export function GuestNoAssistant() {
  return (
    <Card>
      <p className="bs-assistant-note">{COPY.guestLine}</p>
      <p className="bs-assistant-note">{COPY.askOwner}<OwnerTail /></p>
    </Card>
  );
}

/** A customer whose record isn't active, and who holds no Assistant: only the owner can reactivate them. */
function Deactivated() {
  return (
    <Card>
      <p className="bs-assistant-note">{COPY.deactivated}<OwnerTail /></p>
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
  } else if (state === 'deactivated') {
    body = <Deactivated />;
  } else if (state === 'may-sign-up') {
    body = <MaySignUp />;
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
