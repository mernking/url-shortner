const prisma = require('../prisma/client');
const UAParser = require('ua-parser-js');

class AnalyticsService {
  /**
   * Get analytics data with custom date range
   * @param {Object} options - Options for analytics query
   * @param {Date} options.startDate - Start date for analytics
   * @param {Date} options.endDate - End date for analytics
   * @param {boolean} options.includeDeviceData - Whether to include device/browser data
   * @param {boolean} options.includeReferralData - Whether to include referral data
   * @param {boolean} options.includeTopLinks - Whether to include top performing links
   * @param {number} options.topLinksLimit - Limit for top links (default: 10)
   */
  static async getAnalytics(options = {}) {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default 7 days
      endDate = new Date(),
      includeDeviceData = true,
      includeReferralData = true,
      includeTopLinks = true,
      topLinksLimit = 10
    } = options;

    try {
      // Daily stats for the date range
      const dailyStatsRaw = await prisma.$queryRaw`
        SELECT
          DATE(time) as date,
          COUNT(*) as count
        FROM RequestLog
        WHERE time >= ${startDate} AND time <= ${endDate}
        GROUP BY DATE(time)
        ORDER BY date
      `;

      // Hourly stats for the date range
      const hourlyStatsRaw = await prisma.$queryRaw`
        SELECT
          strftime('%Y-%m-%d %H', time) as hour,
          COUNT(*) as count
        FROM RequestLog
        WHERE time >= ${startDate} AND time <= ${endDate}
        GROUP BY strftime('%Y-%m-%d %H', time)
        ORDER BY hour
      `;

      // Convert BigInt to number
      const dailyStats = dailyStatsRaw.map(stat => ({
        date: stat.date,
        count: Number(stat.count)
      }));

      const hourlyStats = hourlyStatsRaw.map(stat => ({
        hour: stat.hour,
        count: Number(stat.count)
      }));

      // Total counts
      const totalRequests = await prisma.requestLog.count({
        where: {
          time: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const uniqueIPs = await prisma.requestLog.findMany({
        where: {
          time: {
            gte: startDate,
            lte: endDate
          }
        },
        select: { ip: true },
        distinct: ['ip']
      });

      const uniqueCountries = await prisma.requestLog.findMany({
        where: {
          time: {
            gte: startDate,
            lte: endDate,
            country: { not: null }
          }
        },
        select: { country: true },
        distinct: ['country']
      });

      let deviceBrowserAnalytics = {};
      if (includeDeviceData) {
        deviceBrowserAnalytics = await this.getDeviceBrowserAnalytics(startDate, endDate);
      }

      let referralAnalytics = {};
      if (includeReferralData) {
        referralAnalytics = await this.getReferralAnalytics(startDate, endDate);
      }

      let topLinks = [];
      if (includeTopLinks) {
        topLinks = await this.getTopLinks(startDate, endDate, topLinksLimit);
      }

      return {
        summary: {
          totalRequests,
          uniqueIPs: uniqueIPs.length,
          uniqueCountries: uniqueCountries.length,
          dateRange: {
            startDate,
            endDate
          }
        },
        timeBasedAnalytics: {
          dailyStats,
          hourlyStats
        },
        deviceBrowserAnalytics,
        referralAnalytics,
        topLinks
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }

  /**
   * Get device and browser analytics for date range
   */
  static async getDeviceBrowserAnalytics(startDate, endDate) {
    const clicks = await prisma.click.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ua: { not: null }
      },
      select: { ua: true }
    });

    const deviceBreakdown = {};
    const browserBreakdown = {};
    const osBreakdown = {};

    clicks.forEach(click => {
      if (click.ua) {
        const parser = new UAParser(click.ua);
        const result = parser.getResult();

        // Device type
        const deviceType = result.device.type || 'desktop';
        deviceBreakdown[deviceType] = (deviceBreakdown[deviceType] || 0) + 1;

        // Browser
        const browser = result.browser.name || 'Unknown';
        browserBreakdown[browser] = (browserBreakdown[browser] || 0) + 1;

        // OS
        const os = result.os.name || 'Unknown';
        osBreakdown[os] = (osBreakdown[os] || 0) + 1;
      }
    });

    return {
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      totalAnalyzed: clicks.length
    };
  }

  /**
   * Get referral analytics for date range
   */
  static async getReferralAnalytics(startDate, endDate) {
    const referrerClicks = await prisma.click.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        referrer: { not: null }
      },
      select: { referrer: true }
    });

    const referralSources = {};
    const referralCategories = {
      search: 0,
      social: 0,
      direct: 0,
      other: 0
    };

    referrerClicks.forEach(click => {
      if (click.referrer) {
        try {
          const url = new URL(click.referrer);
          const domain = url.hostname.toLowerCase();

          referralSources[domain] = (referralSources[domain] || 0) + 1;

          // Categorize referral source
          if (domain.includes('google') || domain.includes('bing') ||
              domain.includes('yahoo') || domain.includes('duckduckgo')) {
            referralCategories.search++;
          } else if (domain.includes('facebook') || domain.includes('twitter') ||
                     domain.includes('instagram') || domain.includes('linkedin') ||
                     domain.includes('tiktok')) {
            referralCategories.social++;
          } else if (domain === 'direct' || domain === '') {
            referralCategories.direct++;
          } else {
            referralCategories.other++;
          }
        } catch (error) {
          // Invalid URL, skip
          console.warn('Invalid referrer URL:', click.referrer);
        }
      }
    });

    // Top 10 referral sources
    const topReferrers = Object.entries(referralSources)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    return {
      topReferrers,
      referralCategories,
      totalReferrers: referrerClicks.length
    };
  }

  /**
   * Get top performing links for date range
   */
  static async getTopLinks(startDate, endDate, limit = 10) {
    const links = await prisma.link.findMany({
      select: {
        id: true,
        slug: true,
        destination: true,
        title: true,
        createdAt: true,
        _count: {
          select: {
            clicks: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          }
        }
      },
      orderBy: {
        clicks: {
          _count: 'desc'
        }
      },
      take: limit
    });

    return links.map(link => ({
      id: link.id,
      slug: link.slug,
      destination: link.destination,
      title: link.title,
      clicks: link._count.clicks,
      createdAt: link.createdAt
    }));
  }

  /**
   * Get user-specific analytics (for non-admin users)
   * @param {number} userId - User ID
   * @param {Object} options - Same options as getAnalytics
   */
  static async getUserAnalytics(userId, options = {}) {
    const analytics = await this.getAnalytics(options);

    // Filter top links to only show user's links
    const userLinks = await prisma.link.findMany({
      where: { createdById: userId },
      select: { id: true }
    });

    const userLinkIds = userLinks.map(link => link.id);

    analytics.topLinks = analytics.topLinks.filter(link =>
      userLinkIds.includes(link.id)
    );

    // Add user-specific summary
    const userClicks = await prisma.click.count({
      where: {
        link: {
          createdById: userId
        },
        createdAt: {
          gte: options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          lte: options.endDate || new Date()
        }
      }
    });

    analytics.summary.userClicks = userClicks;

    return analytics;
  }
}

module.exports = AnalyticsService;