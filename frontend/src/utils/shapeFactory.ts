import { Shape, ShapeType, Point } from '../types/shape.types';
import { generateId } from './geometry';

// ============================================================================
// Centralizes "how does a new shape of type X get created". This is the
// Factory pattern: adding a new shape type means adding one branch here,
// not hunting through every component that might construct a shape.
// ============================================================================

interface CreateShapeOptions {
  type: ShapeType;
  origin: Point;
  userId: string;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  zIndex: number;
}

export function createShape(opts: CreateShapeOptions): Shape {
  const base = {
    id: generateId(),
    x: opts.origin.x,
    y: opts.origin.y,
    width: 0,
    height: 0,
    rotation: 0,
    strokeColor: opts.strokeColor,
    fillColor: opts.fillColor,
    strokeWidth: opts.strokeWidth,
    zIndex: opts.zIndex,
    createdBy: opts.userId,
    updatedAt: Date.now(),
  };

  switch (opts.type) {
    case 'rectangle':
      return { ...base, type: 'rectangle' };
    case 'circle':
      return { ...base, type: 'circle' };
    case 'line':
      return { ...base, type: 'line', points: [opts.origin, opts.origin] };
    case 'pencil':
      return { ...base, type: 'pencil', points: [opts.origin] };
    case 'eraser':
      return { ...base, type: 'eraser', points: [opts.origin], strokeColor: '#ffffff' };
    case 'text':
      return { ...base, type: 'text', text: '', fontSize: 20, fontFamily: 'sans-serif', width: 200, height: 30 };
    default: {
      const _exhaustive: never = opts.type;
      throw new Error(`Unknown shape type: ${_exhaustive}`);
    }
  }
}
