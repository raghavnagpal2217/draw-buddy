import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socketHandlers';

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
    // Reasonable production defaults: ping/timeout tuning avoids false
    // "disconnected" states on flaky mobile networks.
    pingInterval: 10000,
    pingTimeout: 15000,
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);
    registerSocketHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}
