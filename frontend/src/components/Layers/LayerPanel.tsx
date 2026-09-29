import React from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useSocketBus } from '../../hooks/SocketContext';

const SHAPE_ICONS: Record<string, string> = {
  rectangle: '▭',
  circle: '◯',
  line: '╱',
  pencil: '✏️',
  text: 'T',
  eraser: '🧹',
};

export const LayerPanel: React.FC = () => {
  const { shapes, shapeOrder, selectedShapeId, selectShape, deleteShape, reorderShape, users } =
    useCanvasStore();
  const socket = useSocketBus();

  // Top of the visual stack should appear first in the list (like most
  // design tools), so we reverse the zIndex-ascending order for display.
  const displayOrder = [...shapeOrder].reverse();

  const handleReorder = (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => {
    reorderShape(id, direction);
    const { shapeOrder: newOrder, shapes: newShapes } = useCanvasStore.getState();
    socket.emitReorder(newOrder.map((sid) => ({ id: sid, zIndex: newShapes[sid].zIndex })));
  };

  const handleDelete = (id: string) => {
    deleteShape(id);
    socket.emitDeleteShape(id);
  };

  return (
    <div className="flex w-64 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <h3 className="text-sm font-semibold text-slate-700">Collaborators ({users.length})</h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {users.map((u) => (
            <span
              key={u.userId}
              className="rounded-full px-2 py-0.5 text-xs text-white"
              style={{ backgroundColor: u.color }}
            >
              {u.userName}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Layers ({displayOrder.length})</h3>
        <ul className="space-y-1">
          {displayOrder.map((id) => {
            const shape = shapes[id];
            if (!shape) return null;
            const isSelected = selectedShapeId === id;
            return (
              <li
                key={id}
                onClick={() => selectShape(id)}
                className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer ${
                  isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span>{SHAPE_ICONS[shape.type]}</span>
                  <span className="truncate">{shape.type}</span>
                </span>
                <span className="hidden gap-1 group-hover:flex">
                  <button
                    title="Bring forward"
                    onClick={(e) => { e.stopPropagation(); handleReorder(id, 'forward'); }}
                    className="text-xs hover:text-indigo-600"
                  >
                    ▲
                  </button>
                  <button
                    title="Send backward"
                    onClick={(e) => { e.stopPropagation(); handleReorder(id, 'backward'); }}
                    className="text-xs hover:text-indigo-600"
                  >
                    ▼
                  </button>
                  <button
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(id); }}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
          {displayOrder.length === 0 && (
            <p className="text-xs text-slate-400">No shapes yet — start drawing!</p>
          )}
        </ul>
      </div>
    </div>
  );
};
