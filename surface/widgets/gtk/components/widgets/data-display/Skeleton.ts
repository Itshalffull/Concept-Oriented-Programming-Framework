// ============================================================
// Clef Surface GTK Widget — Skeleton
//
// Loading placeholder that mimics content layout. Renders
// animated placeholder boxes using Gtk.Box with pulsing CSS
// animation to indicate loading state.
//
// Adapts the skeleton.widget spec: anatomy (root, line, circle,
// rectangle), states (loading), and connect attributes to
// GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rectangle';
  width?: number;
  height?: number;
  lines?: number;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 skeleton loading placeholder with pulsing
 * animation to indicate content loading.
 */
export function createSkeleton(props: SkeletonProps = {}): Gtk.Widget {
  const {
    variant = 'text',
    width = 200,
    height = 16,
    lines = 3,
  } = props;

  if (variant === 'circle') {
    const circle = new Gtk.Box({
      widthRequest: height,
      heightRequest: height,
    });
    circle.get_style_context().add_class('skeleton');
    circle.get_style_context().add_class('skeleton-circle');
    return circle;
  }

  if (variant === 'rectangle') {
    const rect = new Gtk.Box({
      widthRequest: width,
      heightRequest: height,
    });
    rect.get_style_context().add_class('skeleton');
    return rect;
  }

  // Text variant — multiple lines
  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });

  for (let i = 0; i < lines; i++) {
    const lineWidth = i === lines - 1 ? Math.round(width * 0.7) : width;
    const line = new Gtk.Box({
      widthRequest: lineWidth,
      heightRequest: height,
    });
    line.get_style_context().add_class('skeleton');
    container.append(line);
  }

  return container;
}
