import { Shape } from '../types/shape.types';

// ============================================================================
// Serialization boundary. All shapes are plain JSON-serializable objects by
// construction (no class instances, no functions, no circular refs), so
// serialization is close to trivial — but centralizing it here means we have
// ONE place to add versioning/migration logic later if the shape schema
// changes, and one place to validate incoming data before trusting it.
// ============================================================================

export interface SerializedCanvas {
  version: 1;
  exportedAt: number;
  shapes: Shape[];
}

export function serializeCanvas(shapes: Shape[]): string {
  const payload: SerializedCanvas = {
    version: 1,
    exportedAt: Date.now(),
    shapes,
  };
  return JSON.stringify(payload);
}

export function deserializeCanvas(json: string): Shape[] {
  try {
    const parsed = JSON.parse(json) as SerializedCanvas;
    if (!parsed || !Array.isArray(parsed.shapes)) {
      throw new Error('Malformed canvas payload: missing shapes array');
    }
    return parsed.shapes.filter(isValidShape);
  } catch (err) {
    console.error('[serialization] failed to parse canvas JSON:', err);
    return [];
  }
}

/** Basic runtime validation for data coming over the wire — we never trust
 *  a remote payload blindly, since a malformed shape could crash the
 *  renderer for every client in the room. */
function isValidShape(shape: unknown): shape is Shape {
  if (typeof shape !== 'object' || shape === null) return false;
  const s = shape as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.type === 'string' &&
    typeof s.x === 'number' &&
    typeof s.y === 'number' &&
    typeof s.width === 'number' &&
    typeof s.height === 'number'
  );
}

export function downloadCanvasAsJson(shapes: Shape[], filename = 'drawing.json') {
  const blob = new Blob([serializeCanvas(shapes)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
