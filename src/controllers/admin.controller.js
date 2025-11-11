const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const UAParser = require("ua-parser-js");
const prisma = new PrismaClient();

async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access only" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
}

async function getLogs(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const logs = await prisma.requestLog.findMany({
      orderBy: { time: "desc" },
      skip: offset,
      take: parseInt(limit),
      where: {
        country: { not: null },
        city: { not: null },
      },
    });

    const total = await prisma.requestLog.count();

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
}

async function getStats(req, res) {
  try {
    const totalLogs = await prisma.requestLog.count();
    const uniqueIPs = await prisma.requestLog.findMany({
      select: { ip: true },
      distinct: ["ip"],
    });
    const uniqueCountries = await prisma.requestLog.findMany({
      select: { country: true },
      distinct: ["country"],
      where: { country: { not: null } },
    });

    // Get request trends for the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyStats = await prisma.$queryRaw`
      SELECT
        strftime('%H', time) as hour,
        COUNT(*) as count
      FROM RequestLog
      WHERE time >= ${last24Hours}
      GROUP BY strftime('%H', time)
      ORDER BY hour
    `;

    // Get top countries
    const topCountries = await prisma.requestLog.groupBy({
      by: ["country"],
      where: { country: { not: null } },
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    });

    // Get HTTP method distribution
    const methodStats = await prisma.requestLog.groupBy({
      by: ["method"],
      _count: { method: true },
    });

    // Convert BigInt to number for JSON serialization
    const convertedHourlyStats = hourlyStats.map((stat) => ({
      hour: stat.hour,
      count: Number(stat.count),
    }));

    const convertedTopCountries = topCountries.map((country) => ({
      country: country.country,
      count: Number(country._count.country),
    }));

    const convertedMethodStats = methodStats.map((method) => ({
      method: method.method,
      count: Number(method._count.method),
    }));

    res.json({
      totalRequests: totalLogs,
      uniqueIPs: uniqueIPs.length,
      uniqueCountries: uniqueCountries.length,
      hourlyStats: convertedHourlyStats,
      topCountries: convertedTopCountries,
      methodStats: convertedMethodStats,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}

async function getAnalytics(req, res) {
  try {
    // Request trends for last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyStatsRaw = await prisma.$queryRaw`
      SELECT
        DATE(time) as date,
        COUNT(*) as count
      FROM RequestLog
      WHERE time >= ${sevenDaysAgo}
      GROUP BY DATE(time)
      ORDER BY date
    `;

    // Hourly breakdown for last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyStatsRaw = await prisma.$queryRaw`
      SELECT
        strftime('%H', time) as hour,
        COUNT(*) as count
      FROM RequestLog
      WHERE time >= ${last24Hours}
      GROUP BY strftime('%H', time)
      ORDER BY hour
    `;

    // Convert BigInt to number for JSON serialization
    const dailyStats = dailyStatsRaw.map((stat) => ({
      date: stat.date,
      count: Number(stat.count),
    }));

    const hourlyStats = hourlyStatsRaw.map((stat) => ({
      hour: stat.hour,
      count: Number(stat.count),
    }));

    // Top performing links (most clicks)
    const topLinks = await prisma.link.findMany({
      select: {
        slug: true,
        destination: true,
        title: true,
        _count: {
          select: { clicks: true },
        },
      },
      orderBy: {
        clicks: {
          _count: "desc",
        },
      },
      take: 10,
    });

    // Device and browser breakdown
    const clicks = await prisma.click.findMany({
      select: { ua: true },
      where: { ua: { not: null } },
    });

    const deviceBreakdown = {};
    const browserBreakdown = {};
    const osBreakdown = {};

    clicks.forEach((click) => {
      if (click.ua) {
        const parser = new UAParser(click.ua);
        const result = parser.getResult();

        // Device type
        const deviceType = result.device.type || "desktop";
        deviceBreakdown[deviceType] = (deviceBreakdown[deviceType] || 0) + 1;

        // Browser
        const browser = result.browser.name || "Unknown";
        browserBreakdown[browser] = (browserBreakdown[browser] || 0) + 1;

        // OS
        const os = result.os.name || "Unknown";
        osBreakdown[os] = (osBreakdown[os] || 0) + 1;
      }
    });

    // Referral source analysis with categorization
    const referrerClicks = await prisma.click.findMany({
      select: { referrer: true },
      where: { referrer: { not: null } },
    });

    const referralSources = {};
    const referralCategories = {
      search: 0,
      social: 0,
      direct: 0,
      other: 0,
    };

    referrerClicks.forEach((click) => {
      if (click.referrer) {
        const url = new URL(click.referrer);
        const domain = url.hostname.toLowerCase();

        referralSources[domain] = (referralSources[domain] || 0) + 1;

        // Categorize referral source
        if (
          domain.includes("google") ||
          domain.includes("bing") ||
          domain.includes("yahoo") ||
          domain.includes("duckduckgo")
        ) {
          referralCategories.search++;
        } else if (
          domain.includes("facebook") ||
          domain.includes("twitter") ||
          domain.includes("instagram") ||
          domain.includes("linkedin") ||
          domain.includes("tiktok")
        ) {
          referralCategories.social++;
        } else if (domain === "direct" || domain === "") {
          referralCategories.direct++;
        } else {
          referralCategories.other++;
        }
      }
    });

    // Top 10 referral sources
    const topReferrers = Object.entries(referralSources)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    res.json({
      timeBasedAnalytics: {
        dailyStats,
        hourlyStats,
      },
      deviceBrowserAnalytics: {
        deviceBreakdown,
        browserBreakdown,
        osBreakdown,
      },
      referralAnalytics: {
        topReferrers,
        referralCategories,
      },
      topLinks,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
}

// Admin link management endpoints

async function getAllLinks(req, res) {
  try {
    const { page = 1, limit = 50, search, filter } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    // Search functionality
    if (search) {
      whereClause.OR = [
        { slug: { contains: search, mode: "insensitive" } },
        { destination: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter functionality
    if (filter) {
      const filters = JSON.parse(filter);
      if (filters.hasPassword !== undefined) {
        whereClause.password = filters.hasPassword ? { not: null } : null;
      }
      if (filters.hasExpiration !== undefined) {
        whereClause.expiresAt = filters.hasExpiration ? { not: null } : null;
      }
      if (filters.expired !== undefined) {
        whereClause.expiresAt = filters.expired
          ? { lt: new Date() }
          : { gt: new Date() };
      }
    }

    const links = await prisma.link.findMany({
      where: whereClause,
      include: {
        tags: true,
        clicks: { select: { id: true } }, // Only count clicks
        createdBy: {
          select: { name: true, user: { select: { email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: parseInt(limit),
    });

    const total = await prisma.link.count({ where: whereClause });

    res.json({
      links: links.map((link) => ({
        ...link,
        clicksCount: link.clicks.length,
        clicks: undefined, // Remove the clicks array
        apiKey: undefined, // Remove apiKey
        createdBy: link.createdBy,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch links" });
  }
}

async function createAdminLink(req, res) {
  try {
    const { destination, slug, title, password, expiresAt, tags, apiKeyId } =
      req.body;

    if (!destination)
      return res.status(400).json({ error: "destination is required" });

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const link = await prisma.link.create({
      data: {
        slug: slug || uuidv4().slice(0, 8),
        destination,
        title,
        apiKeyId: apiKeyId || 1, // Default to first API key if not specified
        password: hashedPassword,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        tags: tags
          ? {
              connectOrCreate: tags.map((tagName) => ({
                where: { name: tagName },
                create: { name: tagName },
              })),
            }
          : undefined,
      },
      include: { tags: true },
    });

    res.json({
      ...link,
      shortUrl: `${req.protocol}://${req.get("host")}/${link.slug}`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create link" });
  }
}

async function updateAdminLink(req, res) {
  try {
    const { id } = req.params;
    const { destination, slug, title, password, expiresAt, tags } = req.body;

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const link = await prisma.link.update({
      where: { id: parseInt(id) },
      data: {
        destination,
        slug,
        title,
        password: hashedPassword,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        tags: tags
          ? {
              set: [],
              connectOrCreate: tags.map((tagName) => ({
                where: { name: tagName },
                create: { name: tagName },
              })),
            }
          : undefined,
      },
      include: { tags: true },
    });

    res.json({
      ...link,
      shortUrl: `${req.protocol}://${req.get("host")}/${link.slug}`,
    });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ error: "Link not found" });
    res.status(500).json({ error: "Failed to update link" });
  }
}

async function deleteAdminLink(req, res) {
  try {
    const { id } = req.params;
    await prisma.link.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: "Link deleted successfully" });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ error: "Link not found" });
    res.status(500).json({ error: "Failed to delete link" });
  }
}

async function bulkDeleteAdminLinks(req, res) {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids))
      return res.status(400).json({ error: "ids array is required" });

    const result = await prisma.link.deleteMany({
      where: { id: { in: ids.map((id) => parseInt(id)) } },
    });

    res.json({ deleted: result.count });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete links" });
  }
}

async function getAdminTags(req, res) {
  try {
    const tags = await prisma.tag.findMany({
      include: { _count: { select: { links: true } } },
    });
    res.json({ tags });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tags" });
  }
}

async function getActivityLogs(req, res) {
  try {
    const { page = 1, limit = 50, userId, action, resource } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    if (userId) whereClause.userId = parseInt(userId);
    if (action) whereClause.action = action;
    if (resource) whereClause.resource = resource;

    const logs = await prisma.activityLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const total = await prisma.activityLog.count({ where: whereClause });

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
}

// Role and permission management endpoints

async function getAdminRoles(req, res) {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: { userRoles: true }
        },
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    res.json({ roles });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
}

async function createAdminRole(req, res) {
  try {
    const { name, description, permissionIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const existingRole = await prisma.role.findUnique({
      where: { name }
    });

    if (existingRole) {
      return res.status(409).json({ error: 'Role with this name already exists' });
    }

    const role = await prisma.role.create({
      data: {
        name,
        description,
        rolePermissions: permissionIds ? {
          create: permissionIds.map(permissionId => ({
            permissionId: parseInt(permissionId)
          }))
        } : undefined
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    res.status(201).json(role);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create role' });
  }
}

async function updateAdminRole(req, res) {
  try {
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;

    const role = await prisma.role.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        rolePermissions: permissionIds ? {
          set: permissionIds.map(permissionId => ({
            roleId_permissionId: {
              roleId: parseInt(id),
              permissionId: parseInt(permissionId)
            }
          }))
        } : undefined
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    res.json(role);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.status(500).json({ error: 'Failed to update role' });
  }
}

async function deleteAdminRole(req, res) {
  try {
    const { id } = req.params;
    await prisma.role.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.status(500).json({ error: 'Failed to delete role' });
  }
}

async function getAdminPermissions(req, res) {
  try {
    const permissions = await prisma.permission.findMany({
      include: {
        _count: {
          select: { rolePermissions: true }
        }
      }
    });

    res.json({ permissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
}

async function createAdminPermission(req, res) {
  try {
    const { name, description, resource, action } = req.body;

    if (!name || !resource || !action) {
      return res.status(400).json({ error: 'name, resource, and action are required' });
    }

    const existingPermission = await prisma.permission.findUnique({
      where: { name }
    });

    if (existingPermission) {
      return res.status(409).json({ error: 'Permission with this name already exists' });
    }

    const permission = await prisma.permission.create({
      data: { name, description, resource, action }
    });

    res.status(201).json(permission);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create permission' });
  }
}

async function assignRoleToAdminUser(req, res) {
  try {
    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({ error: 'userId and roleId are required' });
    }

    const userRole = await prisma.userRole.create({
      data: {
        userId: parseInt(userId),
        roleId: parseInt(roleId)
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        role: true
      }
    });

    res.status(201).json(userRole);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'User already has this role' });
    }
    res.status(500).json({ error: 'Failed to assign role' });
  }
}

async function removeRoleFromAdminUser(req, res) {
  try {
    const { userId, roleId } = req.params;

    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: parseInt(userId),
          roleId: parseInt(roleId)
        }
      }
    });

    res.json({ message: 'Role removed from user successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User role assignment not found' });
    }
    res.status(500).json({ error: 'Failed to remove role' });
  }
}

async function getAdminUserRoles(req, res) {
  try {
    const { userId } = req.params;

    const userRoles = await prisma.userRole.findMany({
      where: { userId: parseInt(userId) },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    res.json({ userRoles });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
}

module.exports = {
  adminLogin,
  getLogs,
  getStats,
  getAnalytics,
  getAllLinks,
  createAdminLink,
  updateAdminLink,
  deleteAdminLink,
  bulkDeleteAdminLinks,
  getAdminTags,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getActivityLogs,
  getAdminRoles,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  getAdminPermissions,
  createAdminPermission,
  assignRoleToAdminUser,
  removeRoleFromAdminUser,
  getAdminUserRoles,
};
// Admin user management endpoints

async function getAdminUsers(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: {
          select: { apiKeys: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: parseInt(limit),
    });

    const total = await prisma.user.count({ where: { isAdmin: true } });

    res.json({
      users: adminUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin users" });
  }
}

async function createAdminUser(req, res) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdminUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        isAdmin: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    res.status(201).json(newAdminUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to create admin user" });
  }
}

async function updateAdminUser(req, res) {
  try {
    const { id } = req.params;
    const { email, name, isAdmin } = req.body;

    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ error: "Admin user not found" });
    res.status(500).json({ error: "Failed to update admin user" });
  }
}

async function deleteAdminUser(req, res) {
  try {
    const { id } = req.params;

    // Prevent deletion of the last admin user
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return res
        .status(400)
        .json({ error: "Cannot delete the last admin user" });
    }

    await prisma.user.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Admin user deleted successfully" });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ error: "Admin user not found" });
    res.status(500).json({ error: "Failed to delete admin user" });
  }
}
