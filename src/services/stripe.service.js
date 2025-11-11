const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getPricingTier } = require('../config/pricing');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Create or retrieve Stripe customer
 */
async function createOrGetCustomer(userId, email) {
  try {
    // Check if user already has a subscription with stripeCustomerId
    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId },
    });

    if (existingSubscription?.stripeCustomerId) {
      // Retrieve existing customer
      const customer = await stripe.customers.retrieve(existingSubscription.stripeCustomerId);
      return customer;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId: userId.toString(),
      },
    });

    return customer;
  } catch (error) {
    console.error('Error creating/retrieving Stripe customer:', error);
    throw new Error('Failed to create customer');
  }
}

/**
 * Create subscription for user
 */
async function createSubscription(userId, planId, paymentMethodId = null) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const pricingTier = getPricingTier(planId);
    if (!pricingTier) {
      throw new Error('Invalid pricing tier');
    }

    const customer = await createOrGetCustomer(userId, user.email);

    // Create subscription data
    const subscriptionData = {
      customer: customer.id,
      items: [{
        price_data: {
          currency: pricingTier.currency,
          product_data: {
            name: pricingTier.name,
            description: pricingTier.description,
          },
          unit_amount: Math.round(pricingTier.price * 100), // Convert to cents
          recurring: {
            interval: pricingTier.interval,
          },
        },
      }],
      metadata: {
        userId: userId.toString(),
        planId,
      },
      expand: ['latest_invoice.payment_intent'],
    };

    // Attach payment method if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });
      subscriptionData.default_payment_method = paymentMethodId;
    }

    const subscription = await stripe.subscriptions.create(subscriptionData);

    // Save to database
    const dbSubscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customer.id,
      },
    });

    return {
      subscription: dbSubscription,
      stripeSubscription: subscription,
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw new Error('Failed to create subscription');
  }
}

/**
 * Cancel subscription
 */
async function cancelSubscription(userId, cancelAtPeriodEnd = true) {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (!subscription) {
      throw new Error('Active subscription not found');
    }

    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: cancelAtPeriodEnd,
      }
    );

    // Update database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd,
        status: cancelAtPeriodEnd ? 'active' : 'canceled',
      },
    });

    return { subscription: stripeSubscription };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw new Error('Failed to cancel subscription');
  }
}

/**
 * Reactivate subscription
 */
async function reactivateSubscription(userId) {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        cancelAtPeriodEnd: true,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    // Update database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        status: 'active',
      },
    });

    return { subscription: stripeSubscription };
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw new Error('Failed to reactivate subscription');
  }
}

/**
 * Handle Stripe webhook events
 */
async function handleWebhook(event) {
  try {
    switch (event.type) {
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    throw error;
  }
}

/**
 * Handle subscription updated webhook
 */
async function handleSubscriptionUpdated(stripeSubscription) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });
  }
}

/**
 * Handle subscription deleted webhook
 */
async function handleSubscriptionDeleted(stripeSubscription) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'canceled',
      },
    });
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(stripeInvoice) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeInvoice.subscription },
  });

  if (subscription) {
    // Create invoice record
    await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        stripeInvoiceId: stripeInvoice.id,
        amount: stripeInvoice.amount_due / 100, // Convert from cents
        currency: stripeInvoice.currency,
        status: stripeInvoice.status,
        invoicePdf: stripeInvoice.invoice_pdf,
        hostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
      },
    });
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(stripeInvoice) {
  // Could implement retry logic or send notifications
  console.log('Invoice payment failed:', stripeInvoice.id);
}

module.exports = {
  createOrGetCustomer,
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  handleWebhook,
};