const express = require("express");
const bodyParser = require("body-parser");
const requestLogger = require("./middleware/requestLogger");
const rateLimiter = require("./middleware/rateLimiter");
const jwtAuth = require("./middleware/jwtAuth");
const apiKeyAuth = require("./middleware/apiKeyAuth");
const adminAuth = require("./middleware/adminAuth");
const paginationMiddleware = require("./middleware/pagination");
const {
  checkBillingEnabled,
  requireFeatureWithLimit,
  requireAnalyticsFeature,
  requireFeature,
} = require("./middleware/featureGate");
const authController = require("./controllers/auth.controller");
const passwordController = require("./controllers/password.controller");
const roleController = require("./controllers/role.controller");
const linksController = require("./controllers/links.controller");
const trackController = require("./controllers/track.controller");
const adminController = require("./controllers/admin.controller");
const reportController = require("./controllers/report.controller");
const subscriptionController = require("./controllers/subscription.controller");
const { setupSwagger, swaggerSpec } = require("./swagger");
const path = require("path");

const app = express();
app.set("trust proxy", 1); // Trust first proxy
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
); // Raw body for Stripe webhooks
app.use(requestLogger);
app.use(rateLimiter);

// Serve static files from frontend dist
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Billing middleware (checks if billing is enabled globally)
app.use(checkBillingEnabled);

// public api
app.post("/signup", authController.signup);
app.post("/login", authController.login);

// password reset
app.post("/password/reset-request", passwordController.requestPasswordReset);
app.post("/password/reset", passwordController.resetPassword);

// swagger docs
setupSwagger(app);
app.get("/swagger.json", (req, res) => res.json(swaggerSpec));

// API endpoints for authenticated users (JWT)
app.post("/api/api-keys", jwtAuth, authController.createApiKey);
app.put("/api/password", jwtAuth, passwordController.changePassword);

// Role management endpoints (admin only)
app.get("/api/roles", jwtAuth, adminAuth, roleController.getRoles);
app.post("/api/roles", jwtAuth, adminAuth, roleController.createRole);
app.put("/api/roles/:id", jwtAuth, adminAuth, roleController.updateRole);
app.delete("/api/roles/:id", jwtAuth, adminAuth, roleController.deleteRole);

// Role assignment endpoints (admin only)
app.post(
  "/api/users/roles",
  jwtAuth,
  adminAuth,
  roleController.assignRoleToUser
);
app.delete(
  "/api/users/:userId/roles/:roleId",
  jwtAuth,
  adminAuth,
  roleController.removeRoleFromUser
);
app.get(
  "/api/users/:userId/roles",
  jwtAuth,
  adminAuth,
  roleController.getUserRoles
);

// Permission management endpoints (admin only)
app.get("/api/permissions", jwtAuth, adminAuth, roleController.getPermissions);
app.post(
  "/api/permissions",
  jwtAuth,
  adminAuth,
  roleController.createPermission
);
app.post(
  "/api/roles/:roleId/permissions",
  jwtAuth,
  adminAuth,
  roleController.assignPermissionToRole
);
app.delete(
  "/api/roles/:roleId/permissions/:permissionId",
  jwtAuth,
  adminAuth,
  roleController.removePermissionFromRole
);

// API-key protected endpoints with feature gating
app.post(
  "/api/links",
  apiKeyAuth,
  requireFeatureWithLimit("links"),
  linksController.createLink
);
app.get(
  "/api/links",
  apiKeyAuth,
  requireFeatureWithLimit("links"),
  paginationMiddleware(20),
  linksController.listLinks
);
app.put("/api/links/:id", apiKeyAuth, linksController.updateLink);
app.delete("/api/links/:id", apiKeyAuth, linksController.deleteLink);
app.get(
  "/api/links/:slug/stats",
  apiKeyAuth,
  requireFeature("analytics"),
  linksController.getLinkStats
);
app.post(
  "/api/links/bulk",
  apiKeyAuth,
  requireFeatureWithLimit("links"),
  linksController.bulkCreateLinks
);
app.put("/api/links/bulk", apiKeyAuth, linksController.bulkUpdateLinks);
app.delete("/api/links/bulk", apiKeyAuth, linksController.bulkDeleteLinks);

// public redirect endpoint (tracks clicks)
app.get("/:slug", trackController.redirectHandler);

// admin routes
app.post("/admin/login", adminController.adminLogin);
app.get("/admin/logs", adminAuth, adminController.getLogs);
app.get("/admin/stats", adminAuth, adminController.getStats);
app.get("/admin/analytics", adminAuth, adminController.getAnalytics);

// admin user management
app.get("/admin/users", adminAuth, adminController.getAdminUsers);
app.post("/admin/users", adminAuth, adminController.createAdminUser);
app.put("/admin/users/:id", adminAuth, adminController.updateAdminUser);
app.delete("/admin/users/:id", adminAuth, adminController.deleteAdminUser);

// admin link management
// admin routes
app.post("/admin/login", adminController.adminLogin);
app.get("/admin/logs", adminAuth, adminController.getLogs);
app.get("/admin/stats", adminAuth, adminController.getStats);
app.get("/admin/analytics", adminAuth, adminController.getAnalytics);

// admin link management
app.get("/admin/links", adminAuth, adminController.getAllLinks);
app.post("/admin/links", adminAuth, adminController.createAdminLink);
app.put("/admin/links/:id", adminAuth, adminController.updateAdminLink);
app.delete("/admin/links/:id", adminAuth, adminController.deleteAdminLink);
app.delete("/admin/links", adminAuth, adminController.bulkDeleteAdminLinks);
app.get("/admin/tags", adminAuth, adminController.getAdminTags);

// admin activity logs
app.get("/admin/activity", adminAuth, adminController.getActivityLogs);
app.get("/admin/activity-logs", adminAuth, adminController.getActivityLogs);

// admin role management
app.get("/admin/roles", adminAuth, adminController.getAdminRoles);
app.post("/admin/roles", adminAuth, adminController.createAdminRole);
app.put("/admin/roles/:id", adminAuth, adminController.updateAdminRole);
app.delete("/admin/roles/:id", adminAuth, adminController.deleteAdminRole);

// admin permission management
app.get("/admin/permissions", adminAuth, adminController.getAdminPermissions);
app.post(
  "/admin/permissions",
  adminAuth,
  adminController.createAdminPermission
);

// admin user role management
app.post(
  "/admin/users/roles",
  adminAuth,
  adminController.assignRoleToAdminUser
);
app.delete(
  "/admin/users/:userId/roles/:roleId",
  adminAuth,
  adminController.removeRoleFromAdminUser
);
app.get(
  "/admin/users/:userId/roles",
  adminAuth,
  adminController.getAdminUserRoles
);

// Billing and subscription endpoints
app.get(
  "/api/billing/subscription",
  jwtAuth,
  subscriptionController.getSubscription
);
app.post(
  "/api/billing/subscription",
  jwtAuth,
  subscriptionController.createSubscription
);
app.put(
  "/api/billing/subscription",
  jwtAuth,
  subscriptionController.updateSubscription
);
app.delete(
  "/api/billing/subscription",
  jwtAuth,
  subscriptionController.cancelSubscription
);
app.post(
  "/api/billing/subscription/reactivate",
  jwtAuth,
  subscriptionController.reactivateSubscription
);
app.get("/api/billing/usage", jwtAuth, subscriptionController.getUsage);
app.get(
  "/api/billing/history",
  jwtAuth,
  subscriptionController.getBillingHistory
);
app.get("/api/billing/plans", subscriptionController.getPricingPlans);
app.post(
  "/api/billing/setup-intent",
  jwtAuth,
  subscriptionController.createSetupIntent
);

// Reports and analytics endpoints
app.get(
  "/api/reports/analytics",
  jwtAuth,
  requireAnalyticsFeature,
  reportController.getAnalytics
);
app.get(
  "/api/reports/generate",
  jwtAuth,
  requireAnalyticsFeature,
  reportController.generateReport
);
app.get(
  "/api/reports/export",
  jwtAuth,
  requireAnalyticsFeature,
  reportController.exportData
);
app.get(
  "/api/reports/types",
  jwtAuth,
  requireAnalyticsFeature,
  reportController.getExportTypes
);

// Scheduled reports (admin only)
app.post(
  "/api/reports/schedule",
  jwtAuth,
  adminAuth,
  reportController.scheduleEmailReport
);
app.get(
  "/api/reports/scheduled",
  jwtAuth,
  adminAuth,
  reportController.getScheduledReports
);
app.delete(
  "/api/reports/scheduled/:scheduleId",
  jwtAuth,
  adminAuth,
  reportController.cancelScheduledReport
);

// Stripe webhook endpoint (no auth required, uses signature verification)
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  subscriptionController.handleWebhook
);

// health
app.get("/health", (req, res) => res.json({ ok: true }));

// Catch-all handler for frontend: serve index.html for any non-API routes
app.use((req, res) => {
  // Skip if it's an admin route
  if (req.path.startsWith("/admin")) {
    return res.status(404).json({ error: "Not Found" });
  }
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

module.exports = app;
