import { mayCreateAssistant } from '../../config/avatarMenuLinks.js';

/**
 * Which state the Create your account page is in (setup-create-account #1, ADR setup-create-account/0001
 * § Decision 1). Pure: it reads only what sign-in already knows, so the page never waits on
 * /api/setup/status for step 1.
 *
 * The order is the decision:
 *   - holding an Assistant wins over the role, so a guest who kept one (an inactive customer) is done;
 *   - the owner is checked before mayCreateAssistant, so the owner, whose Assistant is the instance TA,
 *     is never offered provisioning (ADR assistant-profile/0004 sub-decision 4).
 * Who may create one is mayCreateAssistant's to say, not this file's.
 *
 * @param {?{ classification?: string, assistantPubkey?: ?string }} user  AuthContext's user, or null
 * @param {boolean} authLoading  AuthContext's `loading`
 * @returns {'checking'|'signed-out'|'done'|'owner-key-missing'|'may-create'|'guest'}
 */
export function createAccountState(user, authLoading) {
  if (authLoading) return 'checking';
  if (!user) return 'signed-out';
  if (user.assistantPubkey) return 'done';
  if (user.classification === 'owner') return 'owner-key-missing';
  if (mayCreateAssistant(user)) return 'may-create';
  return 'guest';
}
