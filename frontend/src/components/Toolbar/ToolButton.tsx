import React from 'react';

interface ToolButtonProps {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}

// Small, single-purpose, reusable component — kept separate from Toolbar so
// it can be reused (e.g. in a future mobile toolbar) without dragging in
// Toolbar's other state dependencies.
export const ToolButton: React.FC<ToolButtonProps> = ({ label, icon, active, onClick }) => (
  <button
    title={label}
    onClick={onClick}
    className={`flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors ${
      active ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'
    }`}
  >
    {icon}
  </button>
);
