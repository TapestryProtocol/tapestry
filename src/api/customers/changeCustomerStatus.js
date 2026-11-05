/**
 * Change Customer Status API Endpoint
 *
 * Owner-or-admin endpoint for changing customer status (activate/deactivate).
 *
 * The caller is the signed-in session's pubkey (ADR setup-create-account/0002 Amendment 2). Logins set only
 * `authenticated` and `pubkey` (src/middleware/auth.js, finalizeAuthenticatedSession); the `userPubkey` field this
 * handler once read hasn't been set since 37a31e247, so every request answered 401.
 */

const CustomerManager = require('../../utils/customerManager');
const { getOwnerPubkey, isAdminPubkey } = require('../../utils/config');

/**
 * `deps` is the seam tests drive (test/setup-open-sign-up.test.js S1–S4):
 * { getOwnerPubkey, isAdminPubkey, customerManagerFactory }.
 */
function createChangeCustomerStatusHandler(deps) {
    return async function handleChangeCustomerStatus(req, res) {
        try {
            // Extract pubkey and status from request body
            const { pubkey, status } = req.body;

            if (!pubkey) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer pubkey is required'
                });
            }

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required (active or inactive)'
                });
            }

            if (!['active', 'inactive'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Status must be either "active" or "inactive"'
                });
            }

            // Verify user is signed in and is the owner or an admin
            const session = req.session;
            const userPubkey = session && session.authenticated === true ? session.pubkey : null;
            if (!userPubkey) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const ownerPubkey = deps.getOwnerPubkey();
            if (!ownerPubkey || (userPubkey !== ownerPubkey && !deps.isAdminPubkey(userPubkey))) {
                return res.status(403).json({
                    success: false,
                    error: 'Only the owner or admin can change customer status'
                });
            }

            // Use CustomerManager to change status
            const customerManager = deps.customerManagerFactory();
            const result = await customerManager.changeCustomerStatus(pubkey, status);

            if (result.success) {
                console.log(`Customer status changed successfully: ${result.message}`);
                return res.json({
                    success: true,
                    message: result.message,
                    data: {
                        customer: result.customer,
                        statusChanged: result.statusChanged,
                        oldStatus: result.oldStatus,
                        newStatus: result.newStatus
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: result.message || 'Failed to change customer status'
                });
            }

        } catch (error) {
            console.error('Error changing customer status:', error);

            // Handle specific error types
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            if (error.message.includes('required') || error.message.includes('must be')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            return res.status(500).json({
                success: false,
                error: 'Internal server error while changing customer status'
            });
        }
    };
}

const handleChangeCustomerStatus = createChangeCustomerStatusHandler({
    getOwnerPubkey,
    isAdminPubkey,
    customerManagerFactory: () => new CustomerManager(),
});

module.exports = {
    handleChangeCustomerStatus,
    createChangeCustomerStatusHandler
};
