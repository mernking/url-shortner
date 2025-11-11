const prisma = require('../prisma/client');
const ReportService = require('./report.service');
const AnalyticsService = require('./analytics.service');

class ExportService {
  /**
   * Export links data
   * @param {Object} options - Export options
   * @param {string} options.format - Export format (csv, xlsx, pdf)
   * @param {number} options.userId - User ID (optional, for filtering user's links)
   * @param {Date} options.startDate - Start date filter
   * @param {Date} options.endDate - End date filter
   * @param {boolean} options.includeInactive - Include inactive links
   * @returns {Buffer|string} Export data
   */
  static async exportLinks(options = {}) {
    const {
      format = 'csv',
      userId,
      startDate,
      endDate,
      includeInactive = true
    } = options;

    try {
      // Build where clause
      const whereClause = {};
      if (userId) {
        whereClause.createdById = userId;
      }
      if (!includeInactive) {
        whereClause.expiresAt = {
          gt: new Date()
        };
      }
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      const links = await prisma.link.findMany({
        where: whereClause,
        include: {
          tags: {
            select: { name: true }
          },
          clicks: {
            select: { id: true },
            where: startDate || endDate ? {
              createdAt: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate })
              }
            } : undefined
          },
          createdBy: {
            select: { name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Transform data for export
      const exportData = links.map(link => ({
        id: link.id,
        slug: link.slug,
        destination: link.destination,
        title: link.title,
        description: link.description,
        tags: link.tags.map(tag => tag.name).join(', '),
        clicks: link.clicks.length,
        hasPassword: !!link.password,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
        createdBy: link.createdBy?.name || link.createdBy?.email || 'Unknown'
      }));

      return await ReportService.exportData(format, 'links', exportData);
    } catch (error) {
      console.error('Error exporting links:', error);
      throw new Error('Failed to export links data');
    }
  }

  /**
   * Export analytics data
   * @param {Object} options - Export options
   * @param {string} options.format - Export format
   * @param {Date} options.startDate - Start date
   * @param {Date} options.endDate - End date
   * @param {number} options.userId - User ID (optional)
   * @returns {Buffer|string} Export data
   */
  static async exportAnalytics(options = {}) {
    const {
      format = 'xlsx',
      startDate,
      endDate,
      userId
    } = options;

    try {
      const analyticsOptions = {
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default 30 days
        endDate: endDate || new Date(),
        includeDeviceData: true,
        includeReferralData: true,
        includeTopLinks: true,
        topLinksLimit: 50
      };

      let analyticsData;
      if (userId) {
        analyticsData = await AnalyticsService.getUserAnalytics(userId, analyticsOptions);
      } else {
        analyticsData = await AnalyticsService.getAnalytics(analyticsOptions);
      }

      return await ReportService.exportData(format, 'analytics', analyticsData);
    } catch (error) {
      console.error('Error exporting analytics:', error);
      throw new Error('Failed to export analytics data');
    }
  }

  /**
   * Export users data (admin only)
   * @param {Object} options - Export options
   * @param {string} options.format - Export format
   * @param {boolean} options.includeAdmins - Include admin users
   * @param {Date} options.startDate - Start date filter
   * @param {Date} options.endDate - End date filter
   * @returns {Buffer|string} Export data
   */
  static async exportUsers(options = {}) {
    const {
      format = 'csv',
      includeAdmins = true,
      startDate,
      endDate
    } = options;

    try {
      const whereClause = {};
      if (!includeAdmins) {
        whereClause.isAdmin = false;
      }
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          createdAt: true,
          _count: {
            select: {
              apiKeys: true,
              links: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Transform data for export
      const exportData = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        apiKeysCount: user._count.apiKeys,
        linksCount: user._count.links,
        createdAt: user.createdAt
      }));

      return await ReportService.exportData(format, 'users', exportData);
    } catch (error) {
      console.error('Error exporting users:', error);
      throw new Error('Failed to export users data');
    }
  }

  /**
   * Export activity logs (admin only)
   * @param {Object} options - Export options
   * @param {string} options.format - Export format
   * @param {number} options.userId - Filter by user ID
   * @param {string} options.action - Filter by action
   * @param {string} options.resource - Filter by resource
   * @param {Date} options.startDate - Start date
   * @param {Date} options.endDate - End date
   * @returns {Buffer|string} Export data
   */
  static async exportActivityLogs(options = {}) {
    const {
      format = 'csv',
      userId,
      action,
      resource,
      startDate,
      endDate
    } = options;

    try {
      const whereClause = {};
      if (userId) whereClause.userId = userId;
      if (action) whereClause.action = action;
      if (resource) whereClause.resource = resource;
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      const logs = await prisma.activityLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10000 // Limit to prevent memory issues
      });

      // Transform data for export
      const exportData = logs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        userId: log.userId,
        userEmail: log.user?.email || 'Unknown',
        userName: log.user?.name || '',
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        details: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent
      }));

      return await ReportService.exportData(format, 'activity_logs', exportData);
    } catch (error) {
      console.error('Error exporting activity logs:', error);
      throw new Error('Failed to export activity logs');
    }
  }

  /**
   * Get supported export formats
   * @returns {Array<string>} List of supported formats
   */
  static getSupportedFormats() {
    return ['csv', 'xlsx', 'excel', 'pdf', 'html'];
  }

  /**
   * Get available export types
   * @returns {Array<Object>} List of export types with descriptions
   */
  static getExportTypes() {
    return [
      {
        type: 'links',
        description: 'Export links with click statistics',
        formats: ['csv', 'xlsx', 'pdf'],
        adminOnly: false
      },
      {
        type: 'analytics',
        description: 'Export analytics data and reports',
        formats: ['xlsx', 'pdf', 'html'],
        adminOnly: false
      },
      {
        type: 'users',
        description: 'Export user accounts data (admin only)',
        formats: ['csv', 'xlsx'],
        adminOnly: true
      },
      {
        type: 'activity_logs',
        description: 'Export activity logs (admin only)',
        formats: ['csv', 'xlsx'],
        adminOnly: true
      }
    ];
  }

  /**
   * Validate export options
   * @param {string} type - Export type
   * @param {string} format - Export format
   * @param {boolean} isAdmin - Whether user is admin
   * @returns {boolean} Whether options are valid
   */
  static validateExportOptions(type, format, isAdmin = false) {
    const exportTypes = this.getExportTypes();
    const supportedFormats = this.getSupportedFormats();

    const exportType = exportTypes.find(et => et.type === type);
    if (!exportType) {
      throw new Error(`Invalid export type: ${type}`);
    }

    if (exportType.adminOnly && !isAdmin) {
      throw new Error(`Export type ${type} requires admin privileges`);
    }

    if (!exportType.formats.includes(format)) {
      throw new Error(`Format ${format} not supported for export type ${type}`);
    }

    if (!supportedFormats.includes(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }

    return true;
  }
}

module.exports = ExportService;