// Email service for sending password reset emails
// This is a placeholder implementation - integrate with your preferred email service

const nodemailer = require('nodemailer');

// Configure your email transporter
const transporter = nodemailer.createTransport({
  // Configure with your email service (Gmail, SendGrid, etc.)
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, resetToken) {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset for your account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);

  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send email');
  }
}

/**
 * Send welcome email to new users
 */
async function sendWelcomeEmail(email, name) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to Our Platform',
      html: `
        <h2>Welcome ${name}!</h2>
        <p>Thank you for joining our platform.</p>
        <p>You can now start creating and managing your links.</p>
        <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">Get Started</a>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent to:', email);

  } catch (error) {
    console.error('Failed to send welcome email:', error);
    throw new Error('Failed to send email');
  }
}

/**
 * Send email with attachment
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @param {Array} attachments - Array of attachment objects
 */
async function sendEmail(to, subject, html, attachments = []) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.SMTP_USER,
      to,
      subject,
      html,
      attachments
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent to:', to);

  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Failed to send email');
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendEmail
};