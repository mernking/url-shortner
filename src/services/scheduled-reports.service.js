const cron = require('node-cron');
const AnalyticsService = require('./analytics.service');
const ReportService = require('./report.service');
const emailService = require('./email.service');
const prisma = require('../prisma/client');

class ScheduledReportsService {
  constructor() {
    this.scheduledJobs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the scheduled reports service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load existing scheduled reports from database
      await this.loadScheduledReports();
      this.initialized = true;
      console.log('Scheduled reports service initialized');
    } catch (error) {
      console.error('Failed to initialize scheduled reports service:', error);
    }
  }

  /**
   * Load scheduled reports from database
   */
  async loadScheduledReports() {
    try {
      // This would typically load from a scheduled_reports table
      // For now, we'll initialize with any hardcoded schedules if needed
      // const schedules = await prisma.scheduledReport.findMany();

      // For demonstration, we'll set up some example schedules
      // In a real implementation, these would come from the database
    } catch (error) {
      console.error('Error loading scheduled reports:', error);
    }
  }

  /**
   * Schedule a new email report
   * @param {Object} options - Schedule options
   * @returns {string} Schedule ID
   */
  async scheduleReport(options) {
    const {
      email,
      frequency, // 'daily', 'weekly', 'monthly'
      reportType = 'analytics',
      format = 'pdf',
      time = '09:00',
      startDate,
      endDate,
      userId, // For user-specific reports
      isActive = true
    } = options;

    // Generate schedule ID
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate cron expression
    const cronExpression = this.getCronExpression(frequency, time);

    // Create cron job
    const job = cron.schedule(cronExpression, async () => {
      try {
        await this.executeScheduledReport(scheduleId, options);
      } catch (error) {
        console.error(`Error executing scheduled report ${scheduleId}:`, error);
      }
    }, {
      scheduled: isActive
    });

    // Store job reference
    this.scheduledJobs.set(scheduleId, {
      job,
      options: { ...options, scheduleId },
      createdAt: new Date(),
      lastRun: null,
      nextRun: this.calculateNextRun(frequency, time)
    });

    console.log(`Scheduled report ${scheduleId} created for ${email} (${frequency})`);
    return scheduleId;
  }

  /**
   * Execute a scheduled report
   * @param {string} scheduleId - Schedule ID
   * @param {Object} options - Report options
   */
  async executeScheduledReport(scheduleId, options) {
    const {
      email,
      reportType,
      format,
      startDate,
      endDate,
      userId
    } = options;

    try {
      console.log(`Executing scheduled report ${scheduleId} for ${email}`);

      // Get analytics data
      let analyticsData;
      const analyticsOptions = {
        startDate: startDate ? new Date(startDate) : this.getDefaultStartDate(reportType),
        endDate: endDate ? new Date(endDate) : new Date(),
        includeDeviceData: true,
        includeReferralData: true,
        includeTopLinks: true
      };

      if (userId) {
        analyticsData = await AnalyticsService.getUserAnalytics(userId, analyticsOptions);
      } else {
        analyticsData = await AnalyticsService.getAnalytics(analyticsOptions);
      }

      // Generate report
      let reportBuffer;
      let attachmentName;
      let contentType;

      switch (format) {
        case 'pdf':
          reportBuffer = await ReportService.generatePDFReport(analyticsData, 'pdf');
          attachmentName = `analytics_report_${new Date().toISOString().split('T')[0]}.pdf`;
          contentType = 'application/pdf';
          break;
        case 'xlsx':
          reportBuffer = ReportService.generateExcelExport(analyticsData, 'analytics');
          attachmentName = `analytics_report_${new Date().toISOString().split('T')[0]}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'csv':
          reportBuffer = ReportService.generateCSVExport(analyticsData.timeBasedAnalytics.dailyStats, 'analytics');
          attachmentName = `analytics_report_${new Date().toISOString().split('T')[0]}.csv`;
          contentType = 'text/csv';
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Send email with attachment
      const subject = `Scheduled Analytics Report - ${new Date().toLocaleDateString()}`;
      const htmlBody = this.generateReportEmailBody(reportType, analyticsData);

      await emailService.sendEmail(email, subject, htmlBody, [{
        filename: attachmentName,
        content: reportBuffer,
        contentType
      }]);

      // Update last run time
      const jobData = this.scheduledJobs.get(scheduleId);
      if (jobData) {
        jobData.lastRun = new Date();
        jobData.nextRun = this.calculateNextRun(options.frequency, options.time);
      }

      console.log(`Scheduled report ${scheduleId} sent successfully to ${email}`);

    } catch (error) {
      console.error(`Failed to execute scheduled report ${scheduleId}:`, error);

      // Send error notification email
      try {
        await emailService.sendEmail(
          email,
          'Scheduled Report Failed',
          `Your scheduled ${reportType} report failed to generate. Error: ${error.message}`,
          []
        );
      } catch (emailError) {
        console.error('Failed to send error notification:', emailError);
      }
    }
  }

  /**
   * Cancel a scheduled report
   * @param {string} scheduleId - Schedule ID
   */
  cancelScheduledReport(scheduleId) {
    const jobData = this.scheduledJobs.get(scheduleId);
    if (jobData) {
      jobData.job.destroy();
      this.scheduledJobs.delete(scheduleId);
      console.log(`Scheduled report ${scheduleId} cancelled`);
      return true;
    }
    return false;
  }

  /**
   * Get all scheduled reports
   * @returns {Array} List of scheduled reports
   */
  getScheduledReports() {
    return Array.from(this.scheduledJobs.entries()).map(([scheduleId, data]) => ({
      scheduleId,
      ...data.options,
      createdAt: data.createdAt,
      lastRun: data.lastRun,
      nextRun: data.nextRun,
      isActive: data.job.destroyed === false
    }));
  }

  /**
   * Update a scheduled report
   * @param {string} scheduleId - Schedule ID
   * @param {Object} updates - Updated options
   */
  updateScheduledReport(scheduleId, updates) {
    const jobData = this.scheduledJobs.get(scheduleId);
    if (!jobData) {
      throw new Error('Scheduled report not found');
    }

    // Cancel existing job
    jobData.job.destroy();

    // Update options
    const newOptions = { ...jobData.options, ...updates };

    // Create new job
    const cronExpression = this.getCronExpression(newOptions.frequency, newOptions.time);
    const newJob = cron.schedule(cronExpression, async () => {
      try {
        await this.executeScheduledReport(scheduleId, newOptions);
      } catch (error) {
        console.error(`Error executing scheduled report ${scheduleId}:`, error);
      }
    });

    // Update stored data
    this.scheduledJobs.set(scheduleId, {
      ...jobData,
      job: newJob,
      options: newOptions,
      nextRun: this.calculateNextRun(newOptions.frequency, newOptions.time)
    });

    return scheduleId;
  }

  /**
   * Get cron expression for frequency and time
   * @param {string} frequency - 'daily', 'weekly', 'monthly'
   * @param {string} time - Time in HH:MM format
   * @returns {string} Cron expression
   */
  getCronExpression(frequency, time) {
    const [hours, minutes] = time.split(':');

    switch (frequency) {
      case 'daily':
        return `${minutes} ${hours} * * *`;
      case 'weekly':
        // Run every Monday at specified time
        return `${minutes} ${hours} * * 1`;
      case 'monthly':
        // Run on the 1st of every month at specified time
        return `${minutes} ${hours} 1 * *`;
      default:
        throw new Error(`Invalid frequency: ${frequency}`);
    }
  }

  /**
   * Calculate next run time
   * @param {string} frequency - Frequency
   * @param {string} time - Time
   * @returns {Date} Next run date
   */
  calculateNextRun(frequency, time) {
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
        // Next Monday
        const daysUntilMonday = (8 - now.getDay()) % 7;
        nextRun.setDate(now.getDate() + (daysUntilMonday || 7));
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 7);
        }
        break;
      case 'monthly':
        // 1st of next month
        nextRun.setMonth(now.getMonth() + 1, 1);
        break;
    }

    return nextRun;
  }

  /**
   * Get default start date for report type
   * @param {string} reportType - Report type
   * @returns {Date} Default start date
   */
  getDefaultStartDate(reportType) {
    const now = new Date();
    switch (reportType) {
      case 'analytics':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      case 'monthly':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Generate email body for report
   * @param {string} reportType - Report type
   * @param {Object} data - Report data
   * @returns {string} HTML email body
   */
  generateReportEmailBody(reportType, data) {
    const date = new Date().toLocaleDateString();
    const summary = data.summary;

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</h1>
        <p>Generated on ${date}</p>
    </div>

    <div class="content">
        <h2>Report Summary</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>${summary.totalRequests?.toLocaleString() || 'N/A'}</h3>
                <p>Total Requests</p>
            </div>
            <div class="stat-card">
                <h3>${summary.uniqueIPs || 'N/A'}</h3>
                <p>Unique IPs</p>
            </div>
            <div class="stat-card">
                <h3>${summary.uniqueCountries || 'N/A'}</h3>
                <p>Countries</p>
            </div>
        </div>

        <p>This report contains detailed analytics for the selected period. The attachment includes comprehensive data and charts.</p>

        <p>If you have any questions about this report, please contact the system administrator.</p>
    </div>

    <div class="footer">
        <p>This is an automated email from the URL Shortener Analytics System.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Clean up all scheduled jobs
   */
  cleanup() {
    for (const [scheduleId, jobData] of this.scheduledJobs) {
      jobData.job.destroy();
    }
    this.scheduledJobs.clear();
    console.log('Scheduled reports service cleaned up');
  }
}

// Create singleton instance
const scheduledReportsService = new ScheduledReportsService();

module.exports = scheduledReportsService;