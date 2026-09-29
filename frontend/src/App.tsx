import React, { useState, useEffect } from 'react';
import { RoomJoin } from './components/Room/RoomJoin';
import { CanvasBoard } from './components/Canvas/CanvasBoard';
import { Toolbar } from './components/Toolbar/Toolbar';
import { LayerPanel } from './components/Layers/LayerPanel';
import { useCanvasStore } from './store/useCanvasStore';
import { SocketProvider, useSocketBus } from './hooks/SocketContext';
import { useHistory } from './hooks/useHistory';
import { generateId } from './utils/geometry';

// Persist a stable per-browser user id across reloads so reconnecting to a
// room looks like "the same person coming back" rather than a new user.
function getOrCreateUserId(): string {
  const key = 'draw-buddy:userId';
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateId();
    localStorage.setItem(key, id);
  }
  return id;
}

const App: React.FC = () => {
  const [session, setSession] = useState<{ roomId: string; userName: string } | null>(null);
  const [userId] = useState(getOrCreateUserId);
  const setRoom = useCanvasStore((s) => s.setRoom);

  useEffect(() => {
    // Support deep-linking: /?room=abc123 auto-fills the room join screen.
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setSession({ roomId: room, userName: 'Guest' });
  }, []);

  if (!session) {
    return (
      <RoomJoin
        onJoin={(roomId, userName) => {
          setSession({ roomId, userName });
          setRoom(roomId, userId, userName);
          window.history.replaceState(null, '', `?room=${roomId}`);
        }}
      />
    );
  }

  return <RoomWorkspace roomId={session.roomId} userId={userId} userName={session.userName} />;
};

// Split out so the SocketProvider (which needs a stable roomId) only mounts
// once we actually have a room, keeping App's routing logic simple. Wrapping
// in SocketProvider here guarantees exactly one socket connection is shared
// by Toolbar (via useHistory), CanvasBoard, and LayerPanel below.
const RoomWorkspace: React.FC<{ roomId: string; userId: string; userName: string }> = ({
  roomId,
  userId,
  userName,
}) => {
  return (
    <SocketProvider roomId={roomId} userId={userId} userName={userName}>
      <RoomWorkspaceInner roomId={roomId} />
    </SocketProvider>
  );
};

const RoomWorkspaceInner: React.FC<{ roomId: string }> = ({ roomId }) => {
  const bus = useSocketBus();
  const { undo, redo } = useHistory(bus);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50">
      <Toolbar onUndo={undo} onRedo={redo} />
      <div className="flex flex-1 overflow-hidden">
        <CanvasBoard />
        <LayerPanel />
      </div>
      <div className="border-t border-slate-200 bg-white px-4 py-1 text-xs text-slate-400">
        Room: {roomId} — share this URL to invite collaborators
      </div>
    </div>
  );
};

export default App;
