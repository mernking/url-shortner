require('dotenv').config();
const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const scheduledReportsService = require('./services/scheduled-reports.service');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Admin connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Admin disconnected:', socket.id);
  });
});

// Make io available in routes
app.set('io', io);

// Initialize scheduled reports service
scheduledReportsService.initialize().catch(error => {
  console.error('Failed to initialize scheduled reports service:', error);
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});