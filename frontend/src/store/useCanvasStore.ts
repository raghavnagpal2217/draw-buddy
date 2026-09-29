import { create } from 'zustand';
import { Shape, ToolType, Viewport, RemoteCursor, RoomUser } from '../types/shape.types';

// ============================================================================
// Single source of truth for canvas state. Design decisions:
//
// 1. Shapes are stored in a Record<id, Shape> (map), not an array — O(1)
//    lookup/update/delete instead of O(n) find/splice, which matters once
//    a room has hundreds of shapes.
// 2. History (undo/redo) stores DIFFS (commands), not full canvas snapshots.
//    A snapshot-per-action approach would balloon memory with large canvases;
//    command objects are tiny regardless of canvas size.
// 3. Socket emission is NOT done inside the store — the store is transport-
//    agnostic. useSocket.ts subscribes to store actions and emits on top.
//    This keeps the store testable without a live socket connection.
// ============================================================================

export type ShapeCommand =
  | { type: 'add'; shape: Shape }
  | { type: 'delete'; shape: Shape } // stores the full shape so redo can re-add it
  | { type: 'update'; shapeId: string; before: Partial<Shape>; after: Partial<Shape> }
  | { type: 'reorder'; before: { id: string; zIndex: number }[]; after: { id: string; zIndex: number }[] };

const MAX_HISTORY = 100; // bounded stack — prevents unbounded memory growth

interface CanvasState {
  roomId: string | null;
  userId: string;
  userName: string;

  shapes: Record<string, Shape>;
  shapeOrder: string[]; // ids sorted by zIndex, cached to avoid re-sorting every render

  viewport: Viewport;
  activeTool: ToolType;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;

  selectedShapeId: string | null;
  users: RoomUser[];
  cursors: Record<string, RemoteCursor>;

  undoStack: ShapeCommand[];
  redoStack: ShapeCommand[];

  // -- actions --
  setRoom: (roomId: string, userId: string, userName: string) => void;
  setTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (screenX: number, screenY: number, delta: number) => void;

  loadShapes: (shapes: Shape[]) => void;
  addShape: (shape: Shape, record?: boolean) => void;
  updateShape: (id: string, patch: Partial<Shape>, record?: boolean) => void;
  deleteShape: (id: string, record?: boolean) => void;
  reorderShape: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;

  applyRemoteAdd: (shape: Shape) => void;
  applyRemoteUpdate: (id: string, patch: Partial<Shape>) => void;
  applyRemoteDelete: (id: string) => void;
  applyRemoteReorder: (order: { id: string; zIndex: number }[]) => void;

  selectShape: (id: string | null) => void;
  setUsers: (users: RoomUser[]) => void;
  setCursor: (cursor: RemoteCursor) => void;
  removeCursor: (userId: string) => void;

  undo: () => ShapeCommand | null;
  redo: () => ShapeCommand | null;
  pushHistory: (command: ShapeCommand) => void;
}

function recomputeOrder(shapes: Record<string, Shape>): string[] {
  return Object.values(shapes)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((s) => s.id);
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  roomId: null,
  userId: '',
  userName: '',

  shapes: {},
  shapeOrder: [],

  viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
  activeTool: 'pencil',
  strokeColor: '#1e293b',
  fillColor: 'transparent',
  strokeWidth: 2,

  selectedShapeId: null,
  users: [],
  cursors: {},

  undoStack: [],
  redoStack: [],

  setRoom: (roomId, userId, userName) => set({ roomId, userId, userName }),
  setTool: (tool) => set({ activeTool: tool, selectedShapeId: null }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),

  setViewport: (patch) => set((s) => ({ viewport: { ...s.viewport, ...patch } })),

  panBy: (dx, dy) =>
    set((s) => ({
      viewport: { ...s.viewport, offsetX: s.viewport.offsetX + dx, offsetY: s.viewport.offsetY + dy },
    })),

  zoomAt: (screenX, screenY, delta) =>
    set((s) => {
      const oldZoom = s.viewport.zoom;
      const newZoom = Math.min(4, Math.max(0.1, oldZoom * (delta > 0 ? 0.9 : 1.1)));
      // Keep the point under the cursor fixed while zooming (standard
      // design-tool zoom-to-cursor behavior).
      const worldX = (screenX - s.viewport.offsetX) / oldZoom;
      const worldY = (screenY - s.viewport.offsetY) / oldZoom;
      const newOffsetX = screenX - worldX * newZoom;
      const newOffsetY = screenY - worldY * newZoom;
      return { viewport: { offsetX: newOffsetX, offsetY: newOffsetY, zoom: newZoom } };
    }),

  loadShapes: (shapes) =>
    set(() => {
      const map: Record<string, Shape> = {};
      for (const shape of shapes) map[shape.id] = shape;
      return { shapes: map, shapeOrder: recomputeOrder(map), undoStack: [], redoStack: [] };
    }),

  addShape: (shape, record = true) => {
    set((s) => {
      const shapes = { ...s.shapes, [shape.id]: shape };
      return { shapes, shapeOrder: recomputeOrder(shapes) };
    });
    if (record) get().pushHistory({ type: 'add', shape });
  },

  updateShape: (id, patch, record = true) => {
    const existing = get().shapes[id];
    if (!existing) return;
    if (record) {
      const before: Partial<Shape> = {};
      for (const key of Object.keys(patch) as (keyof Shape)[]) {
        (before as any)[key] = existing[key];
      }
      get().pushHistory({ type: 'update', shapeId: id, before, after: patch });
    }
    set((s) => {
      const updated = { ...existing, ...patch, updatedAt: Date.now() } as Shape;
      const shapes = { ...s.shapes, [id]: updated };
      return { shapes };
    });
  },

  deleteShape: (id, record = true) => {
    const existing = get().shapes[id];
    if (!existing) return;
    if (record) get().pushHistory({ type: 'delete', shape: existing });
    set((s) => {
      const shapes = { ...s.shapes };
      delete shapes[id];
      return {
        shapes,
        shapeOrder: recomputeOrder(shapes),
        selectedShapeId: s.selectedShapeId === id ? null : s.selectedShapeId,
      };
    });
  },

  reorderShape: (id, direction) => {
    const { shapeOrder, shapes } = get();
    const before = shapeOrder.map((sid) => ({ id: sid, zIndex: shapes[sid].zIndex }));
    const idx = shapeOrder.indexOf(id);
    if (idx === -1) return;

    const newOrder = [...shapeOrder];
    newOrder.splice(idx, 1);

    if (direction === 'front') newOrder.push(id);
    else if (direction === 'back') newOrder.unshift(id);
    else if (direction === 'forward') newOrder.splice(Math.min(idx + 1, newOrder.length), 0, id);
    else newOrder.splice(Math.max(idx - 1, 0), 0, id);

    const after = newOrder.map((sid, i) => ({ id: sid, zIndex: i }));
    get().pushHistory({ type: 'reorder', before, after });

    set((s) => {
      const shapes = { ...s.shapes };
      for (const { id: sid, zIndex } of after) {
        shapes[sid] = { ...shapes[sid], zIndex };
      }
      return { shapes, shapeOrder: recomputeOrder(shapes) };
    });
  },

  // -- Remote mutations: applied WITHOUT touching history, since undo/redo
  // is a per-user, local-only concept in this design (undoing shouldn't
  // rewrite what a collaborator drew). --
  applyRemoteAdd: (shape) =>
    set((s) => {
      const shapes = { ...s.shapes, [shape.id]: shape };
      return { shapes, shapeOrder: recomputeOrder(shapes) };
    }),

  applyRemoteUpdate: (id, patch) =>
    set((s) => {
      const existing = s.shapes[id];
      if (!existing) return s;
      return { shapes: { ...s.shapes, [id]: { ...existing, ...patch } as Shape } };
    }),

  applyRemoteDelete: (id) =>
    set((s) => {
      const shapes = { ...s.shapes };
      delete shapes[id];
      return { shapes, shapeOrder: recomputeOrder(shapes) };
    }),

  applyRemoteReorder: (order) =>
    set((s) => {
      const shapes = { ...s.shapes };
      for (const { id, zIndex } of order) {
        if (shapes[id]) shapes[id] = { ...shapes[id], zIndex };
      }
      return { shapes, shapeOrder: recomputeOrder(shapes) };
    }),

  selectShape: (id) => set({ selectedShapeId: id }),
  setUsers: (users) => set({ users }),
  setCursor: (cursor) => set((s) => ({ cursors: { ...s.cursors, [cursor.userId]: cursor } })),
  removeCursor: (userId) =>
    set((s) => {
      const cursors = { ...s.cursors };
      delete cursors[userId];
      return { cursors };
    }),

  pushHistory: (command) =>
    set((s) => {
      const undoStack = [...s.undoStack, command].slice(-MAX_HISTORY);
      return { undoStack, redoStack: [] }; // any new action clears redo
    }),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const command = undoStack[undoStack.length - 1];
    set((s) => ({ undoStack: s.undoStack.slice(0, -1), redoStack: [...s.redoStack, command] }));

    // Apply the inverse of the command locally (without re-recording it).
    switch (command.type) {
      case 'add':
        get().deleteShape(command.shape.id, false);
        break;
      case 'delete':
        get().addShape(command.shape, false);
        break;
      case 'update':
        get().updateShape(command.shapeId, command.before, false);
        break;
      case 'reorder':
        get().applyRemoteReorder(command.before);
        break;
    }
    return command;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;
    const command = redoStack[redoStack.length - 1];
    set((s) => ({ redoStack: s.redoStack.slice(0, -1), undoStack: [...s.undoStack, command] }));

    switch (command.type) {
      case 'add':
        get().addShape(command.shape, false);
        break;
      case 'delete':
        get().deleteShape(command.shape.id, false);
        break;
      case 'update':
        get().updateShape(command.shapeId, command.after, false);
        break;
      case 'reorder':
        get().applyRemoteReorder(command.after);
        break;
    }
    return command;
  },
}));
