const prisma = require('../prisma/client');

/**
 * Check if user has permission for a specific action on a resource
 */
async function checkPermission(userId, resource, action) {
  try {
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

    // Check if user has the required permission through any of their roles
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        const permission = rolePermission.permission;
        if (permission.resource === resource && permission.action === action) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

/**
 * Middleware to enforce role-based access control
 */
function requirePermission(resource, action) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is admin (backward compatibility)
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) }
      });

      if (user?.isAdmin) {
        return next();
      }

      // Check permissions through roles
      const hasPermission = await checkPermission(userId, resource, action);

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: `${action} on ${resource}`
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

/**
 * Middleware to check if user has any of the specified roles
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is admin (backward compatibility)
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) }
      });

      if (user?.isAdmin) {
        return next();
      }

      const userRoles = await prisma.userRole.findMany({
        where: { userId: parseInt(userId) },
        include: { role: true }
      });

      const userRoleNames = userRoles.map(ur => ur.role.name);

      const hasRequiredRole = allowedRoles.some(role =>
        userRoleNames.includes(role)
      );

      if (!hasRequiredRole) {
        return res.status(403).json({
          error: 'Insufficient role',
          required: allowedRoles,
          has: userRoleNames
        });
      }

      next();
    } catch (error) {
      console.error('Role check middleware error:', error);
      res.status(500).json({ error: 'Role check failed' });
    }
  };
}

/**
 * Get user permissions (helper function)
 */
async function getUserPermissions(userId) {
  try {
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

    const permissions = new Set();

    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        const permission = rolePermission.permission;
        permissions.add(`${permission.resource}:${permission.action}`);
      }
    }

    return Array.from(permissions);
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    return [];
  }
}

module.exports = {
  checkPermission,
  requirePermission,
  requireRole,
  getUserPermissions
};