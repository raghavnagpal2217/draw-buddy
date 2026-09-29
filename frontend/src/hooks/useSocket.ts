import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useCanvasStore } from '../store/useCanvasStore';
import {
  Shape,
  RoomStateSnapshot,
  ShapeAddedEvent,
  ShapeUpdatedEvent,
  ShapeDeletedEvent,
  ShapesReorderedEvent,
  CursorMovePayload,
  RoomUser,
} from '../types/shape.types';
import { throttle } from '../utils/throttle';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

// ============================================================================
// useSocket: the ONLY place that talks to Socket.IO. Components never touch
// the socket directly — they call store actions, and this hook is
// responsible for (a) forwarding local mutations to the server and
// (b) applying incoming server events to the store. This keeps a clean
// one-way-in, one-way-out boundary (Interface Segregation-ish: components
// depend only on the store's interface, not on transport details).
// ============================================================================

export function useSocket(roomId: string, userId: string, userName: string) {
  const socketRef = useRef<Socket | null>(null);

  const {
    loadShapes,
    setUsers,
    applyRemoteAdd,
    applyRemoteUpdate,
    applyRemoteDelete,
    applyRemoteReorder,
    setCursor,
    removeCursor,
  } = useCanvasStore();

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('room:join', { roomId, userId, userName });
    });

    socket.on('room:state', (payload: RoomStateSnapshot) => {
      loadShapes(payload.shapes);
      setUsers(payload.users);
    });

    socket.on('room:userJoined', (payload: { users: RoomUser[] }) => setUsers(payload.users));
    socket.on('room:userLeft', (payload: { users: RoomUser[]; userId: string }) => {
      setUsers(payload.users);
      removeCursor(payload.userId);
    });

    socket.on('shape:added', (payload: ShapeAddedEvent) => applyRemoteAdd(payload.shape));
    socket.on('shape:updated', (payload: ShapeUpdatedEvent) =>
      applyRemoteUpdate(payload.shapeId, payload.patch)
    );
    socket.on('shape:deleted', (payload: ShapeDeletedEvent) => applyRemoteDelete(payload.shapeId));
    socket.on('shapes:reordered', (payload: ShapesReorderedEvent) => applyRemoteReorder(payload.order));

    socket.on('cursor:moved', (payload: CursorMovePayload) => {
      const user = useCanvasStore.getState().users.find((u) => u.userId === payload.userId);
      setCursor({
        userId: payload.userId,
        x: payload.x,
        y: payload.y,
        userName: user?.userName || 'User',
        color: user?.color || '#94a3b8',
      });
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName]);

  const emitAddShape = useCallback(
    (shape: Shape) => socketRef.current?.emit('shape:add', { roomId, shape }),
    [roomId]
  );

  const emitDeleteShape = useCallback(
    (shapeId: string) => socketRef.current?.emit('shape:delete', { roomId, shapeId }),
    [roomId]
  );

  // Throttled to ~20 messages/sec — plenty smooth for remote viewers while
  // capping traffic during fast drags/resizes/pencil strokes.
  const emitUpdateShape = useRef(
    throttle((roomIdArg: string, shapeId: string, patch: Partial<Shape>) => {
      socketRef.current?.emit('shape:update', { roomId: roomIdArg, shapeId, patch });
    }, 50)
  ).current;

  const emitReorder = useCallback(
    (order: { id: string; zIndex: number }[]) =>
      socketRef.current?.emit('shapes:reorder', { roomId, order }),
    [roomId]
  );

  const emitCursorMove = useRef(
    throttle((roomIdArg: string, userIdArg: string, x: number, y: number) => {
      socketRef.current?.emit('cursor:move', { roomId: roomIdArg, userId: userIdArg, x, y });
    }, 50)
  ).current;

  return {
    emitAddShape,
    emitDeleteShape,
    emitUpdateShape: (shapeId: string, patch: Partial<Shape>) => emitUpdateShape(roomId, shapeId, patch),
    emitReorder,
    emitCursorMove: (x: number, y: number) => emitCursorMove(roomId, userId, x, y),
  };
}
