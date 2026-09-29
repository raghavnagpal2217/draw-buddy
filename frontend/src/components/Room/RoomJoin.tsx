import React, { useState } from 'react';
import { generateId } from '../../utils/geometry';

interface RoomJoinProps {
  onJoin: (roomId: string, userName: string) => void;
}

export const RoomJoin: React.FC<RoomJoinProps> = ({ onJoin }) => {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');

  const handleCreate = () => {
    const newRoomId = generateId();
    onJoin(newRoomId, userName || 'Guest');
  };

  const handleJoin = () => {
    if (!roomId.trim()) return;
    onJoin(roomId.trim(), userName || 'Guest');
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-indigo-600">Draw Buddy</h1>
        <p className="mb-4 text-sm text-slate-500">Real-time collaborative whiteboard</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Your name</span>
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="e.g. Priya"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Room code</span>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Paste a room code to join"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </label>

        <button
          onClick={handleJoin}
          disabled={!roomId.trim()}
          className="mb-2 w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          Join Room
        </button>
        <button
          onClick={handleCreate}
          className="w-full rounded-md border border-indigo-200 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Create New Room
        </button>
      </div>
    </div>
  );
};
