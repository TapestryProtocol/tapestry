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
 * Story 2 (ADR setup-create-account/0002 § 4) adds two guest rows before the last:
 *   - a guest whose customer record isn't active is "deactivated", whatever the switch says, so a
 *     deactivated customer is never offered sign-up;
 *   - a guest may sign up only when the sign-in answer says signUpOpen exactly true.
 *
 * @param {?{ classification?: string, assistantPubkey?: ?string, customerStatus?: ?string, signUpOpen?: boolean }} user
 *   AuthContext's user, or null
 * @param {boolean} authLoading  AuthContext's `loading`
 * @returns {'checking'|'signed-out'|'done'|'owner-key-missing'|'may-create'|'deactivated'|'may-sign-up'|'guest'}
 */
export function createAccountState(user, authLoading) {
  if (authLoading) return 'checking';
  if (!user) return 'signed-out';
  if (user.assistantPubkey) return 'done';
  if (user.classification === 'owner') return 'owner-key-missing';
  if (mayCreateAssistant(user)) return 'may-create';
  if (typeof user.customerStatus === 'string' && user.customerStatus !== 'active') return 'deactivated';
  if (user.signUpOpen === true) return 'may-sign-up';
  return 'guest';
}
