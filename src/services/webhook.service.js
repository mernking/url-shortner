const axios = require('axios');

/**
 * Sends a webhook notification for a link click event.
 * @param {string} webhookUrl - The URL to send the POST request to.
 * @param {object} clickData - The click event data.
 * @param {object} linkData - The link information.
 */
async function sendWebhook(webhookUrl, clickData, linkData) {
  if (!webhookUrl) return;

  try {
    const payload = {
      event: 'link_click',
      click: clickData,
      link: {
        id: linkData.id,
        slug: linkData.slug,
        destination: linkData.destination,
        title: linkData.title,
        createdAt: linkData.createdAt,
        expiresAt: linkData.expiresAt,
      },
      timestamp: new Date().toISOString(),
    };

    await axios.post(webhookUrl, payload, {
      timeout: 5000, // 5 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SASS-Link-Webhook/1.0',
      },
    });
  } catch (error) {
    console.error('Webhook delivery failed:', error.message);
    // Don't throw error to avoid breaking the redirect flow
  }
}

module.exports = { sendWebhook };