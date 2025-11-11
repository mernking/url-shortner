#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import { PrismaClient } from "@prisma/client";

// Environment variables
const API_BASE_URL = process.env.URL_SHORTENER_API_BASE_URL || "http://localhost:3000";
const API_KEY = process.env.URL_SHORTENER_API_KEY;
const ADMIN_EMAIL = process.env.URL_SHORTENER_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.URL_SHORTENER_ADMIN_PASSWORD;
const ENABLED = process.env.URL_SHORTENER_MCP_ENABLED !== "false";

// Validate required environment variables
if (!API_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing required environment variables:");
  console.error("- URL_SHORTENER_API_KEY");
  console.error("- URL_SHORTENER_ADMIN_EMAIL");
  console.error("- URL_SHORTENER_ADMIN_PASSWORD");
  process.exit(1);
}

// Initialize Prisma client for direct database access
const prisma = new PrismaClient();

// Create axios instance for API calls
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  },
});

// Create admin axios instance for admin operations
const adminApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper function to get admin token
async function getAdminToken(): Promise<string> {
  try {
    const response = await adminApiClient.post("/admin/login", {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    return response.data.token;
  } catch (error: any) {
    throw new Error(`Failed to authenticate admin: ${error.response?.data?.error || error.message}`);
  }
}

// Create an MCP server
const server = new McpServer({
  name: "url-shortener-mcp",
  version: "1.0.0"
});

// Tool: Create a short link
server.tool(
  "create_short_link",
  {
    destination: z.string().url().describe("The URL to shorten"),
    slug: z.string().optional().describe("Optional custom slug for the short URL"),
    title: z.string().optional().describe("Optional title for the link"),
    password: z.string().optional().describe("Optional password to protect the link"),
    expiresAt: z.string().optional().describe("Optional expiration date in ISO format"),
    webhookUrl: z.string().url().optional().describe("Optional webhook URL for notifications"),
  },
  async ({ destination, slug, title, password, expiresAt, webhookUrl }) => {
    try {
      const response = await apiClient.post("/api/links", {
        destination,
        slug,
        title,
        password,
        expiresAt,
        webhookUrl,
      });

      return {
        content: [
          {
            type: "text",
            text: `Short link created successfully!\nSlug: ${response.data.slug}\nShort URL: ${response.data.shortUrl}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create short link: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get link analytics
server.tool(
  "get_link_analytics",
  {
    slug: z.string().describe("The slug of the short link"),
  },
  async ({ slug }) => {
    try {
      const response = await apiClient.get(`/api/links/${slug}/stats`);

      const link = response.data;
      const analytics = `Link Analytics for "${link.slug}":
- Destination: ${link.destination}
- Total Clicks: ${link.clicksCount}
- Recent Clicks: ${link.clicks.slice(0, 5).map((click: any) =>
  `${new Date(click.occurredAt).toLocaleString()}: ${click.ip || 'Unknown IP'} (${click.country || 'Unknown'}, ${click.city || 'Unknown'})`
).join('\n')}`;

      return {
        content: [
          {
            type: "text",
            text: analytics,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get link analytics: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: List user's links
server.tool(
  "list_user_links",
  {
    limit: z.number().min(1).max(20).default(10).describe("Number of links per page (maximum 20)"),
    offset: z.number().min(0).default(0).describe("Number of links to skip"),
  },
  async ({ limit, offset }) => {
    try {
      const response = await apiClient.get("/api/links", {
        params: { limit, offset },
      });

      const links = response.data.links;
      const pagination = response.data.pagination;

      const linksList = links.map((link: any) =>
        `- ${link.slug}: ${link.destination} (${link.title || 'No title'}) - ${link.createdAt}`
      ).join('\n');

      const summary = `Your Links (Limit: ${pagination.limit}, Offset: ${pagination.offset}, Total: ${pagination.total}):\n${linksList}`;

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to list links: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Update link
server.tool(
  "update_link",
  {
    id: z.number().describe("The ID of the link to update"),
    destination: z.string().url().optional().describe("New destination URL"),
    slug: z.string().optional().describe("New slug"),
    title: z.string().optional().describe("New title"),
    password: z.string().optional().describe("New password"),
    expiresAt: z.string().optional().describe("New expiration date"),
    webhookUrl: z.string().url().optional().describe("New webhook URL"),
  },
  async ({ id, destination, slug, title, password, expiresAt, webhookUrl }) => {
    try {
      const response = await apiClient.put(`/api/links/${id}`, {
        destination,
        slug,
        title,
        password,
        expiresAt,
        webhookUrl,
      });

      return {
        content: [
          {
            type: "text",
            text: `Link updated successfully!\nSlug: ${response.data.slug}\nShort URL: ${response.data.shortUrl}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to update link: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Delete link
server.tool(
  "delete_link",
  {
    id: z.number().describe("The ID of the link to delete"),
  },
  async ({ id }) => {
    try {
      await apiClient.delete(`/api/links/${id}`);

      return {
        content: [
          {
            type: "text",
            text: `Link deleted successfully!`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to delete link: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Bulk create links
server.tool(
  "bulk_create_links",
  {
    links: z.array(z.object({
      destination: z.string().url(),
      slug: z.string().optional(),
      title: z.string().optional(),
      password: z.string().optional(),
      expiresAt: z.string().optional(),
      webhookUrl: z.string().url().optional(),
    })).describe("Array of link objects to create"),
  },
  async ({ links }) => {
    try {
      const response = await apiClient.post("/api/links/bulk", { links });

      const createdLinks = response.data.links;
      const summary = `Bulk creation completed! Created ${createdLinks.length} links:\n` +
        createdLinks.map((link: any) => `- ${link.slug}: ${link.shortUrl}`).join('\n');

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to bulk create links: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get global analytics (admin only)
server.tool(
  "get_global_analytics",
  {
    days: z.number().min(1).max(30).default(7).describe("Number of days to analyze"),
  },
  async ({ days }) => {
    try {
      const adminToken = await getAdminToken();
      const response = await adminApiClient.get("/admin/analytics", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const analytics = response.data;

      // Format the analytics data
      let summary = `Global Analytics (Last ${days} days):\n\n`;

      // Daily stats
      summary += "Daily Request Trends:\n";
      analytics.timeBasedAnalytics.dailyStats.forEach((stat: any) => {
        summary += `${stat.date}: ${stat.count} requests\n`;
      });

      // Hourly stats
      summary += "\nHourly Request Trends (Last 24h):\n";
      analytics.timeBasedAnalytics.hourlyStats.forEach((stat: any) => {
        summary += `${stat.hour}:00: ${stat.count} requests\n`;
      });

      // Top links
      summary += "\nTop Performing Links:\n";
      analytics.topLinks.slice(0, 5).forEach((link: any, index: number) => {
        summary += `${index + 1}. ${link.slug}: ${link.destination} (${link._count.clicks} clicks)\n`;
      });

      // Device breakdown
      summary += "\nDevice Breakdown:\n";
      Object.entries(analytics.deviceBrowserAnalytics.deviceBreakdown).forEach(([device, count]) => {
        summary += `${device}: ${count}\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get global analytics: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: List all links (admin only)
server.tool(
  "list_all_links",
  {
    limit: z.number().min(1).max(20).default(20).describe("Number of links per page (maximum 20)"),
    offset: z.number().min(0).default(0).describe("Number of links to skip"),
    search: z.string().optional().describe("Search term for slug, destination, or title"),
  },
  async ({ limit, offset, search }) => {
    try {
      const adminToken = await getAdminToken();
      const response = await adminApiClient.get("/admin/links", {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { limit, offset, search },
      });

      const links = response.data.links;
      const pagination = response.data.pagination;

      const linksList = links.map((link: any) =>
        `- ${link.slug}: ${link.destination} (${link.title || 'No title'}) - ${link.clicksCount} clicks - Created: ${new Date(link.createdAt).toLocaleDateString()}`
      ).join('\n');

      const summary = `All Links (Limit: ${pagination.limit}, Offset: ${pagination.offset}, Total: ${pagination.total}):\n${linksList}`;

      return {
        content: [
          {
            type: "text",
            text: summary,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to list all links: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Manage users (admin only)
server.tool(
  "manage_users",
  {
    action: z.enum(["list", "create", "update", "delete"]).describe("Action to perform"),
    userId: z.number().optional().describe("User ID for update/delete actions"),
    email: z.string().email().optional().describe("User email"),
    password: z.string().optional().describe("User password"),
    name: z.string().optional().describe("User name"),
    isAdmin: z.boolean().optional().describe("Whether user should be admin"),
  },
  async ({ action, userId, email, password, name, isAdmin }) => {
    try {
      const adminToken = await getAdminToken();

      if (action === "list") {
        const response = await adminApiClient.get("/admin/users", {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        const users = response.data.users;
        const usersList = users.map((user: any) =>
          `- ${user.email} (${user.name || 'No name'}) - Admin: ${user.isAdmin} - API Keys: ${user._count.apiKeys}`
        ).join('\n');

        return {
          content: [
            {
              type: "text",
              text: `Users (${users.length} total):\n${usersList}`,
            },
          ],
        };
      }

      if (action === "create") {
        if (!email || !password) {
          return {
            content: [
              {
                type: "text",
                text: "Email and password are required for user creation",
              },
            ],
            isError: true,
          };
        }

        const response = await adminApiClient.post("/admin/users", {
          email,
          password,
          name,
          isAdmin,
        }, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        return {
          content: [
            {
              type: "text",
              text: `User created successfully: ${response.data.email}`,
            },
          ],
        };
      }

      if (action === "update") {
        if (!userId) {
          return {
            content: [
              {
                type: "text",
                text: "User ID is required for update action",
              },
            ],
            isError: true,
          };
        }

        const response = await adminApiClient.put(`/admin/users/${userId}`, {
          email,
          name,
          isAdmin,
        }, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        return {
          content: [
            {
              type: "text",
              text: `User updated successfully: ${response.data.email}`,
            },
          ],
        };
      }

      if (action === "delete") {
        if (!userId) {
          return {
            content: [
              {
                type: "text",
                text: "User ID is required for delete action",
              },
            ],
            isError: true,
          };
        }

        await adminApiClient.delete(`/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        return {
          content: [
            {
              type: "text",
              text: `User deleted successfully`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Invalid action",
          },
        ],
        isError: true,
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to manage users: ${error.response?.data?.error || error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start the server if enabled
if (ENABLED) {
  const transport = new StdioServerTransport();
  server.connect(transport).catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  });
} else {
  console.error("MCP server is disabled. Set URL_SHORTENER_MCP_ENABLED=true to enable.");
  process.exit(1);
}