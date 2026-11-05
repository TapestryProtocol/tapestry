/**
 * The Create your account page's own words (setup-create-account #1).
 *
 * Approved with the story: engineering-team/stories/setup-create-account/1-create-account-page.md § Copy.
 * Change them there first. Strings the page shares with /setup (the heading, step 1's sentence, its
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
};
