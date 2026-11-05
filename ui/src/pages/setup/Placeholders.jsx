import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import { FOLLOW_STEP, ACTIVATE_STEP } from './steps';

/**
 * Placeholder pages for /setup's steps 2 and 3 (setup-page-scaffold #1).
 *
 * Each says plainly that it is a placeholder and what the page will do. Building them is queued
 * (engineering-team/stories/_intake.md, entry dated 2026-09-20; ngit issues 98821708 and 64a5f7bf).
 * Replace an export with a real page file when its step is built, as setup-create-account #1 did for
 * step 1 (./CreateAccount.jsx).
 */

function SetupStepPlaceholder({ step }) {
  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-setup-main">
        <Link to="/setup" className="bs-setup-back">← Back to setup</Link>
        <h1 className="bs-setup-title">{step.label}</h1>
        <div className="bs-setup-placeholder">
          <p><strong>Placeholder page.</strong></p>
          <p>{step.placeholder}</p>
        </div>
      </main>
    </div>
  );
}

export function SetupFollow() {
  return <SetupStepPlaceholder step={FOLLOW_STEP} />;
}

export function SetupActivate() {
  return <SetupStepPlaceholder step={ACTIVATE_STEP} />;
}
