import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createSocketServer } from './sockets';
import { roomService } from './services/roomService';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Simple health & diagnostics endpoints — useful for load balancers and
// for debugging room state without opening a socket connection.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/rooms', (_req, res) => {
  res.json({ rooms: roomService.getAllRoomIds() });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const snapshot = roomService.getSnapshot(req.params.roomId);
  res.json(snapshot);
});

const httpServer = createServer(app);
createSocketServer(httpServer);

const PORT = Number(process.env.PORT) || 4000;
httpServer.listen(PORT, () => {
  console.log(`Draw Buddy server listening on http://localhost:${PORT}`);
});
