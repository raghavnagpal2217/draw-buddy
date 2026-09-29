// ============================================================================
// Mirrors backend/src/types/shape.types.ts. Kept as a separate file (not a
// shared package) to keep this a simple two-folder deliverable, but the
// shapes are wire-compatible JSON on both ends.
// ============================================================================

export type ShapeType = 'rectangle' | 'circle' | 'line' | 'pencil' | 'text' | 'eraser';

export type ToolType = ShapeType | 'select' | 'pan';

export interface Point {
  x: number;
  y: number;
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  zIndex: number;
  createdBy: string;
  updatedAt: number;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
}

export interface CircleShape extends BaseShape {
  type: 'circle';
}

export interface LineShape extends BaseShape {
  type: 'line';
  points: [Point, Point];
}

export interface PencilShape extends BaseShape {
  type: 'pencil';
  points: Point[];
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
}

export interface EraserShape extends BaseShape {
  type: 'eraser';
  points: Point[];
}

export type Shape =
  | RectangleShape
  | CircleShape
  | LineShape
  | PencilShape
  | TextShape
  | EraserShape;

export interface Viewport {
  offsetX: number;
  offsetY: number;
  zoom: number; // 1 = 100%
}

export interface RoomUser {
  userId: string;
  userName: string;
  color: string;
}

export interface RemoteCursor extends RoomUser {
  x: number;
  y: number;
}

// -- Socket payloads (mirrors backend) --------------------------------------

export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  userName: string;
}

export interface RoomStateSnapshot {
  roomId: string;
  shapes: Shape[];
  users: RoomUser[];
}

export interface ShapeAddedEvent {
  roomId: string;
  shape: Shape;
}

export interface ShapeUpdatedEvent {
  roomId: string;
  shapeId: string;
  patch: Partial<Shape>;
}

export interface ShapeDeletedEvent {
  roomId: string;
  shapeId: string;
}

export interface ShapesReorderedEvent {
  roomId: string;
  order: { id: string; zIndex: number }[];
}

export interface CursorMovePayload {
  roomId: string;
  userId: string;
  x: number;
  y: number;
}
