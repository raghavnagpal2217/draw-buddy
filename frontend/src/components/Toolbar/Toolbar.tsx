import React from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { ToolType } from '../../types/shape.types';
import { downloadCanvasAsJson } from '../../utils/serialization';
import { ToolButton } from './ToolButton';

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
}

const TOOLS: { id: ToolType; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pan', label: 'Pan', icon: '✋' },
  { id: 'pencil', label: 'Pencil', icon: '✏️' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭' },
  { id: 'circle', label: 'Circle', icon: '◯' },
  { id: 'line', label: 'Line', icon: '╱' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'eraser', label: 'Eraser', icon: '🧹' },
];

export const Toolbar: React.FC<ToolbarProps> = ({ onUndo, onRedo }) => {
  const {
    activeTool,
    setTool,
    strokeColor,
    setStrokeColor,
    fillColor,
    setFillColor,
    strokeWidth,
    setStrokeWidth,
    shapes,
    viewport,
    setViewport,
    undoStack,
    redoStack,
  } = useCanvasStore();

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
      <span className="mr-2 text-lg font-bold text-indigo-600">Draw Buddy</span>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {TOOLS.map((tool) => (
          <ToolButton
            key={tool.id}
            label={tool.label}
            icon={tool.icon}
            active={activeTool === tool.id}
            onClick={() => setTool(tool.id)}
          />
        ))}
      </div>

      <div className="mx-2 h-6 w-px bg-slate-200" />

      <label className="flex items-center gap-1 text-xs text-slate-600">
        Stroke
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => setStrokeColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-slate-300"
        />
      </label>

      <label className="flex items-center gap-1 text-xs text-slate-600">
        Fill
        <input
          type="color"
          value={fillColor === 'transparent' ? '#ffffff' : fillColor}
          onChange={(e) => setFillColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-slate-300"
        />
        <button
          className="ml-1 text-[10px] text-indigo-500 underline"
          onClick={() => setFillColor('transparent')}
        >
          none
        </button>
      </label>

      <label className="flex items-center gap-1 text-xs text-slate-600">
        Width
        <input
          type="range"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-20"
        />
      </label>

      <div className="mx-2 h-6 w-px bg-slate-200" />

      <button
        onClick={onUndo}
        disabled={undoStack.length === 0}
        className="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-30"
        title="Undo (Ctrl+Z)"
      >
        ↩ Undo
      </button>
      <button
        onClick={onRedo}
        disabled={redoStack.length === 0}
        className="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-30"
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪ Redo
      </button>

      <div className="mx-2 h-6 w-px bg-slate-200" />

      <button
        onClick={() => setViewport({ zoom: Math.max(0.1, viewport.zoom - 0.1) })}
        className="rounded px-2 py-1 text-sm hover:bg-slate-100"
      >
        −
      </button>
      <span className="w-12 text-center text-xs text-slate-500">{Math.round(viewport.zoom * 100)}%</span>
      <button
        onClick={() => setViewport({ zoom: Math.min(4, viewport.zoom + 0.1) })}
        className="rounded px-2 py-1 text-sm hover:bg-slate-100"
      >
        +
      </button>
      <button
        onClick={() => setViewport({ zoom: 1, offsetX: 0, offsetY: 0 })}
        className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
      >
        Reset
      </button>

      <div className="ml-auto">
        <button
          onClick={() => downloadCanvasAsJson(Object.values(shapes))}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Export JSON
        </button>
      </div>
    </div>
  );
};
