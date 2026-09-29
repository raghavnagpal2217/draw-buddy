import { useCallback, useEffect } from 'react';
import { useCanvasStore, ShapeCommand } from '../store/useCanvasStore';

// ============================================================================
// useHistory: connects local undo/redo to the network. Undo/redo is
// deliberately LOCAL-only in this design (each user can only undo their own
// action stack), but the *result* of an undo/redo (a shape appearing,
// disappearing, or changing) must still be broadcast so collaborators see it.
// Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) are also wired here.
// ============================================================================

interface HistoryBroadcaster {
  emitAddShape: (shape: any) => void;
  emitDeleteShape: (shapeId: string) => void;
  emitUpdateShape: (shapeId: string, patch: any) => void;
  emitReorder: (order: { id: string; zIndex: number }[]) => void;
}

function broadcastCommand(command: ShapeCommand, direction: 'undo' | 'redo', bus: HistoryBroadcaster) {
  switch (command.type) {
    case 'add':
      // Undoing an "add" means the shape should disappear for everyone;
      // redoing means it should reappear.
      direction === 'undo' ? bus.emitDeleteShape(command.shape.id) : bus.emitAddShape(command.shape);
      break;
    case 'delete':
      direction === 'undo' ? bus.emitAddShape(command.shape) : bus.emitDeleteShape(command.shape.id);
      break;
    case 'update':
      bus.emitUpdateShape(command.shapeId, direction === 'undo' ? command.before : command.after);
      break;
    case 'reorder':
      bus.emitReorder(direction === 'undo' ? command.before : command.after);
      break;
  }
}

export function useHistory(bus: HistoryBroadcaster) {
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);

  const handleUndo = useCallback(() => {
    const command = undo();
    if (command) broadcastCommand(command, 'undo', bus);
  }, [undo, bus]);

  const handleRedo = useCallback(() => {
    const command = redo();
    if (command) broadcastCommand(command, 'redo', bus);
  }, [redo, bus]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.ctrlKey || e.metaKey;
      if (!isMeta) return;
      if (e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  return { undo: handleUndo, redo: handleRedo };
}
