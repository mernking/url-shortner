const prisma = require("../prisma/client");
const { sendWebhook } = require("../services/webhook.service");

/**
 * @swagger
 * /{slug}:
 *   get:
 *     summary: Redirect to the original URL and track the click
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: The slug of the short link.
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirects to the original destination URL.
 *       404:
 *         description: Link not found.
 *       410:
 *         description: Link has expired.
 *       401:
 *         description: Password required for protected link.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 challenge:
 *                   type: boolean
 */
async function redirectHandler(req, res) {
  const { slug } = req.params;
  const link = await prisma.link.findUnique({
    where: { slug },
    include: { createdBy: true },
  });
  if (!link) return res.status(404).send("Not found");

  // Check if link has expired
  if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
    return res.status(410).send("Gone");
  }

  // Check if link is password protected
  if (link.password) {
    // For simplicity, check if password is provided in query param or body
    const providedPassword = req.query.password || req.body.password;
    if (!providedPassword || providedPassword !== link.password) {
      // Return challenge response or redirect to password form
      return res
        .status(401)
        .json({ error: "Password required", challenge: true });
    }
  }

  const ip = req._logger?.ip || req.ip;
  const geo = req._logger?.geo || {};
  const ua = req.headers["user-agent"];
  const ref = req.headers.referer || req.headers.referrer || null;

  const clickData = {
    ip,
    country: geo?.country || null,
    region: geo?.region || null,
    city: geo?.city || null,
    ua,
    referrer: ref,
    headers: JSON.stringify({
      "accept-language": req.headers["accept-language"],
      "x-forwarded-for": req.headers["x-forwarded-for"],
    }),
    occurredAt: new Date(),
  };

  // create click record (fire-and-forget style)
  try {
    await prisma.click.create({
      data: {
        linkId: link.id,
        ...clickData,
      },
    });
  } catch (e) {
    console.error("Failed to record click", e.message || e);
  }

  // Send webhook notification if configured
  if (link.webhookUrl) {
    sendWebhook(link.webhookUrl, clickData, link).catch((err) => {
      console.error("Webhook error:", err.message);
    });
  }

  // optionally update counters or fire alerts
  // redirect
  res.redirect(link.destination);
}

module.exports = { redirectHandler };
