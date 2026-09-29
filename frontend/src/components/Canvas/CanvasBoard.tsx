import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { CanvasRenderer } from './CanvasRenderer';
import { createShape } from '../../utils/shapeFactory';
import {
  screenToWorld,
  getShapeAtPoint,
  getHandleAtPoint,
  applyResize,
  ResizeHandle,
} from '../../utils/geometry';
import { Shape, Point } from '../../types/shape.types';
import { useSocketBus } from '../../hooks/SocketContext';

// Interaction modes the pointer can be in — modeled explicitly instead of a
// pile of booleans, which keeps the mouse-move handler's branching simple
// and makes illegal states (e.g. "dragging AND resizing") unrepresentable.
type InteractionMode =
  | { kind: 'idle' }
  | { kind: 'drawing'; shapeId: string }
  | { kind: 'dragging'; shapeId: string; grabOffset: Point }
  | { kind: 'resizing'; shapeId: string; handle: ResizeHandle }
  | { kind: 'panning'; lastPoint: Point }
  | { kind: 'editingText'; shapeId: string };

export const CanvasBoard: React.FC = () => {
  const userId = useCanvasStore((s) => s.userId);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const modeRef = useRef<InteractionMode>({ kind: 'idle' });
  const [textEditValue, setTextEditValue] = useState('');
  const [textEditPos, setTextEditPos] = useState<{ x: number; y: number } | null>(null);

  const {
    shapes,
    shapeOrder,
    viewport,
    activeTool,
    strokeColor,
    fillColor,
    strokeWidth,
    selectedShapeId,
    zoomAt,
    panBy,
    addShape,
    updateShape,
    deleteShape,
    selectShape,
    setViewport,
  } = useCanvasStore();

  const socket = useSocketBus();

  // --------------------------------------------------------------------
  // Render loop: React state changes trigger this effect, which re-runs
  // renderer.render() imperatively. Using a plain effect (not RAF loop)
  // keeps CPU usage near-zero when idle, while still repainting instantly
  // on every store change since Zustand triggers a re-render on subscribe.
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!rendererRef.current) rendererRef.current = new CanvasRenderer(canvasRef.current);

    const container = containerRef.current!;
    const dpr = window.devicePixelRatio || 1;
    rendererRef.current.resize(container.clientWidth, container.clientHeight, dpr);

    const orderedShapes: Shape[] = shapeOrder.map((id) => shapes[id]).filter(Boolean);
    rendererRef.current.render(
      orderedShapes,
      viewport,
      container.clientWidth,
      container.clientHeight,
      selectedShapeId,
      true
    );
  }, [shapes, shapeOrder, viewport, selectedShapeId]);

  // Handle container resize (e.g. window resize, sidebar toggle).
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (!containerRef.current || !rendererRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      rendererRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight, dpr);
      // Trigger a repaint after resize.
      const orderedShapes = shapeOrder.map((id) => shapes[id]).filter(Boolean);
      rendererRef.current.render(
        orderedShapes,
        viewport,
        containerRef.current.clientWidth,
        containerRef.current.clientHeight,
        selectedShapeId,
        true
      );
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getMousePoint = useCallback((e: React.MouseEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // --------------------------------------------------------------------
  // POINTER DOWN: decides what interaction mode to enter based on the
  // active tool and what's under the cursor.
  // --------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    const screenPoint = getMousePoint(e);
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y, viewport);

    // Middle-click or space+drag would be added here for pan; we also
    // support a dedicated "pan" tool for trackpad-only users.
    if (activeTool === 'pan' || e.button === 1) {
      modeRef.current = { kind: 'panning', lastPoint: screenPoint };
      return;
    }

    if (activeTool === 'select') {
      const orderedShapes = shapeOrder.map((id) => shapes[id]).filter(Boolean);

      if (selectedShapeId) {
        const selected = shapes[selectedShapeId];
        const handle = selected ? getHandleAtPoint(worldPoint, selected, viewport.zoom) : null;
        if (handle) {
          modeRef.current = { kind: 'resizing', shapeId: selectedShapeId, handle };
          return;
        }
      }

      const hit = getShapeAtPoint(worldPoint, orderedShapes);
      if (hit) {
        selectShape(hit.id);
        modeRef.current = {
          kind: 'dragging',
          shapeId: hit.id,
          grabOffset: { x: worldPoint.x - hit.x, y: worldPoint.y - hit.y },
        };
      } else {
        selectShape(null);
      }
      return;
    }

    if (activeTool === 'text') {
      const shape = createShape({
        type: 'text',
        origin: worldPoint,
        userId,
        strokeColor,
        fillColor,
        strokeWidth,
        zIndex: shapeOrder.length,
      });
      addShape(shape);
      socket.emitAddShape(shape);
      setTextEditPos(screenPoint);
      setTextEditValue('');
      modeRef.current = { kind: 'editingText', shapeId: shape.id };
      return;
    }

    // Drawing tools: rectangle, circle, line, pencil, eraser.
    const shape = createShape({
      type: activeTool,
      origin: worldPoint,
      userId,
      strokeColor,
      fillColor,
      strokeWidth,
      zIndex: shapeOrder.length,
    });
    addShape(shape);
    modeRef.current = { kind: 'drawing', shapeId: shape.id };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const screenPoint = getMousePoint(e);
    const worldPoint = screenToWorld(screenPoint.x, screenPoint.y, viewport);
    socket.emitCursorMove(worldPoint.x, worldPoint.y);

    const mode = modeRef.current;

    if (mode.kind === 'panning') {
      const dx = screenPoint.x - mode.lastPoint.x;
      const dy = screenPoint.y - mode.lastPoint.y;
      panBy(dx, dy);
      modeRef.current = { kind: 'panning', lastPoint: screenPoint };
      return;
    }

    if (mode.kind === 'drawing') {
      const shape = shapes[mode.shapeId];
      if (!shape) return;
      if (shape.type === 'pencil' || shape.type === 'eraser') {
        const points = [...shape.points, worldPoint];
        updateShape(shape.id, { points } as Partial<Shape>, false);
      } else if (shape.type === 'line') {
        updateShape(shape.id, { points: [shape.points[0], worldPoint] } as Partial<Shape>, false);
      } else {
        // rectangle / circle: width/height grow from the fixed origin point.
        updateShape(
          shape.id,
          { width: worldPoint.x - shape.x, height: worldPoint.y - shape.y },
          false
        );
      }
      socket.emitUpdateShape(shape.id, shapes[shape.id]);
      return;
    }

    if (mode.kind === 'dragging') {
      const shape = shapes[mode.shapeId];
      if (!shape) return;
      const patch = { x: worldPoint.x - mode.grabOffset.x, y: worldPoint.y - mode.grabOffset.y };
      updateShape(shape.id, patch, false);
      socket.emitUpdateShape(shape.id, patch);
      return;
    }

    if (mode.kind === 'resizing') {
      const shape = shapes[mode.shapeId];
      if (!shape) return;
      // Compute delta relative to previous frame using shape's own current
      // position rather than tracking separate lastPoint state, since the
      // shape itself is our source of truth mid-resize.
      const dx = worldPoint.x - (shape.x + (mode.handle.includes('e') ? shape.width : 0));
      const dy = worldPoint.y - (shape.y + (mode.handle.includes('s') ? shape.height : 0));
      const patch = applyResize(shape, mode.handle, dx, dy);
      updateShape(shape.id, patch, false);
      socket.emitUpdateShape(shape.id, patch);
    }
  };

  const handleMouseUp = () => {
    const mode = modeRef.current;

    if (mode.kind === 'drawing') {
      const shape = shapes[mode.shapeId];
      // Record the finished shape in history as a single "add" command
      // (the intermediate updateShape calls during drawing were all
      // non-recording, so history stays a single clean undo step).
      if (shape) {
        useCanvasStore.setState((s) => ({
          undoStack: [...s.undoStack, { type: 'add', shape }],
          redoStack: [],
        }));
        socket.emitAddShape(shape);
      }
    }

    if (mode.kind === 'dragging' || mode.kind === 'resizing') {
      const shapeId = mode.shapeId;
      const shape = shapes[shapeId];
      if (shape) socket.emitUpdateShape(shapeId, shape);
    }

    modeRef.current = { kind: 'idle' };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom on trackpads is reported as wheel+ctrlKey.
      zoomAt(screenX, screenY, e.deltaY);
    } else {
      panBy(-e.deltaX, -e.deltaY);
    }
  };

  const commitTextEdit = () => {
    const mode = modeRef.current;
    if (mode.kind === 'editingText') {
      if (textEditValue.trim().length === 0) {
        deleteShape(mode.shapeId, false);
        socket.emitDeleteShape(mode.shapeId);
      } else {
        updateShape(mode.shapeId, { text: textEditValue } as Partial<Shape>);
        socket.emitUpdateShape(mode.shapeId, { text: textEditValue } as Partial<Shape>);
      }
    }
    modeRef.current = { kind: 'idle' };
    setTextEditPos(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
      deleteShape(selectedShapeId);
      socket.emitDeleteShape(selectedShapeId);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-white outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <canvas
        ref={canvasRef}
        className={
          activeTool === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'select'
            ? 'cursor-default'
            : 'cursor-crosshair'
        }
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {textEditPos && (
        <textarea
          autoFocus
          value={textEditValue}
          onChange={(e) => setTextEditValue(e.target.value)}
          onBlur={commitTextEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitTextEdit();
            }
          }}
          style={{
            position: 'absolute',
            left: textEditPos.x,
            top: textEditPos.y,
            font: `${20 * viewport.zoom}px sans-serif`,
          }}
          className="min-w-[120px] resize-none border border-indigo-400 bg-white/90 p-1 outline-none"
        />
      )}

      <RemoteCursors />
    </div>
  );
};

// Renders lightweight collaborator cursor labels over the canvas.
const RemoteCursors: React.FC = () => {
  const cursors = useCanvasStore((s) => s.cursors);
  const viewport = useCanvasStore((s) => s.viewport);

  return (
    <>
      {Object.values(cursors).map((cursor) => {
        const screenX = cursor.x * viewport.zoom + viewport.offsetX;
        const screenY = cursor.y * viewport.zoom + viewport.offsetY;
        return (
          <div
            key={cursor.userId}
            className="pointer-events-none absolute z-10 flex items-center gap-1 transition-transform duration-75"
            style={{ transform: `translate(${screenX}px, ${screenY}px)` }}
          >
            <div className="h-3 w-3 rotate-45 rounded-sm" style={{ backgroundColor: cursor.color }} />
            <span
              className="rounded px-1.5 py-0.5 text-xs text-white shadow"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName}
            </span>
          </div>
        );
      })}
    </>
  );
};
