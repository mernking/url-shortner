# URL Shortener MCP Server

This MCP (Model Context Protocol) server provides AI systems with tools to interact with a URL shortening service, allowing them to create links, query analytics, and manage users.

## Features

### Link Management Tools
- `create_short_link` - Create a new short link
- `get_link_analytics` - Get analytics for a specific link
- `list_user_links` - List all links for the authenticated user
- `update_link` - Update an existing link
- `delete_link` - Delete a link
- `bulk_create_links` - Create multiple links at once

### Analytics Tools (Admin Only)
- `get_global_analytics` - Get global system analytics
- `list_all_links` - List all links in the system (admin)

### User Management Tools (Admin Only)
- `manage_users` - Create, list, update, and delete users

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Base URL of the URL shortening service API
URL_SHORTENER_API_BASE_URL=http://localhost:3000

# API key for authentication
URL_SHORTENER_API_KEY=your-api-key-here

# Admin credentials for admin operations
URL_SHORTENER_ADMIN_EMAIL=admin@example.com
URL_SHORTENER_ADMIN_PASSWORD=your-admin-password

# Enable/disable the MCP server
URL_SHORTENER_MCP_ENABLED=true
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

## Security

- The server uses API key authentication for user operations
- Admin operations require admin credentials
- Environment variables control access and configuration
- The server can be disabled by setting `URL_SHORTENER_MCP_ENABLED=false`

## MCP Configuration

Add the following to your MCP settings to enable this server:

```json
{
  "mcpServers": {
    "url-shortener": {
      "command": "node",
      "args": ["/path/to/mcp-server/build/index.js"],
      "env": {
        "URL_SHORTENER_API_BASE_URL": "http://localhost:3000",
        "URL_SHORTENER_API_KEY": "your-api-key",
        "URL_SHORTENER_ADMIN_EMAIL": "admin@example.com",
        "URL_SHORTENER_ADMIN_PASSWORD": "admin-password",
        "URL_SHORTENER_MCP_ENABLED": "true"
      }
    }
  }
}
```

## Development

To modify the server:
1. Edit `src/index.ts`
2. Run `npm run build` to compile
3. Test with your MCP client

## Error Handling

All tools include proper error handling and will return descriptive error messages if operations fail. The server validates all inputs and provides helpful feedback for invalid requests.