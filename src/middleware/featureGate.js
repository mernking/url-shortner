const subscriptionService = require('../services/subscription.service');
const { hasFeature, getFeatureLimit } = require('../config/pricing');

/**
 * Middleware to check if billing is enabled globally
 * If billing is disabled, all users get free tier features
 */
function checkBillingEnabled(req, res, next) {
  // Check if billing is enabled via environment variable
  const billingEnabled = process.env.BILLING_ENABLED === 'true';

  if (!billingEnabled && req.user) {
    // If billing is disabled, set user to free tier
    req.user.subscription = {
      planId: 'free',
      status: 'active',
    };
  }

  next();
}

/**
 * Middleware to check if user has access to a specific feature
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if billing is enabled
      const billingEnabled = process.env.BILLING_ENABLED === 'true';

      if (!billingEnabled) {
        // If billing is disabled, allow all features (free tier)
        return next();
      }

      // Get user's subscription
      const subscription = await subscriptionService.getUserSubscription(userId);

      // Check if user has the required feature
      if (!hasFeature(subscription.planId, feature)) {
        return res.status(403).json({
          success: false,
          message: `This feature requires a premium subscription. Current plan: ${subscription.planId}`,
          requiredFeature: feature,
          currentPlan: subscription.planId,
        });
      }

      // Attach subscription info to request
      req.user.subscription = subscription;

      next();
    } catch (error) {
      console.error('Error checking feature access:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify subscription',
      });
    }
  };
}

/**
 * Middleware to check usage limits for a specific feature
 */
function checkUsageLimit(feature) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if billing is enabled
      const billingEnabled = process.env.BILLING_ENABLED === 'true';

      if (!billingEnabled) {
        // If billing is disabled, allow unlimited usage
        return next();
      }

      // Get current usage count based on feature
      let currentCount = 0;

      switch (feature) {
        case 'links':
          // Count links created this month
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient();

          currentCount = await prisma.link.count({
            where: {
              apiKey: {
                userId,
              },
              createdAt: {
                gte: startOfMonth,
              },
            },
          });
          break;

        case 'clicks':
          // Count clicks this month
          const clickStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          const clickPrisma = new PrismaClient();
          currentCount = await clickPrisma.click.count({
            where: {
              link: {
                apiKey: {
                  userId,
                },
              },
              occurredAt: {
                gte: clickStartOfMonth,
              },
            },
          });
          break;

        case 'apiKeys':
          // Count active API keys
          const keyPrisma = new PrismaClient();
          currentCount = await keyPrisma.apiKey.count({
            where: {
              userId,
              isActive: true,
            },
          });
          break;

        default:
          // For other features, assume no usage tracking needed
          return next();
      }

      // Check if user can perform the action
      const canPerform = await subscriptionService.canPerformAction(userId, feature, currentCount);

      if (!canPerform) {
        const subscription = await subscriptionService.getUserSubscription(userId);
        const limit = getFeatureLimit(subscription.planId, feature);

        return res.status(429).json({
          success: false,
          message: `Usage limit exceeded for ${feature}. Current usage: ${currentCount}, Limit: ${limit}`,
          feature,
          currentUsage: currentCount,
          limit,
          currentPlan: subscription.planId,
        });
      }

      // Attach usage info to request
      req.usage = {
        feature,
        currentCount,
        limit: getFeatureLimit((await subscriptionService.getUserSubscription(userId)).planId, feature),
      };

      next();
    } catch (error) {
      console.error('Error checking usage limit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify usage limits',
      });
    }
  };
}

/**
 * Middleware to restrict admin-only features
 */
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
}

/**
 * Combined middleware for features that require both feature access and usage limits
 */
function requireFeatureWithLimit(feature) {
  return [requireFeature(feature), checkUsageLimit(feature)];
}

/**
 * Middleware to check analytics feature access
 * Used for reports and analytics endpoints
 */
function requireAnalyticsFeature(req, res, next) {
  return requireFeature('analytics')(req, res, next);
}

/**
 * Middleware to check export feature access
 * Used for data export endpoints
 */
function requireExportFeature(req, res, next) {
  return requireFeature('analytics')(req, res, next); // Analytics includes export capabilities
}

module.exports = {
  checkBillingEnabled,
  requireFeature,
  checkUsageLimit,
  requireAdmin,
  requireFeatureWithLimit,
  requireAnalyticsFeature,
  requireExportFeature,
};