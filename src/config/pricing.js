/**
 * Pricing tiers configuration for the SaaS application
 * Features are defined as limits that can be checked by middleware
 */

const pricingTiers = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    currency: 'usd',
    interval: 'month',
    features: {
      links: 10,              // max links per month
      clicks: 1000,          // max clicks per month
      apiKeys: 1,            // max API keys
      analytics: true,       // basic analytics
      webhooks: false,       // webhook support
      customDomain: false,   // custom domain support
      tags: 3,               // max tags
      passwordProtection: false,
      expiration: false,     // link expiration
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For small businesses and individuals',
    price: 9.99,
    currency: 'usd',
    interval: 'month',
    features: {
      links: 500,
      clicks: 10000,
      apiKeys: 3,
      analytics: true,
      webhooks: true,
      customDomain: false,
      tags: 10,
      passwordProtection: true,
      expiration: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Professional',
    description: 'For growing businesses',
    price: 29.99,
    currency: 'usd',
    interval: 'month',
    features: {
      links: 5000,
      clicks: 100000,
      apiKeys: 10,
      analytics: true,
      webhooks: true,
      customDomain: true,
      tags: 50,
      passwordProtection: true,
      expiration: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 99.99,
    currency: 'usd',
    interval: 'month',
    features: {
      links: -1,  // unlimited
      clicks: -1, // unlimited
      apiKeys: -1, // unlimited
      analytics: true,
      webhooks: true,
      customDomain: true,
      tags: -1,   // unlimited
      passwordProtection: true,
      expiration: true,
    },
  },
};

/**
 * Get pricing tier configuration by ID
 */
function getPricingTier(tierId) {
  return pricingTiers[tierId];
}

/**
 * Get all active pricing tiers
 */
function getAllPricingTiers() {
  return Object.values(pricingTiers);
}

/**
 * Check if a feature is available for a given tier
 */
function hasFeature(tierId, feature) {
  const tier = getPricingTier(tierId);
  if (!tier) return false;

  const featureValue = tier.features[feature];
  return featureValue === true || (typeof featureValue === 'number' && featureValue > 0) || featureValue === -1;
}

/**
 * Get feature limit for a given tier
 */
function getFeatureLimit(tierId, feature) {
  const tier = getPricingTier(tierId);
  if (!tier) return 0;

  const limit = tier.features[feature];
  return typeof limit === 'number' ? limit : (limit === true ? -1 : 0);
}

module.exports = {
  pricingTiers,
  getPricingTier,
  getAllPricingTiers,
  hasFeature,
  getFeatureLimit,
};