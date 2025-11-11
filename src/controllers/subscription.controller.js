const subscriptionService = require('../services/subscription.service');
const stripeService = require('../services/stripe.service');

/**
 * Get user's current subscription
 */
async function getSubscription(req, res) {
  try {
    const userId = req.user.id;
    const subscription = await subscriptionService.getUserSubscription(userId);

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription',
    });
  }
}

/**
 * Create new subscription
 */
async function createSubscription(req, res) {
  try {
    const userId = req.user.id;
    const { planId, paymentMethodId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required',
      });
    }

    const result = await subscriptionService.createSubscription(userId, planId, paymentMethodId);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Subscription created successfully',
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create subscription',
    });
  }
}

/**
 * Update subscription plan
 */
async function updateSubscription(req, res) {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required',
      });
    }

    const result = await subscriptionService.updateSubscription(userId, planId);

    res.json({
      success: true,
      data: result,
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update subscription',
    });
  }
}

/**
 * Cancel subscription
 */
async function cancelSubscription(req, res) {
  try {
    const userId = req.user.id;
    const { cancelAtPeriodEnd = true } = req.body;

    const result = await subscriptionService.cancelSubscription(userId, cancelAtPeriodEnd);

    res.json({
      success: true,
      data: result,
      message: cancelAtPeriodEnd ? 'Subscription will be canceled at the end of the billing period' : 'Subscription canceled immediately',
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel subscription',
    });
  }
}

/**
 * Reactivate subscription
 */
async function reactivateSubscription(req, res) {
  try {
    const userId = req.user.id;

    const result = await subscriptionService.reactivateSubscription(userId);

    res.json({
      success: true,
      data: result,
      message: 'Subscription reactivated successfully',
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reactivate subscription',
    });
  }
}

/**
 * Get subscription usage
 */
async function getUsage(req, res) {
  try {
    const userId = req.user.id;
    const usage = await subscriptionService.getSubscriptionUsage(userId);

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage data',
    });
  }
}

/**
 * Get billing history
 */
async function getBillingHistory(req, res) {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const history = await subscriptionService.getBillingHistory(userId, parseInt(limit));

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error getting billing history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get billing history',
    });
  }
}

/**
 * Get available pricing plans
 */
async function getPricingPlans(req, res) {
  try {
    const { getAllPricingTiers } = require('../config/pricing');
    const plans = getAllPricingTiers();

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error('Error getting pricing plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pricing plans',
    });
  }
}

/**
 * Handle Stripe webhooks
 */
async function handleWebhook(req, res) {
  try {
    const event = req.body;

    // Verify webhook signature (would need to implement based on your setup)

    await stripeService.handleWebhook(event);

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(400).json({
      success: false,
      message: 'Webhook error',
    });
  }
}

/**
 * Create payment method setup intent
 */
async function createSetupIntent(req, res) {
  try {
    const userId = req.user.id;

    // Get or create customer
    const customer = await stripeService.createOrGetCustomer(userId, req.user.email);

    // Create setup intent
    const setupIntent = await stripeService.stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
    });

    res.json({
      success: true,
      data: {
        client_secret: setupIntent.client_secret,
      },
    });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment setup',
    });
  }
}

module.exports = {
  getSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription,
  getUsage,
  getBillingHistory,
  getPricingPlans,
  handleWebhook,
  createSetupIntent,
};