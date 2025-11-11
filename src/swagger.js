const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'URL Shortener API',
      version: '1.0.0',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
      parameters: {
        limitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items to return (maximum 20)',
          required: false,
          schema: {
            type: 'integer',
            default: 10,
            maximum: 20,
            minimum: 1
          }
        },
        offsetParam: {
          name: 'offset',
          in: 'query',
          description: 'Number of items to skip',
          required: false,
          schema: {
            type: 'integer',
            default: 0,
            minimum: 0
          }
        }
      }
    },
    security: [],
  },
  apis: ['./src/controllers/*.js'] // annotate controllers with JSDoc @swagger comments
};

const swaggerSpec = swaggerJSDoc(options);

function setupSwagger(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = { setupSwagger, swaggerSpec };