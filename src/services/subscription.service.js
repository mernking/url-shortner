const { PrismaClient } = require('@prisma/client');
const { getPricingTier, hasFeature, getFeatureLimit } = require('../config/pricing');
const stripeService = require('./stripe.service');

const prisma = new PrismaClient();

/**
 * Get user's current subscription
 */
async function getUserSubscription(userId) {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!subscription) {
      return {
        planId: 'free',
        status: 'active',
        features: getPricingTier('free').features,
      };
    }

    const pricingTier = getPricingTier(subscription.planId);
    return {
      ...subscription,
      pricingTier,
    };
  } catch (error) {
    console.error('Error getting user subscription:', error);
    throw new Error('Failed to get subscription');
  }
}

/**
 * Create subscription for user
 */
async function createSubscription(userId, planId, paymentMethodId = null) {
  try {
    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (existingSubscription) {
      throw new Error('User already has an active subscription');
    }

    // Validate pricing tier
    const pricingTier = getPricingTier(planId);
    if (!pricingTier) {
      throw new Error('Invalid pricing tier');
    }

    // Create subscription via Stripe
    const result = await stripeService.createSubscription(userId, planId, paymentMethodId);

    return result;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

/**
 * Update subscription plan
 */
async function updateSubscription(userId, newPlanId) {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const newPricingTier = getPricingTier(newPlanId);
    if (!newPricingTier) {
      throw new Error('Invalid pricing tier');
    }

    // Update Stripe subscription
    const stripeSubscription = await stripeService.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{
          id: subscription.stripeSubscriptionId, // This would need to be the subscription item ID
          price_data: {
            currency: newPricingTier.currency,
            product_data: {
              name: newPricingTier.name,
              description: newPricingTier.description,
            },
            unit_amount: Math.round(newPricingTier.price * 100),
            recurring: {
              interval: newPricingTier.interval,
            },
          },
        }],
        proration_behavior: 'create_prorations',
      }
    );

    // Update database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: newPlanId,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
    });

    return { subscription: stripeSubscription };
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw new Error('Failed to update subscription');
  }
}

/**
 * Cancel subscription
 */
async function cancelSubscription(userId, cancelAtPeriodEnd = true) {
  try {
    return await stripeService.cancelSubscription(userId, cancelAtPeriodEnd);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Reactivate subscription
 */
async function reactivateSubscription(userId) {
  try {
    return await stripeService.reactivateSubscription(userId);
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
}

/**
 * Get subscription usage for current period
 */
async function getSubscriptionUsage(userId) {
  try {
    const subscription = await getUserSubscription(userId);

    if (subscription.planId === 'free') {
      // For free tier, calculate usage
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [linksCount, clicksCount] = await Promise.all([
        prisma.link.count({
          where: {
            apiKey: {
              userId,
            },
            createdAt: {
              gte: startOfMonth,
            },
          },
        }),
        prisma.click.count({
          where: {
            link: {
              apiKey: {
                userId,
              },
            },
            occurredAt: {
              gte: startOfMonth,
            },
          },
        }),
      ]);

      return {
        links: {
          used: linksCount,
          limit: getFeatureLimit('free', 'links'),
        },
        clicks: {
          used: clicksCount,
          limit: getFeatureLimit('free', 'clicks'),
        },
        period: {
          start: startOfMonth,
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        },
      };
    }

    // For paid tiers, return current period info
    return {
      links: {
        used: 0, // Would need to track this
        limit: getFeatureLimit(subscription.planId, 'links'),
      },
      clicks: {
        used: 0, // Would need to track this
        limit: getFeatureLimit(subscription.planId, 'clicks'),
      },
      period: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
      },
    };
  } catch (error) {
    console.error('Error getting subscription usage:', error);
    throw new Error('Failed to get usage data');
  }
}

/**
 * Check if user can perform action based on subscription limits
 */
async function canPerformAction(userId, action, currentCount = 0) {
  try {
    const subscription = await getUserSubscription(userId);
    const limit = getFeatureLimit(subscription.planId, action);

    // Unlimited
    if (limit === -1) return true;

    // No limit set
    if (limit === 0) return false;

    return currentCount < limit;
  } catch (error) {
    console.error('Error checking action permission:', error);
    return false;
  }
}

/**
 * Get billing history
 */
async function getBillingHistory(userId, limit = 10) {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        subscription: {
          userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return invoices;
  } catch (error) {
    console.error('Error getting billing history:', error);
    throw new Error('Failed to get billing history');
  }
}

module.exports = {
  getUserSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription,
  getSubscriptionUsage,
  canPerformAction,
  getBillingHistory,
};