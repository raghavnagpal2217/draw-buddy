import { Server, Socket } from 'socket.io';
import { roomService } from '../services/roomService';
import { persistenceService } from '../services/persistenceService';
import {
  JoinRoomPayload,
  ShapeAddedEvent,
  ShapeUpdatedEvent,
  ShapeDeletedEvent,
  ShapesReorderedEvent,
  CursorMovePayload,
} from '../types/shape.types';

// ============================================================================
// Socket handlers: this file ONLY translates socket events <-> roomService
// calls and broadcasts. It never touches shape-manipulation logic itself.
// This separation means: (a) roomService is unit-testable in isolation,
// (b) swapping Socket.IO for another transport only means rewriting this
// file, (c) each handler has one clear responsibility (SRP).
// ============================================================================

// Debounced persistence: we don't want to hit Postgres on every single
// pencil-stroke tick. Instead we schedule a save a short time after the last
// mutation in a room, coalescing bursts of activity into one write.
const persistTimers = new Map<string, NodeJS.Timeout>();
const PERSIST_DEBOUNCE_MS = 2000;

function schedulePersist(roomId: string) {
  if (!persistenceService.isEnabled) return;
  const existing = persistTimers.get(roomId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    const { shapes } = roomService.getSnapshot(roomId);
    persistenceService.saveSnapshot(roomId, shapes).catch((err) =>
      console.error(`[persistence] failed to save room ${roomId}:`, err)
    );
    persistTimers.delete(roomId);
  }, PERSIST_DEBOUNCE_MS);
  persistTimers.set(roomId, timer);
}

export function registerSocketHandlers(io: Server, socket: Socket) {
  // Track which room this socket belongs to for clean disconnect handling.
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  // --------------------------------------------------------------------
  // JOIN ROOM: on join, the new client gets a full snapshot (shapes +
  // users) so it can render current canvas state immediately. Everyone
  // else just gets notified a user joined (cheap, no shape payload).
  // --------------------------------------------------------------------
  socket.on('room:join', async (payload: JoinRoomPayload) => {
    const { roomId, userId, userName } = payload;
    currentRoomId = roomId;
    currentUserId = userId;

    socket.join(roomId);

    // Attempt to hydrate from durable storage if this room has no
    // in-memory shapes yet (e.g. first person back after server restart).
    if (persistenceService.isEnabled && !roomService.roomExists(roomId)) {
      const saved = await persistenceService.loadSnapshot(roomId);
      if (saved) {
        for (const shape of saved) roomService.addShape(roomId, shape);
      }
    }

    roomService.joinRoom(roomId, userId, userName);
    const snapshot = roomService.getSnapshot(roomId);

    // Only the joining client needs the full canvas + user list.
    socket.emit('room:state', { roomId, ...snapshot });

    // Everyone else just needs to know a user list changed.
    socket.to(roomId).emit('room:userJoined', { roomId, users: snapshot.users });
  });

  // --------------------------------------------------------------------
  // SHAPE ADD: fired once per finished shape (mouse-up), not per pixel.
  // --------------------------------------------------------------------
  socket.on('shape:add', (payload: ShapeAddedEvent) => {
    const { roomId, shape } = payload;
    roomService.addShape(roomId, shape);
    // Broadcast to everyone else in the room — sender already has it locally
    // (optimistic UI), so we exclude the sender to cut traffic in half.
    socket.to(roomId).emit('shape:added', payload);
    schedulePersist(roomId);
  });

  // --------------------------------------------------------------------
  // SHAPE UPDATE: used for in-progress drag/resize/move. The frontend
  // throttles these client-side (see utils/throttle.ts) so we only receive
  // a handful of updates per second even during fast dragging, instead of
  // one per animation frame.
  // --------------------------------------------------------------------
  socket.on('shape:update', (payload: ShapeUpdatedEvent) => {
    const { roomId, shapeId, patch } = payload;
    const updated = roomService.updateShape(roomId, shapeId, patch);
    if (updated) {
      socket.to(roomId).emit('shape:updated', { roomId, shapeId, patch });
      schedulePersist(roomId);
    }
  });

  socket.on('shape:delete', (payload: ShapeDeletedEvent) => {
    const { roomId, shapeId } = payload;
    roomService.deleteShape(roomId, shapeId);
    socket.to(roomId).emit('shape:deleted', payload);
    schedulePersist(roomId);
  });

  socket.on('shapes:reorder', (payload: ShapesReorderedEvent) => {
    const { roomId, order } = payload;
    roomService.reorderShapes(roomId, order);
    socket.to(roomId).emit('shapes:reordered', payload);
    schedulePersist(roomId);
  });

  // --------------------------------------------------------------------
  // CURSOR MOVE: ephemeral, never persisted, never routed through
  // roomService (no state to keep) — pure passthrough broadcast, throttled
  // client-side to ~20/sec.
  // --------------------------------------------------------------------
  socket.on('cursor:move', (payload: CursorMovePayload) => {
    socket.to(payload.roomId).emit('cursor:moved', payload);
  });

  socket.on('disconnect', () => {
    if (currentRoomId && currentUserId) {
      roomService.leaveRoom(currentRoomId, currentUserId);
      const { users } = roomService.getSnapshot(currentRoomId);
      socket.to(currentRoomId).emit('room:userLeft', {
        roomId: currentRoomId,
        userId: currentUserId,
        users,
      });
    }
  });
}
