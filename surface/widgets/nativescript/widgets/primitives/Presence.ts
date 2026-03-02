// ============================================================
// Clef Surface NativeScript Widget — Presence
//
// NativeScript presence indicator showing online/offline/away
// status. Renders as a small colored circle, typically
// overlaid on an avatar or user card.
// ============================================================

import { GridLayout, Color } from '@nativescript/core';

// --------------- Status Colors ---------------

export type PresenceStatus = 'online' | 'offline' | 'away' | 'busy' | 'dnd';

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: '#4CAF50',
  offline: '#9E9E9E',
  away: '#FFC107',
  busy: '#F44336',
  dnd: '#F44336',
};

// --------------- Props ---------------

export interface PresenceProps {
  status?: PresenceStatus;
  size?: number;
  borderWidth?: number;
  borderColor?: string;
}

// --------------- Component ---------------

export function createPresence(props: PresenceProps = {}): GridLayout {
  const {
    status = 'offline',
    size = 12,
    borderWidth = 2,
    borderColor = '#FFFFFF',
  } = props;

  const indicator = new GridLayout();
  indicator.className = `clef-presence clef-presence--${status}`;
  indicator.width = size;
  indicator.height = size;
  indicator.borderRadius = size / 2;
  indicator.backgroundColor = new Color(STATUS_COLORS[status]);
  indicator.borderWidth = borderWidth;
  indicator.borderColor = new Color(borderColor);
  indicator.horizontalAlignment = 'center';
  indicator.verticalAlignment = 'middle';

  // Expose a method to update status dynamically
  const setStatus = (newStatus: PresenceStatus) => {
    indicator.backgroundColor = new Color(STATUS_COLORS[newStatus]);
    indicator.className = `clef-presence clef-presence--${newStatus}`;
  };

  (indicator as any).__clefPresence = { setStatus };

  return indicator;
}

createPresence.displayName = 'Presence';
export default createPresence;
