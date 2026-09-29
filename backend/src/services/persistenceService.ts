import { PrismaClient } from '@prisma/client';
import { Shape } from '../types/shape.types';

// ============================================================================
// Optional persistence layer. If DATABASE_URL isn't set, all methods become
// safe no-ops so the app runs fine in pure in-memory mode (great for demos
// / local dev without Postgres).
// ============================================================================

const isEnabled = !!process.env.DATABASE_URL;
const prisma = isEnabled ? new PrismaClient() : null;

export const persistenceService = {
  isEnabled,

  async saveSnapshot(roomId: string, shapes: Shape[]): Promise<void> {
    if (!prisma) return;
    await prisma.room.upsert({
      where: { id: roomId },
      create: { id: roomId, data: JSON.stringify(shapes) },
      update: { data: JSON.stringify(shapes), updatedAt: new Date() },
    });
  },

  async loadSnapshot(roomId: string): Promise<Shape[] | null> {
    if (!prisma) return null;
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return null;
    try {
      return JSON.parse(room.data) as Shape[];
    } catch {
      return null;
    }
  },

  async disconnect(): Promise<void> {
    if (prisma) await prisma.$disconnect();
  },
};
