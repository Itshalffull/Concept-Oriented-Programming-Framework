// ============================================================
// Clef Surface GTK Widget — Badge
//
// Small status indicator or count label. Renders as a compact
// Gtk.Label with rounded CSS styling and variant-based colors.
//
// Adapts the badge.widget spec: anatomy (root, label), states
// (idle), and connect attributes (data-variant) to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface BadgeProps {
  text?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

// --------------- Component ---------------

/**
 * Creates a GTK4 badge as a compact label with variant-based
 * CSS styling for status indication.
 */
export function createBadge(props: BadgeProps = {}): Gtk.Widget {
  const { text = '', variant = 'default' } = props;

  const label = new Gtk.Label({ label: text });
  const ctx = label.get_style_context();
  ctx.add_class('badge');
  ctx.add_class(`badge-${variant}`);

  return label;
}
