const { getConfigFromFile, isAdminPubkey } = require('../../utils/config');
const CustomerManager = require('../../utils/customerManager');

/**
 * Open sign-up: a signed-in guest makes themselves a customer of this instance, with their own
 * Tapestry Assistant, while the owner's switch `signUp.open` is on (ADR setup-create-account/0002 § 3).
 * to call: POST /api/auth/sign-up-new-customer
 *
 * Every answer keeps `success` and `message`, which the legacy sign-up pages read
 * (public/pages/customers/sign-up.html, public/pages/index.html), and a refusal adds `error` and `code`:
 *   401                          no authenticated session (the route's middleware answers first)
 *   403 sign-up-closed           the switch isn't exactly true
 *   403 not-a-guest              the owner or an admin
 *   409 already-customer         an active customer (also the answer to the tab that loses a race)
 *   403 customer-inactive        a deactivated customer, who must not reactivate themselves
 *   500 assistant-key-failed     the record was created but the key wasn't: story 1's create button recovers it
 *   500 sign-up-failed           anything else
 *   200                          customerId, customerName, assistantPubkey, assistantNpub, and the legacy pages'
 *                                pubkey, status and relayPubkey (the Assistant's pubkey again)
 */

const MESSAGES = {
  notSignedIn: 'Authentication required. Please sign in first.',
  closed: 'Open sign-up is off on this instance.',
  owner: 'Owner account cannot sign up as customer',
  admin: 'Admin account cannot sign up as customer',
  alreadyCustomer: 'You are already a customer.',
  inactive: 'Your customer account here is inactive.',
  created: 'Customer account created successfully',
  failed: 'Internal server error during sign-up process',
};

function refuse(res, status, code, message) {
    return res.status(status).json({ success: false, code, message, error: message });
}

/** The answer for a pubkey that already has a customer record. */
function refuseExisting(res, record) {
    return record.status === 'active'
        ? refuse(res, 409, 'already-customer', MESSAGES.alreadyCustomer)
        : refuse(res, 403, 'customer-inactive', MESSAGES.inactive);
}

/**
 * The owner path's name: customer_<first 8 hex>_<base-36 ms>.
 * @param {string} pubkey - User's public key
 * @returns {string} - Generated customer name
 */
function generateCustomerName(pubkey) {
    return `customer_${pubkey.substring(0, 8)}_${Date.now().toString(36)}`;
}

/**
 * `deps` is the seam tests drive (test/setup-open-sign-up.test.js H1–H11):
 * { getSettings, getConfigFromFile, isAdminPubkey, customerManagerFactory, provisionAssistantKeyOnce }.
 */
function createSignUpHandler(deps) {
    return async function handleSignUpNewCustomer(req, res) {
        try {
            if (!req.session || req.session.authenticated !== true || !req.session.pubkey) {
                return res.status(401).json({ success: false, message: MESSAGES.notSignedIn, error: MESSAGES.notSignedIn });
            }
            const pubkey = req.session.pubkey;

            // Closed unless the owner saved exactly true (ADR 0002 § 1).
            const settings = deps.getSettings() || {};
            if (!(settings.signUp && settings.signUp.open === true)) {
                return refuse(res, 403, 'sign-up-closed', MESSAGES.closed);
            }

            const ownerPubkey = deps.getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
            if (ownerPubkey && pubkey === ownerPubkey) return refuse(res, 403, 'not-a-guest', MESSAGES.owner);
            if (deps.isAdminPubkey(pubkey)) return refuse(res, 403, 'not-a-guest', MESSAGES.admin);

            const customerManager = deps.customerManagerFactory();
            await customerManager.initialize();
            const existing = await customerManager.getCustomer(pubkey);
            if (existing) return refuseExisting(res, existing);

            // The customer first, then the key: a failed key leaves a customer story 1's page can finish, where the
            // reverse would leave a guest holding a key and no record. Every field but these comes from createCustomer's
            // defaults, the owner path's values (AC-4).
            let record;
            try {
                record = await customerManager.createCustomer({
                    name: generateCustomerName(pubkey),
                    pubkey,
                    status: 'active',
                    observer_id: pubkey,
                    comments: 'Signed up through open sign-up',
                });
            } catch (error) {
                // A concurrent sign-up for this pubkey won, between our check and the store's own (under its lock).
                if (/already exists/.test(String(error && error.message))) {
                    const fresh = deps.customerManagerFactory();
                    await fresh.initialize();
                    const winner = await fresh.getCustomer(pubkey);
                    if (winner) return refuseExisting(res, winner);
                }
                throw error;
            }
            console.log(`[sign-up] Created customer ${record.name} (ID: ${record.id}) through open sign-up`);

            // Keeps a key the person already holds; the old path's relay-key helper always generated a new one over it.
            let outcome;
            try {
                outcome = await deps.provisionAssistantKeyOnce(pubkey);
            } catch (error) {
                console.error('[sign-up] Assistant key failed after the customer was created:', error);
                return refuse(res, 500, 'assistant-key-failed',
                    `Your customer account was created, but its Tapestry Assistant could not be: ${error.message}`);
            }
            const keys = outcome.created ? outcome.keys : outcome.existing;

            // Only public fields: `keys` also holds the private key. pubkey, status and relayPubkey are the legacy
            // sign-up pages' names, which they show on success (ADR 0002 Amendment 2, Decision 2).
            return res.status(200).json({
                success: true,
                message: MESSAGES.created,
                customerId: record.id,
                customerName: record.name,
                assistantPubkey: keys.pubkey,
                assistantNpub: keys.npub,
                pubkey,
                status: record.status,
                relayPubkey: keys.pubkey,
            });
        } catch (error) {
            console.error('Error in signUpNewCustomer:', error);
            return res.status(500).json({
                success: false,
                code: 'sign-up-failed',
                message: MESSAGES.failed,
                error: String((error && error.message) || error),
            });
        }
    };
}

const handleSignUpNewCustomer = createSignUpHandler({
    getSettings: () => require('../../config/settings').getSettings(),
    getConfigFromFile,
    isAdminPubkey,
    customerManagerFactory: () => new CustomerManager(),
    // Lazy: the assistant module pulls in the key store and nostr libraries.
    provisionAssistantKeyOnce: (pubkey) => require('../assistant/index.js').provisionAssistantKeyOnce(pubkey),
});

module.exports = { handleSignUpNewCustomer, createSignUpHandler };
