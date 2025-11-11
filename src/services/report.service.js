const puppeteer = require('puppeteer');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs').promises;
const AnalyticsService = require('./analytics.service');

class ReportService {
  /**
   * Generate PDF report
   * @param {Object} analyticsData - Analytics data from AnalyticsService
   * @param {string} format - 'html' or 'pdf'
   * @returns {Buffer|string} PDF buffer or HTML string
   */
  static async generatePDFReport(analyticsData, format = 'pdf') {
    const html = this.generateReportHTML(analyticsData);

    if (format === 'html') {
      return html;
    }

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      });

      await browser.close();
      return pdfBuffer;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF report');
    }
  }

  /**
   * Generate CSV export
   * @param {Object} data - Data to export
   * @param {string} type - Type of data ('links', 'analytics', 'users')
   * @returns {string} CSV string
   */
  static generateCSVExport(data, type) {
    let csvData;
    let fields;

    switch (type) {
      case 'links':
        fields = ['id', 'slug', 'destination', 'title', 'clicks', 'createdAt'];
        csvData = data.map(link => ({
          id: link.id,
          slug: link.slug,
          destination: link.destination,
          title: link.title || '',
          clicks: link.clicks || 0,
          createdAt: link.createdAt
        }));
        break;

      case 'analytics':
        // Export daily stats as CSV
        fields = ['date', 'requests'];
        csvData = data.timeBasedAnalytics.dailyStats.map(stat => ({
          date: stat.date,
          requests: stat.count
        }));
        break;

      case 'users':
        fields = ['id', 'email', 'name', 'apiKeysCount', 'createdAt'];
        csvData = data.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name || '',
          apiKeysCount: user._count?.apiKeys || 0,
          createdAt: user.createdAt
        }));
        break;

      default:
        throw new Error('Invalid export type');
    }

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(csvData);
  }

  /**
   * Generate Excel export
   * @param {Object} data - Data to export
   * @param {string} type - Type of data
   * @returns {Buffer} Excel file buffer
   */
  static generateExcelExport(data, type) {
    const workbook = XLSX.utils.book_new();

    switch (type) {
      case 'links':
        const linksData = data.map(link => ({
          ID: link.id,
          Slug: link.slug,
          Destination: link.destination,
          Title: link.title || '',
          Clicks: link.clicks || 0,
          'Created At': link.createdAt
        }));
        const linksSheet = XLSX.utils.json_to_sheet(linksData);
        XLSX.utils.book_append_sheet(workbook, linksSheet, 'Links');
        break;

      case 'analytics':
        // Daily stats sheet
        const dailyStatsData = data.timeBasedAnalytics.dailyStats.map(stat => ({
          Date: stat.date,
          Requests: stat.count
        }));
        const dailySheet = XLSX.utils.json_to_sheet(dailyStatsData);
        XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Stats');

        // Hourly stats sheet
        const hourlyStatsData = data.timeBasedAnalytics.hourlyStats.map(stat => ({
          Hour: stat.hour,
          Requests: stat.count
        }));
        const hourlySheet = XLSX.utils.json_to_sheet(hourlyStatsData);
        XLSX.utils.book_append_sheet(workbook, hourlySheet, 'Hourly Stats');

        // Top links sheet
        if (data.topLinks) {
          const topLinksData = data.topLinks.map(link => ({
            Slug: link.slug,
            Destination: link.destination,
            Title: link.title || '',
            Clicks: link.clicks
          }));
          const topLinksSheet = XLSX.utils.json_to_sheet(topLinksData);
          XLSX.utils.book_append_sheet(workbook, topLinksSheet, 'Top Links');
        }

        // Device breakdown sheet
        if (data.deviceBrowserAnalytics) {
          const deviceData = Object.entries(data.deviceBrowserAnalytics.deviceBreakdown)
            .map(([device, count]) => ({ Device: device, Count: count }));
          const deviceSheet = XLSX.utils.json_to_sheet(deviceData);
          XLSX.utils.book_append_sheet(workbook, deviceSheet, 'Devices');
        }
        break;

      case 'users':
        const usersData = data.map(user => ({
          ID: user.id,
          Email: user.email,
          Name: user.name || '',
          'API Keys': user._count?.apiKeys || 0,
          'Created At': user.createdAt
        }));
        const usersSheet = XLSX.utils.json_to_sheet(usersData);
        XLSX.utils.book_append_sheet(workbook, usersSheet, 'Users');
        break;

      default:
        throw new Error('Invalid export type');
    }

    // Summary sheet
    const summaryData = [{
      'Report Type': type.toUpperCase(),
      'Generated At': new Date().toISOString(),
      'Total Records': Array.isArray(data) ? data.length : 'N/A'
    }];

    if (data.summary) {
      Object.entries(data.summary).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          summaryData.push({ 'Metric': key, 'Value': JSON.stringify(value) });
        } else {
          summaryData.push({ 'Metric': key, 'Value': value });
        }
      });
    }

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generate HTML for PDF report
   * @param {Object} analyticsData - Analytics data
   * @returns {string} HTML string
   */
  static generateReportHTML(analyticsData) {
    const { summary, timeBasedAnalytics, deviceBrowserAnalytics, referralAnalytics, topLinks } = analyticsData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analytics Report</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            color: #666;
            margin: 5px 0 0 0;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #007bff;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #007bff;
            font-size: 2em;
        }
        .summary-card p {
            margin: 0;
            color: #666;
            font-weight: bold;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #007bff;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .chart-container {
            margin: 20px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #007bff;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .device-breakdown {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 20px 0;
        }
        .device-item {
            background: #e9ecef;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Analytics Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            ${summary.dateRange ? `<p>Period: ${new Date(summary.dateRange.startDate).toLocaleDateString()} - ${new Date(summary.dateRange.endDate).toLocaleDateString()}</p>` : ''}
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>${summary.totalRequests?.toLocaleString() || 'N/A'}</h3>
                <p>Total Requests</p>
            </div>
            <div class="summary-card">
                <h3>${summary.uniqueIPs || 'N/A'}</h3>
                <p>Unique IPs</p>
            </div>
            <div class="summary-card">
                <h3>${summary.uniqueCountries || 'N/A'}</h3>
                <p>Countries</p>
            </div>
            <div class="summary-card">
                <h3>${topLinks?.length || 0}</h3>
                <p>Top Links</p>
            </div>
        </div>

        ${timeBasedAnalytics?.dailyStats?.length ? `
        <div class="section">
            <h2>Daily Request Trends</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Requests</th>
                    </tr>
                </thead>
                <tbody>
                    ${timeBasedAnalytics.dailyStats.slice(0, 30).map(stat => `
                        <tr>
                            <td>${stat.date}</td>
                            <td>${stat.count.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${topLinks?.length ? `
        <div class="section">
            <h2>Top Performing Links</h2>
            <table>
                <thead>
                    <tr>
                        <th>Slug</th>
                        <th>Destination</th>
                        <th>Title</th>
                        <th>Clicks</th>
                    </tr>
                </thead>
                <tbody>
                    ${topLinks.map(link => `
                        <tr>
                            <td>${link.slug}</td>
                            <td><a href="${link.destination}" target="_blank">${link.destination}</a></td>
                            <td>${link.title || '-'}</td>
                            <td>${link.clicks.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${deviceBrowserAnalytics?.deviceBreakdown ? `
        <div class="section">
            <h2>Device Breakdown</h2>
            <div class="device-breakdown">
                ${Object.entries(deviceBrowserAnalytics.deviceBreakdown).map(([device, count]) => `
                    <div class="device-item">${device}: ${count}</div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${referralAnalytics?.topReferrers?.length ? `
        <div class="section">
            <h2>Top Referral Sources</h2>
            <table>
                <thead>
                    <tr>
                        <th>Domain</th>
                        <th>Visits</th>
                    </tr>
                </thead>
                <tbody>
                    ${referralAnalytics.topReferrers.map(referrer => `
                        <tr>
                            <td>${referrer.domain}</td>
                            <td>${referrer.count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="footer">
            <p>Report generated by URL Shortener Analytics System</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Export data in specified format
   * @param {string} format - 'csv', 'xlsx', or 'pdf'
   * @param {string} type - Type of data to export
   * @param {Object} data - Data to export
   * @param {Object} options - Additional options
   * @returns {Buffer|string} Export data
   */
  static async exportData(format, type, data, options = {}) {
    switch (format.toLowerCase()) {
      case 'csv':
        return this.generateCSVExport(data, type);

      case 'xlsx':
      case 'excel':
        return this.generateExcelExport(data, type);

      case 'pdf':
        return await this.generatePDFReport(data, 'pdf');

      case 'html':
        return this.generateReportHTML(data);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

module.exports = ReportService;