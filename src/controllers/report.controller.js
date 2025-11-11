const AnalyticsService = require('../services/analytics.service');
const ExportService = require('../services/export.service');
const ReportService = require('../services/report.service');
const scheduledReportsService = require('../services/scheduled-reports.service');
const emailService = require('../services/email.service');

class ReportController {
  /**
   * Get analytics data with custom date range
   * GET /api/reports/analytics
   */
  static async getAnalytics(req, res) {
    try {
      const {
        startDate,
        endDate,
        includeDeviceData = 'true',
        includeReferralData = 'true',
        includeTopLinks = 'true',
        topLinksLimit = 10
      } = req.query;

      const options = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        includeDeviceData: includeDeviceData === 'true',
        includeReferralData: includeReferralData === 'true',
        includeTopLinks: includeTopLinks === 'true',
        topLinksLimit: parseInt(topLinksLimit) || 10
      };

      let analyticsData;
      if (req.user && !req.user.isAdmin) {
        // Regular user - get their own analytics
        analyticsData = await AnalyticsService.getUserAnalytics(req.user.id, options);
      } else {
        // Admin - get global analytics
        analyticsData = await AnalyticsService.getAnalytics(options);
      }

      res.json({
        success: true,
        data: analyticsData
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics data'
      });
    }
  }

  /**
   * Generate and download report
   * GET /api/reports/generate
   */
  static async generateReport(req, res) {
    try {
      const {
        format = 'pdf',
        type = 'analytics',
        startDate,
        endDate,
        includeDeviceData = 'true',
        includeReferralData = 'true',
        includeTopLinks = 'true'
      } = req.query;

      // Validate format and type
      ExportService.validateExportOptions(type, format, req.user?.isAdmin || false);

      let data;
      const options = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      switch (type) {
        case 'analytics':
          if (req.user && !req.user.isAdmin) {
            data = await AnalyticsService.getUserAnalytics(req.user.id, {
              ...options,
              includeDeviceData: includeDeviceData === 'true',
              includeReferralData: includeReferralData === 'true',
              includeTopLinks: includeTopLinks === 'true'
            });
          } else {
            data = await AnalyticsService.getAnalytics({
              ...options,
              includeDeviceData: includeDeviceData === 'true',
              includeReferralData: includeReferralData === 'true',
              includeTopLinks: includeTopLinks === 'true'
            });
          }
          break;

        case 'links':
          data = await ExportService.exportLinks({
            ...options,
            format,
            userId: req.user && !req.user.isAdmin ? req.user.id : undefined
          });
          break;

        case 'users':
          if (!req.user?.isAdmin) {
            return res.status(403).json({
              success: false,
              error: 'Admin access required for user exports'
            });
          }
          data = await ExportService.exportUsers({ ...options, format });
          break;

        case 'activity_logs':
          if (!req.user?.isAdmin) {
            return res.status(403).json({
              success: false,
              error: 'Admin access required for activity log exports'
            });
          }
          data = await ExportService.exportActivityLogs({ ...options, format });
          break;

        default:
          return res.status(400).json({
            success: false,
            error: `Unsupported report type: ${type}`
          });
      }

      // Set appropriate headers and send response
      const fileName = `${type}_report_${new Date().toISOString().split('T')[0]}`;

      switch (format) {
        case 'pdf':
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
          break;
        case 'xlsx':
        case 'excel':
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
          break;
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
          break;
        case 'html':
          res.setHeader('Content-Type', 'text/html');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}.html"`);
          break;
      }

      res.send(data);
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate report'
      });
    }
  }

  /**
   * Export data endpoint
   * GET /api/reports/export
   */
  static async exportData(req, res) {
    try {
      const {
        type,
        format = 'csv',
        startDate,
        endDate,
        userId,
        action,
        resource,
        includeInactive = 'true',
        includeAdmins = 'true'
      } = req.query;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Export type is required'
        });
      }

      // Validate permissions and options
      ExportService.validateExportOptions(type, format, req.user?.isAdmin || false);

      const options = {
        format,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      };

      // Add type-specific options
      switch (type) {
        case 'links':
          options.userId = req.user && !req.user.isAdmin ? req.user.id : userId ? parseInt(userId) : undefined;
          options.includeInactive = includeInactive === 'true';
          break;
        case 'users':
          options.includeAdmins = includeAdmins === 'true';
          break;
        case 'activity_logs':
          options.userId = userId ? parseInt(userId) : undefined;
          options.action = action;
          options.resource = resource;
          break;
      }

      let exportData;
      switch (type) {
        case 'links':
          exportData = await ExportService.exportLinks(options);
          break;
        case 'analytics':
          exportData = await ExportService.exportAnalytics(options);
          break;
        case 'users':
          exportData = await ExportService.exportUsers(options);
          break;
        case 'activity_logs':
          exportData = await ExportService.exportActivityLogs(options);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: `Unsupported export type: ${type}`
          });
      }

      // Set response headers
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `${type}_export_${timestamp}`;

      switch (format) {
        case 'pdf':
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
          break;
        case 'xlsx':
        case 'excel':
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
          break;
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
          break;
        case 'html':
          res.setHeader('Content-Type', 'text/html');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}.html"`);
          break;
      }

      res.send(exportData);
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to export data'
      });
    }
  }

  /**
   * Get export types and formats
   * GET /api/reports/types
   */
  static async getExportTypes(req, res) {
    try {
      const exportTypes = ExportService.getExportTypes();
      const supportedFormats = ExportService.getSupportedFormats();

      res.json({
        success: true,
        data: {
          exportTypes,
          supportedFormats,
          userIsAdmin: req.user?.isAdmin || false
        }
      });
    } catch (error) {
      console.error('Error fetching export types:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export types'
      });
    }
  }

  /**
   * Schedule email report (admin only)
   * POST /api/reports/schedule
   */
  static async scheduleEmailReport(req, res) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const {
        email,
        frequency, // 'daily', 'weekly', 'monthly'
        reportType = 'analytics',
        format = 'pdf',
        startDate,
        endDate,
        time = '09:00' // Default 9 AM
      } = req.body;

      if (!email || !frequency) {
        return res.status(400).json({
          success: false,
          error: 'Email and frequency are required'
        });
      }

      // Validate frequency
      const validFrequencies = ['daily', 'weekly', 'monthly'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid frequency. Must be daily, weekly, or monthly'
        });
      }

      // Validate report type and format
      ExportService.validateExportOptions(reportType, format, true);

      // Schedule the report using the service
      const scheduleOptions = {
        email,
        frequency,
        reportType,
        format,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        time,
        userId: req.user.id // Admin user who created the schedule
      };

      const scheduleId = await scheduledReportsService.scheduleReport(scheduleOptions);

      res.json({
        success: true,
        data: {
          scheduleId,
          email,
          frequency,
          reportType,
          format,
          time,
          nextRun: ReportController.calculateNextRun(frequency, time)
        },
        message: 'Email report scheduled successfully'
      });
    } catch (error) {
      console.error('Error scheduling email report:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to schedule email report'
      });
    }
  }

  /**
   * Get scheduled reports (admin only)
   * GET /api/reports/scheduled
   */
  static async getScheduledReports(req, res) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const scheduledReports = scheduledReportsService.getScheduledReports();

      res.json({
        success: true,
        data: scheduledReports
      });
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch scheduled reports'
      });
    }
  }

  /**
   * Cancel scheduled report (admin only)
   * DELETE /api/reports/scheduled/:scheduleId
   */
  static async cancelScheduledReport(req, res) {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const { scheduleId } = req.params;

      const cancelled = scheduledReportsService.cancelScheduledReport(scheduleId);

      if (cancelled) {
        res.json({
          success: true,
          message: 'Scheduled report cancelled successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Scheduled report not found'
        });
      }
    } catch (error) {
      console.error('Error cancelling scheduled report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel scheduled report'
      });
    }
  }

  /**
   * Calculate next run time based on frequency
   */
  static calculateNextRun(frequency, time) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    let nextRun = new Date(now);

    nextRun.setHours(hours, minutes, 0, 0);

    switch (frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      case 'weekly':
        nextRun.setDate(now.getDate() + (7 - now.getDay()));
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 7);
        }
        break;
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1, 1);
        break;
    }

    return nextRun;
  }
}

module.exports = ReportController;