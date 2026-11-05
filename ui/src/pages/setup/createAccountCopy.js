/**
 * The Create your account page's own words (setup-create-account #1, and #2 for open sign-up).
 *
 * Approved with the stories: engineering-team/stories/setup-create-account/1-create-account-page.md § Copy
 * and 2-open-sign-up.md § Copy. Change them there first. Strings the page shares with /setup (the heading, step 1's sentence, its
 * done sentence, "Sign in with nostr", "Done", "Done: ") stay in ./steps.js and are imported from there,
 * so approved copy has one home.
 */
export const CREATE_ACCOUNT_COPY = {
  checking: 'Checking sign-in…',
  signedOutLine: 'Sign in to see your account here, or to create it.',
  assistantLabel: 'Your Tapestry Assistant:',
  viewProfile: 'View its profile',
  noProfile: 'It has no profile yet.',
  setUpProfile: 'Set up its profile',
  manage: 'Manage your Assistant',
  mayCreateLine: "You don't have a Tapestry Assistant on this instance yet. Create one, and this instance will hold its key for you.",
  createButton: 'Create my Tapestry Assistant',
  creating: 'Creating…',
  // Followed by the reason: "Your Tapestry Assistant couldn't be created: {reason}".
  failedPrefix: "Your Tapestry Assistant couldn't be created: ",
  guestLine: "You don't have a Tapestry Assistant on this instance. This instance sets one up for its owner, its admins and its customers.",
  // Followed by ": {owner}." when the owner is known, else by ".".
  askOwner: 'To become a customer here, ask the owner of this instance',
  ownerKeyMissing: "This instance's Tapestry Assistant key is missing. It is created when the instance is first set up and can't be created from this page; it has to be restored on the server.",
  // Story 2: open sign-up.
  signUpLine1: "You don't have an account on this instance yet.",
  signUpLine2: 'Sign up as a customer, and this instance will create your Tapestry Assistant and hold its key for you.',
  signUpButton: 'Sign up',
  signingUp: 'Signing up…',
  // Followed by the reason: "You couldn't be signed up: {reason}".
  signUpFailedPrefix: "You couldn't be signed up: ",
  // Followed by ": {owner}." when the owner is known, else by ".", as askOwner.
  deactivated: 'Your customer account here is inactive. To use it again, ask the owner of this instance',
};
