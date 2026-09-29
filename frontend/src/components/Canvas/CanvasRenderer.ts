import { Shape, Viewport } from '../../types/shape.types';
import { getBounds, getResizeHandles } from '../../utils/geometry';

// ============================================================================
// CanvasRenderer: a plain class that owns the 2D context and knows how to
// paint shapes, grid, and selection UI. It is intentionally NOT a React
// component — React re-renders are expensive and unnecessary here; instead
// we call `.render()` imperatively from a requestAnimationFrame loop (see
// CanvasBoard.tsx). This is the standard pattern for perf-critical canvas
// apps: React owns the DOM shell, a plain class owns pixels.
// ============================================================================

const GRID_SIZE = 40;
const GRID_COLOR = '#e2e8f0';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
  }

  resize(width: number, height: number, dpr: number) {
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(
    shapes: Shape[],
    viewport: Viewport,
    canvasWidth: number,
    canvasHeight: number,
    selectedShapeId: string | null,
    showGrid: boolean
  ) {
    const { ctx } = this;
    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (showGrid) this.drawGrid(viewport, canvasWidth, canvasHeight);

    // Apply the pan/zoom transform once, then draw everything in world
    // coordinates — avoids manually converting every shape's coordinates.
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    for (const shape of shapes) {
      this.drawShape(shape);
    }

    if (selectedShapeId) {
      const selected = shapes.find((s) => s.id === selectedShapeId);
      if (selected) this.drawSelectionOverlay(selected, viewport.zoom);
    }

    ctx.restore();
  }

  private drawGrid(viewport: Viewport, width: number, height: number) {
    const { ctx } = this;
    const size = GRID_SIZE * viewport.zoom;
    if (size < 4) return; // skip drawing an unreadably-dense grid at low zoom

    const offsetX = viewport.offsetX % size;
    const offsetY = viewport.offsetY % size;

    ctx.save();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < width; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawShape(shape: Shape) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = shape.strokeColor;
    ctx.fillStyle = shape.fillColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    switch (shape.type) {
      case 'rectangle': {
        const { x, y, width, height } = getBounds(shape);
        if (shape.fillColor !== 'transparent') ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
        break;
      }
      case 'circle': {
        const { x, y, width, height } = getBounds(shape);
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        if (shape.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        ctx.lineTo(shape.points[1].x, shape.points[1].y);
        ctx.stroke();
        break;
      }
      case 'pencil': {
        if (shape.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
        break;
      }
      case 'eraser': {
        // Eraser is rendered using destination-out compositing so it
        // truly clears pixels beneath it rather than painting white
        // (which would look wrong over colored backgrounds).
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = shape.strokeWidth * 4;
        if (shape.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          for (let i = 1; i < shape.points.length; i++) {
            ctx.lineTo(shape.points[i].x, shape.points[i].y);
          }
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'text': {
        ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
        ctx.fillStyle = shape.strokeColor;
        ctx.textBaseline = 'top';
        ctx.fillText(shape.text, shape.x, shape.y);
        break;
      }
    }
    ctx.restore();
  }

  private drawSelectionOverlay(shape: Shape, zoom: number) {
    const { ctx } = this;
    const { x, y, width, height } = getBounds(shape);

    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);

    const handles = getResizeHandles(shape, zoom);
    const handleSize = 8 / zoom;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5 / zoom;
    for (const point of Object.values(handles)) {
      ctx.beginPath();
      ctx.rect(point.x - handleSize / 2, point.y - handleSize / 2, handleSize, handleSize);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}
