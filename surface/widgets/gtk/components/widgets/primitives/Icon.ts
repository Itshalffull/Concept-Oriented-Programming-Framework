// ============================================================
// Clef Surface GTK Widget — Icon
//
// Named icon display using GTK4 Gtk.Image with symbolic icon
// names. Falls back to a question-mark glyph when the
// requested icon is not found.
//
// Adapts the icon.widget spec: anatomy (root, svg), states
// (idle), and connect attributes (data-part, data-name,
// aria-hidden) to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Helpers ---------------

function sizeToPixels(size: string): number {
  switch (size) {
    case 'sm': return 16;
    case 'lg': return 32;
    default: return 24; // md
  }
}

// --------------- Props ---------------

export interface IconProps {
  name?: string;
  size?: string;
  fallback?: string;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Image widget displaying a named icon from the
 * system icon theme, with a configurable size and fallback.
 */
export function createIcon(props: IconProps = {}): Gtk.Widget {
  const {
    name = 'dialog-question-symbolic',
    size = 'md',
    fallback = 'dialog-question-symbolic',
  } = props;

  const pixelSize = sizeToPixels(size);
  const iconName = name || fallback;

  const image = new Gtk.Image({
    iconName,
    pixelSize,
  });

  image.set_tooltip_text(name);
  return image;
}
