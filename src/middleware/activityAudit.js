const prisma = require('../prisma/client');

/**
 * Middleware to log user activities
 */
function logActivity(action, resource, getResourceId = null, getDetails = null) {
  return async (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;

    // Override response methods to log after response is sent
    res.send = function(data) {
      logAfterResponse(req, res, data, action, resource, getResourceId, getDetails);
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      logAfterResponse(req, res, data, action, resource, getResourceId, getDetails);
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Log activity after response is sent
 */
async function logAfterResponse(req, res, data, action, resource, getResourceId, getDetails) {
  try {
    // Only log successful operations (status codes 200-299)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const userId = req.user?.userId;
      let resourceId = null;
      let details = null;

      // Extract resource ID if function provided
      if (getResourceId && typeof getResourceId === 'function') {
        resourceId = getResourceId(req, res, data);
      } else if (req.params.id) {
        resourceId = req.params.id;
      }

      // Extract additional details if function provided
      if (getDetails && typeof getDetails === 'function') {
        details = getDetails(req, res, data);
      }

      // Extract IP address
      const ip = req.ip ||
                 req.connection.remoteAddress ||
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);

      // Extract user agent
      const userAgent = req.get('User-Agent');

      await prisma.activityLog.create({
        data: {
          userId: userId ? parseInt(userId) : null,
          action,
          resource,
          resourceId: resourceId ? String(resourceId) : null,
          details,
          ip,
          userAgent
        }
      });
    }
  } catch (error) {
    // Log error but don't fail the request
    console.error('Activity logging failed:', error);
  }
}

/**
 * Specific activity logging middleware functions
 */

// User management activities
const logUserCreation = logActivity(
  'CREATE',
  'USER',
  (req, res, data) => data.id,
  (req, res, data) => ({ email: data.email, name: data.name })
);

const logUserUpdate = logActivity(
  'UPDATE',
  'USER',
  (req, res, data) => req.params.id || data.id,
  (req, res, data) => ({ changes: req.body })
);

const logUserDeletion = logActivity(
  'DELETE',
  'USER',
  (req, res, data) => req.params.id
);

// Role management activities
const logRoleCreation = logActivity(
  'CREATE',
  'ROLE',
  (req, res, data) => data.id,
  (req, res, data) => ({ name: data.name, description: data.description })
);

const logRoleAssignment = logActivity(
  'ASSIGN',
  'ROLE',
  (req, res, data) => data.roleId,
  (req, res, data) => ({ userId: data.userId, roleName: data.role?.name })
);

const logRoleRemoval = logActivity(
  'REMOVE',
  'ROLE',
  (req, res, data) => req.params.roleId,
  (req, res, data) => ({ userId: req.params.userId })
);

// Link management activities
const logLinkCreation = logActivity(
  'CREATE',
  'LINK',
  (req, res, data) => data.id,
  (req, res, data) => ({ slug: data.slug, destination: data.destination })
);

const logLinkUpdate = logActivity(
  'UPDATE',
  'LINK',
  (req, res, data) => req.params.id || data.id,
  (req, res, data) => ({ changes: req.body })
);

const logLinkDeletion = logActivity(
  'DELETE',
  'LINK',
  (req, res, data) => req.params.id
);

// API key activities
const logApiKeyCreation = logActivity(
  'CREATE',
  'API_KEY',
  (req, res, data) => data.id,
  (req, res, data) => ({ name: data.name, key: data.apiKey })
);

const logApiKeyDeletion = logActivity(
  'DELETE',
  'API_KEY',
  (req, res, data) => req.params.id
);

// Authentication activities
const logLogin = logActivity(
  'LOGIN',
  'AUTH',
  null,
  (req, res, data) => ({ method: 'password', email: req.body.email })
);

const logPasswordReset = logActivity(
  'RESET',
  'PASSWORD',
  null,
  (req, res, data) => ({ email: req.body.email })
);

const logPasswordChange = logActivity(
  'CHANGE',
  'PASSWORD',
  null,
  (req, res, data) => ({ userId: req.user?.userId })
);

module.exports = {
  logActivity,
  logUserCreation,
  logUserUpdate,
  logUserDeletion,
  logRoleCreation,
  logRoleAssignment,
  logRoleRemoval,
  logLinkCreation,
  logLinkUpdate,
  logLinkDeletion,
  logApiKeyCreation,
  logApiKeyDeletion,
  logLogin,
  logPasswordReset,
  logPasswordChange
};