import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { initWebSocket } from './ws.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';

// Load environmental variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Enable Cross-Origin Resource Sharing
app.use(cors({
  origin: '*', // In dev allow all, or configure it specifically to the frontend port
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Base route
app.get('/api', (req, res) => {
  res.json({ success: true, message: 'Welcome to the Task Management API' });
});

// Serve frontend static files in production if dist directory exists
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../frontend/dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
  console.log('Production frontend files detected and serving statically.');
}

// Initialize WebSockets
initWebSocket(server);

// Define PORT
const PORT = process.env.PORT || 5000;

// Listen
server.listen(PORT, () => {
  console.log(`Server running in mode on port ${PORT}`);
});
