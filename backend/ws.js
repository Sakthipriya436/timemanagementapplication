import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

// Map of userId -> Set of WebSocket clients
const userClients = new Map();

export const initWebSocket = (server) => {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade request to verify JWT token before finishing handshake
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_local_dev');
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, decoded.id);
      });
    } catch (err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws, userId) => {
    console.log(`WebSocket client connected for user: ${userId}`);

    // Register socket
    if (!userClients.has(userId)) {
      userClients.set(userId, new Set());
    }
    userClients.get(userId).add(ws);

    // Keep connection alive with simple heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      console.log(`WebSocket client disconnected for user: ${userId}`);
      const clients = userClients.get(userId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          userClients.delete(userId);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for user ${userId}:`, err.message);
    });
  });

  // Periodically ping clients to detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
};

/**
 * Broadcast dynamic updates to all connected sockets of a single user
 * @param {string} userId
 * @param {object} data
 */
export const broadcastToUser = (userId, data) => {
  const clients = userClients.get(userId.toString());
  if (clients) {
    const payload = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(payload);
      }
    });
  }
};
