// ============================================================================
// Core domain types shared across the backend. The frontend has a mirrored
// (but independently maintained) copy in frontend/src/types/shape.types.ts.
// Keeping them separate avoids coupling deploy cycles of client & server,
// while the shapes stay wire-compatible via plain JSON.
// ============================================================================

export type ShapeType = 'rectangle' | 'circle' | 'line' | 'pencil' | 'text' | 'eraser';

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

// ----------------------------------------------------------------------------
// Socket.IO event payloads. Keeping these as named interfaces (rather than
// loose `any`) is what lets both ends stay type-safe over the wire.
// ----------------------------------------------------------------------------

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

export interface RoomUser {
  userId: string;
  userName: string;
  color: string;
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
