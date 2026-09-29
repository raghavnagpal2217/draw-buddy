import React, { createContext, useContext } from 'react';
import { useSocket } from './useSocket';

// ============================================================================
// A single socket connection must be shared across CanvasBoard, LayerPanel,
// and the undo/redo toolbar — otherwise each component's own useSocket()
// call would open a redundant connection. React Context is the natural fix:
// RoomWorkspace creates ONE socket bus, and everything below it consumes
// the same instance via useSocketBus().
// ============================================================================

type SocketBus = ReturnType<typeof useSocket>;

const SocketContext = createContext<SocketBus | null>(null);

export const SocketProvider: React.FC<{
  roomId: string;
  userId: string;
  userName: string;
  children: React.ReactNode;
}> = ({ roomId, userId, userName, children }) => {
  const bus = useSocket(roomId, userId, userName);
  return <SocketContext.Provider value={bus}>{children}</SocketContext.Provider>;
};

export function useSocketBus(): SocketBus {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketBus must be used within a SocketProvider');
  return ctx;
}
