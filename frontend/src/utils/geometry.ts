import { Shape, Point, Viewport } from '../types/shape.types';

// ============================================================================
// Pure geometry helpers. No React, no canvas context — easy to unit test.
// ============================================================================

/** Converts a screen-space point (mouse event) into world/canvas space,
 *  accounting for pan offset and zoom. This is the single source of truth
 *  for that conversion so pan/zoom math never gets duplicated. */
export function screenToWorld(screenX: number, screenY: number, viewport: Viewport): Point {
  return {
    x: (screenX - viewport.offsetX) / viewport.zoom,
    y: (screenY - viewport.offsetY) / viewport.zoom,
  };
}

export function worldToScreen(worldX: number, worldY: number, viewport: Viewport): Point {
  return {
    x: worldX * viewport.zoom + viewport.offsetX,
    y: worldY * viewport.zoom + viewport.offsetY,
  };
}

/** Normalizes a shape's bounding box regardless of negative width/height
 *  (e.g. user drags a rectangle from bottom-right to top-left). */
export function getBounds(shape: Shape): { x: number; y: number; width: number; height: number } {
  const x = shape.width < 0 ? shape.x + shape.width : shape.x;
  const y = shape.height < 0 ? shape.y + shape.height : shape.y;
  return { x, y, width: Math.abs(shape.width), height: Math.abs(shape.height) };
}

/** Hit test: is a world-space point inside this shape's bounding box?
 *  Uses bounding-box test for simplicity/performance; sufficient for
 *  selection UX at typical zoom levels. */
export function isPointInShape(point: Point, shape: Shape): boolean {
  const { x, y, width, height } = getBounds(shape);
  const padding = Math.max(shape.strokeWidth, 4); // easier to click thin lines
  return (
    point.x >= x - padding &&
    point.x <= x + width + padding &&
    point.y >= y - padding &&
    point.y <= y + height + padding
  );
}

/** Returns the topmost shape (highest zIndex) under a point, or null. */
export function getShapeAtPoint(point: Point, shapes: Shape[]): Shape | null {
  let best: Shape | null = null;
  for (const shape of shapes) {
    if (isPointInShape(point, shape)) {
      if (!best || shape.zIndex > best.zIndex) best = shape;
    }
  }
  return best;
}

export type ResizeHandle =
  | 'nw' | 'n' | 'ne'
  | 'w'          | 'e'
  | 'sw' | 's' | 'se';

const HANDLE_SIZE = 8;

/** Returns the world-space centers of all 8 resize handles for a shape. */
export function getResizeHandles(shape: Shape, zoom: number): Record<ResizeHandle, Point> {
  const { x, y, width, height } = getBounds(shape);
  const midX = x + width / 2;
  const midY = y + height / 2;
  return {
    nw: { x, y },
    n: { x: midX, y },
    ne: { x: x + width, y },
    w: { x, y: midY },
    e: { x: x + width, y: midY },
    sw: { x, y: y + height },
    s: { x: midX, y: y + height },
    se: { x: x + width, y: y + height },
  };
}

/** Determines which resize handle (if any) a world point is over. */
export function getHandleAtPoint(point: Point, shape: Shape, zoom: number): ResizeHandle | null {
  const handles = getResizeHandles(shape, zoom);
  const hitRadius = (HANDLE_SIZE / zoom) * 1.2;
  for (const key of Object.keys(handles) as ResizeHandle[]) {
    const h = handles[key];
    if (Math.abs(point.x - h.x) <= hitRadius && Math.abs(point.y - h.y) <= hitRadius) {
      return key;
    }
  }
  return null;
}

/** Applies a resize-handle drag delta to a shape, returning a patch. Keeps
 *  the opposite edge/corner anchored, matching standard design-tool UX. */
export function applyResize(
  shape: Shape,
  handle: ResizeHandle,
  dx: number,
  dy: number
): Partial<Shape> {
  let { x, y, width, height } = shape;

  if (handle.includes('n')) { y += dy; height -= dy; }
  if (handle.includes('s')) { height += dy; }
  if (handle.includes('w')) { x += dx; width -= dx; }
  if (handle.includes('e')) { width += dx; }

  return { x, y, width, height };
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Snaps a value to the nearest grid line — used optionally for alignment. */
export function snapToGrid(value: number, gridSize = 20): number {
  return Math.round(value / gridSize) * gridSize;
}
