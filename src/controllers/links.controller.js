const prisma = require("../prisma/client");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const paginationMiddleware = require("../middleware/pagination");

// create short link (authenticated via API key)
/**
 * @swagger
 * /api/links:
 *   post:
 *     summary: Create a short link
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destination:
 *                 type: string
 *                 description: The URL to shorten.
 *                 example: https://example.com/long-url
 *               slug:
 *                 type: string
 *                 description: Optional custom slug for the short URL.
 *                 example: my-custom-slug
 *               title:
 *                 type: string
 *                 description: Optional title for the link.
 *                 example: My Awesome Product Page
 *               meta:
 *                 type: object
 *                 description: Optional metadata for the link.
 *               password:
 *                 type: string
 *                 description: Optional password to protect the link.
 *                 example: mypassword
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration date for the link.
 *                 example: 2023-12-31T23:59:59Z
 *     responses:
 *       200:
 *         description: Short link created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug:
 *                   type: string
 *                 shortUrl:
 *                   type: string
 *                 id:
 *                   type: integer
 *       400:
 *         description: Invalid request or link creation failed.
 *       401:
 *         description: Unauthorized, API key missing or invalid.
 */
async function createLink(req, res) {
  const { destination, slug, title, meta, password, expiresAt, webhookUrl } =
    req.body;
  if (!destination)
    return res.status(400).json({ error: "destination is required" });

  // slug fallback
  const finalSlug = slug || uuidv4().slice(0, 8);

  // Hash password if provided
  let hashedPassword = null;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  try {
    const link = await prisma.link.create({
      data: {
        slug: finalSlug,
        destination,
        title,
        apiKeyId: req.apiKey.id,
        meta: meta || {},
        password: hashedPassword,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        webhookUrl,
      },
    });

    return res.json({
      slug: link.slug,
      shortUrl: `${req.protocol}://${req.get("host")}/${link.slug}`,
      id: link.id,
    });
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Link creation failed", details: err.message });
  }
}

/**
 * @swagger
 * /api/links/{slug}/stats:
 *   get:
 *     summary: Get statistics for a short link
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: The slug of the short link.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Link statistics retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug:
 *                   type: string
 *                 destination:
 *                   type: string
 *                 clicksCount:
 *                   type: integer
 *                 clicks:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized, API key missing or invalid.
 *       404:
 *         description: Link not found.
 */
async function getLinkStats(req, res) {
  const { slug } = req.params;
  const link = await prisma.link.findUnique({
    where: { slug },
    include: { clicks: { orderBy: { occurredAt: "desc" } } },
  });
  if (!link) return res.status(404).json({ error: "Not found" });
  return res.json({
    slug: link.slug,
    destination: link.destination,
    clicksCount: link.clicks.length,
    clicks: link.clicks.slice(0, 100), // limit
  });
}

/**
 * @swagger
 * /api/links/{id}:
 *   put:
 *     summary: Update a short link
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the short link to update.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destination:
 *                 type: string
 *                 description: The URL to shorten.
 *                 example: https://example.com/long-url
 *               slug:
 *                 type: string
 *                 description: Optional custom slug for the short URL.
 *                 example: my-custom-slug
 *               title:
 *                 type: string
 *                 description: Optional title for the link.
 *                 example: My Awesome Product Page
 *               meta:
 *                 type: object
 *                 description: Optional metadata for the link.
 *               password:
 *                 type: string
 *                 description: Optional password to protect the link.
 *                 example: mypassword
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration date for the link.
 *                 example: 2023-12-31T23:59:59Z
 *     responses:
 *       200:
 *         description: Short link updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 slug:
 *                   type: string
 *                 shortUrl:
 *                   type: string
 *       400:
 *         description: Invalid request or link update failed.
 *       401:
 *         description: Unauthorized, API key missing or invalid.
 *       404:
 *         description: Link not found.
 */
async function updateLink(req, res) {
  const { id } = req.params;
  const { destination, slug, title, meta, password, expiresAt, webhookUrl } =
    req.body;

  // Hash password if provided
  let hashedPassword = null;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  try {
    const link = await prisma.link.update({
      where: { id: parseInt(id), apiKeyId: req.apiKey.id },
      data: {
        destination,
        slug,
        title,
        meta: meta || {},
        password: hashedPassword,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        webhookUrl,
      },
    });

    return res.json({
      id: link.id,
      slug: link.slug,
      shortUrl: `${req.protocol}://${req.get("host")}/${link.slug}`,
    });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Link not found" });
    return res
      .status(400)
      .json({ error: "Link update failed", details: err.message });
  }
}

/**
 * @swagger
 * /api/links/{id}:
 *   delete:
 *     summary: Delete a short link
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the short link to delete.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Short link deleted successfully.
 *       401:
 *         description: Unauthorized, API key missing or invalid.
 *       404:
 *         description: Link not found.
 */
async function deleteLink(req, res) {
  const { id } = req.params;

  try {
    await prisma.link.delete({
      where: { id: parseInt(id), apiKeyId: req.apiKey.id },
    });

    return res.json({ message: "Link deleted successfully" });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Link not found" });
    return res
      .status(400)
      .json({ error: "Link deletion failed", details: err.message });
  }
}

/**
 * @swagger
 * /api/links:
 *   get:
 *     summary: List all short links for the authenticated API key
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/offsetParam'
 *     responses:
 *       200:
 *         description: List of short links.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 links:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       slug:
 *                         type: string
 *                       destination:
 *                         type: string
 *                       title:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       description: Number of links returned
 *                     offset:
 *                       type: integer
 *                       description: Number of links skipped
 *                     total:
 *                       type: integer
 *                       description: Total number of links available
 *       401:
 *         description: Unauthorized, API key missing or invalid.
 */
async function listLinks(req, res) {
  const { limit, offset } = req.query;

  try {
    const links = await prisma.link.findMany({
      where: { apiKeyId: req.apiKey.id },
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.link.count({
      where: { apiKeyId: req.apiKey.id },
    });

    return res.json({
      links,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Failed to list links", details: err.message });
  }
}

/**
 * @swagger
 * /api/links/bulk:
 *   post:
 *     summary: Create multiple short links in bulk
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               links:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     destination:
 *                       type: string
 *                       description: The URL to shorten.
 *                       example: https://example.com/long-url
 *                     slug:
 *                       type: string
 *                       description: Optional custom slug for the short URL.
 *                       example: my-custom-slug
 *                     title:
 *                       type: string
 *                       description: Optional title for the link.
 *                       example: My Awesome Product Page
 *                     meta:
 *                       type: object
 *                       description: Optional metadata for the link.
 *                     password:
 *                       type: string
 *                       description: Optional password to protect the link.
 *                       example: mypassword
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: Optional expiration date for the link.
 *                       example: 2023-12-31T23:59:59Z
 *     responses:
 *       200:
 *         description: Short links created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 links:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       slug:
 *                         type: string
 *                       shortUrl:
 *                         type: string
 *       400:
 *         description: Invalid request or link creation failed.
 *       401:
 *         description: Unauthorized, API key missing or invalid.
 */
async function bulkCreateLinks(req, res) {
  const { links } = req.body;
  if (!links || !Array.isArray(links) || links.length === 0) {
    return res
      .status(400)
      .json({ error: "links array is required and must not be empty" });
  }

  try {
    const createdLinks = [];

    for (const linkData of links) {
      const { destination, slug, title, meta, password, expiresAt } = linkData;
      if (!destination) continue; // Skip invalid links

      const finalSlug = slug || uuidv4().slice(0, 8);

      // Hash password if provided
      let hashedPassword = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      const link = await prisma.link.create({
        data: {
          slug: finalSlug,
          destination,
          title,
          apiKeyId: req.apiKey.id,
          meta: meta || {},
          password: hashedPassword,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          webhookUrl,
        },
      });

      createdLinks.push({
        id: link.id,
        slug: link.slug,
        shortUrl: `${req.protocol}://${req.get("host")}/${link.slug}`,
      });
    }

    return res.json({ links: createdLinks });
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Bulk link creation failed", details: err.message });
  }
}

/**
 * @swagger
 * /api/links/bulk:
 *   put:
 *     summary: Update multiple short links in bulk
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: The ID of the link to update.
 *                       example: 1
 *                     destination:
 *                       type: string
 *                       description: The URL to shorten.
 *                       example: https://example.com/long-url
 *                     slug:
 *                       type: string
 *                       description: Optional custom slug for the short URL.
 *                       example: my-custom-slug
 *                     title:
 *                       type: string
 *                       description: Optional title for the link.
 *                       example: My Awesome Product Page
 *                     meta:
 *                       type: object
 *                       description: Optional metadata for the link.
 *                     password:
 *                       type: string
 *                       description: Optional password to protect the link.
 *                       example: mypassword
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: Optional expiration date for the link.
 *                       example: 2023-12-31T23:59:59Z
 *     responses:
 *       200:
 *         description: Short links updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updated:
 *                   type: integer
 *                   description: Number of links updated.
 *       400:
 *         description: Invalid request or link update failed.
 *       401:
 *         description: Unauthorized, API key missing or invalid.
 */
async function bulkUpdateLinks(req, res) {
  const { updates } = req.body;
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return res
      .status(400)
      .json({ error: "updates array is required and must not be empty" });
  }

  try {
    let updatedCount = 0;

    for (const updateData of updates) {
      const { id, destination, slug, title, meta, password, expiresAt } =
        updateData;

      // Hash password if provided
      let hashedPassword = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      await prisma.link.update({
        where: { id: parseInt(id), apiKeyId: req.apiKey.id },
        data: {
          destination,
          slug,
          title,
          meta: meta || {},
          password: hashedPassword,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          webhookUrl,
        },
      });

      updatedCount++;
    }

    return res.json({ updated: updatedCount });
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Bulk link update failed", details: err.message });
  }
}

/**
 * @swagger
 * /api/links/bulk:
 *   delete:
 *     summary: Delete multiple short links in bulk
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of link IDs to delete.
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Short links deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: integer
 *                   description: Number of links deleted.
 *       400:
 *         description: Invalid request or link deletion failed.
 *       401:
 *         description: Unauthorized, API key missing or invalid.
 */
async function bulkDeleteLinks(req, res) {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res
      .status(400)
      .json({ error: "ids array is required and must not be empty" });
  }

  try {
    const result = await prisma.link.deleteMany({
      where: {
        id: { in: ids.map((id) => parseInt(id)) },
        apiKeyId: req.apiKey.id,
      },
    });

    return res.json({ deleted: result.count });
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Bulk link deletion failed", details: err.message });
  }
}

module.exports = {
  createLink,
  getLinkStats,
  updateLink,
  deleteLink,
  listLinks,
  bulkCreateLinks,
  bulkUpdateLinks,
  bulkDeleteLinks,
};
