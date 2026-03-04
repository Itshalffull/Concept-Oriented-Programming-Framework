// ============================================================
// Clef Surface GTK Widget — Avatar
//
// Displays a user or entity identity as initials inside a
// circular Adwaita Avatar widget. When no name is provided,
// falls back to a placeholder glyph. Size affects diameter
// and text style.
//
// Adapts the avatar.widget spec: anatomy (root, image, fallback),
// states (loading, loaded, error), and connect attributes
// (data-part, data-size, data-state) to GTK4/Adwaita rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

// --------------- Helpers ---------------

function parseSizeParam(size: string): number {
  switch (size) {
    case 'sm': return 32;
    case 'lg': return 56;
    default: return 40; // md
  }
}

function getInitials(name: string): string {
  if (!name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
}

// --------------- Props ---------------

export interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: string;
  fallback?: string | null;
  showFallback?: boolean;
}

// --------------- Component ---------------

/**
 * Creates an Adwaita Avatar widget displaying user/entity identity
 * as initials inside a circular surface.
 */
export function createAvatar(props: AvatarProps = {}): Gtk.Widget {
  const {
    name = '',
    size = 'md',
    fallback = null,
    showFallback = false,
  } = props;

  const sizePx = parseSizeParam(size);
  const displayText = fallback ?? getInitials(name);

  const avatar = new Adw.Avatar({
    size: sizePx,
    text: name || displayText,
    showInitials: true,
  });

  avatar.set_tooltip_text(name || displayText);

  return avatar;
}
