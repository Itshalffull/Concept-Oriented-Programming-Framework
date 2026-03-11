// ============================================================
// Clef Surface GTK Widget — EmptyState
//
// Placeholder display for empty content areas. Shows an icon,
// title, description, and optional action button centered in
// the available space.
//
// Adapts the empty-state.widget spec: anatomy (root, icon,
// title, description, action), states (idle), and connect
// attributes to GTK4/Adwaita rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

// --------------- Props ---------------

export interface EmptyStateProps {
  iconName?: string;
  title?: string;
  description?: string | null;
  actionLabel?: string | null;
  onAction?: () => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4/Adwaita empty state placeholder with icon,
 * title, description, and optional action button.
 */
export function createEmptyState(props: EmptyStateProps = {}): Gtk.Widget {
  const {
    iconName = 'folder-symbolic',
    title = 'No items',
    description = null,
    actionLabel = null,
    onAction,
  } = props;

  const statusPage = new Adw.StatusPage({
    iconName,
    title,
    description: description ?? undefined,
  });

  if (actionLabel) {
    const button = new Gtk.Button({ label: actionLabel });
    button.get_style_context().add_class('suggested-action');
    button.set_halign(Gtk.Align.CENTER);
    if (onAction) {
      button.connect('clicked', onAction);
    }
    statusPage.set_child(button);
  }

  return statusPage;
}
