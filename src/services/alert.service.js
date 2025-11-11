const prisma = require('../prisma/client');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

async function createAlert(apiKeyId, type, message) {
  return prisma.alert.create({
    data: { apiKeyId, type, message },
  });
}

// send notification
async function notifyAdmins(subject, body) {
  if (process.env.ALERT_WEBHOOK_URL) {
    try {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, body })
      });
    } catch (e) { console.error('webhook notify failed', e.message); }
  }

  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    try {
      await transporter.sendMail({
        from: process.env.ALERT_EMAIL_FROM,
        to: process.env.ALERT_EMAIL_TO,
        subject,
        text: body,
      });
    } catch (e) { console.error('email notify failed', e.message); }
  }
}

module.exports = { createAlert, notifyAdmins };