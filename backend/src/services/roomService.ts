import { Shape, RoomUser } from '../types/shape.types';

// ============================================================================
// RoomService: single-responsibility class that owns in-memory room state.
// It knows NOTHING about Socket.IO — this separation is what lets us unit
// test business logic without spinning up a real socket server, and lets us
// swap the transport later without touching this file (Open/Closed principle).
// ============================================================================

interface Room {
  id: string;
  shapes: Map<string, Shape>;
  users: Map<string, RoomUser>;
  lastActivity: number;
}

const USER_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

class RoomService {
  private rooms = new Map<string, Room>();

  private getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { id: roomId, shapes: new Map(), users: new Map(), lastActivity: Date.now() };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  joinRoom(roomId: string, userId: string, userName: string): Room {
    const room = this.getOrCreateRoom(roomId);
    const color = USER_COLORS[room.users.size % USER_COLORS.length];
    room.users.set(userId, { userId, userName, color });
    room.lastActivity = Date.now();
    return room;
  }

  leaveRoom(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.users.delete(userId);
    // Clean up empty rooms after a grace period so a brief refresh doesn't
    // wipe the canvas. In production this would be a delayed job; here we
    // do a simple synchronous check.
    if (room.users.size === 0) {
      setTimeout(() => {
        const r = this.rooms.get(roomId);
        if (r && r.users.size === 0) this.rooms.delete(roomId);
      }, 5 * 60 * 1000);
    }
  }

  getSnapshot(roomId: string): { shapes: Shape[]; users: RoomUser[] } {
    const room = this.getOrCreateRoom(roomId);
    return {
      shapes: Array.from(room.shapes.values()).sort((a, b) => a.zIndex - b.zIndex),
      users: Array.from(room.users.values()),
    };
  }

  addShape(roomId: string, shape: Shape): void {
    const room = this.getOrCreateRoom(roomId);
    room.shapes.set(shape.id, shape);
    room.lastActivity = Date.now();
  }

  updateShape(roomId: string, shapeId: string, patch: Partial<Shape>): Shape | null {
    const room = this.getOrCreateRoom(roomId);
    const existing = room.shapes.get(shapeId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: Date.now() } as Shape;
    room.shapes.set(shapeId, updated);
    room.lastActivity = Date.now();
    return updated;
  }

  deleteShape(roomId: string, shapeId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.shapes.delete(shapeId);
  }

  reorderShapes(roomId: string, order: { id: string; zIndex: number }[]): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const { id, zIndex } of order) {
      const shape = room.shapes.get(id);
      if (shape) shape.zIndex = zIndex;
    }
  }

  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  getAllRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }
}

// Singleton — the whole app shares one in-memory store per process.
export const roomService = new RoomService();
