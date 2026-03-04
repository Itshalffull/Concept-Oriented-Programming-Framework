// ============================================================
// Clef Surface GTK Widget — Button
//
// Generic action trigger rendered using GTK4 Button with CSS
// classes for variant styling. Supports filled, outline, text,
// and danger variants with disabled and loading states.
//
// Adapts the button.widget spec: anatomy (root, label, icon,
// spinner), states (idle, hovered, focused, pressed, disabled,
// loading), and connect attributes (data-variant, data-size,
// data-state, role) to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface ButtonProps {
  label?: string;
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 Button with variant-based styling, supporting
 * filled, outline, text, and danger visual modes with a loading state.
 */
export function createButton(props: ButtonProps = {}): Gtk.Widget {
  const {
    label = '',
    variant = 'filled',
    size = 'md',
    disabled = false,
    loading = false,
    onClick,
  } = props;

  const button = new Gtk.Button();
  const isEnabled = !disabled && !loading;

  if (loading) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
    const spinner = new Gtk.Spinner({ spinning: true });
    box.append(spinner);
    if (label) {
      box.append(new Gtk.Label({ label }));
    }
    button.set_child(box);
  } else {
    button.set_label(label);
  }

  button.set_sensitive(isEnabled);

  // Apply variant CSS classes
  const ctx = button.get_style_context();
  switch (variant) {
    case 'filled':
      ctx.add_class('suggested-action');
      break;
    case 'outline':
      ctx.add_class('flat');
      break;
    case 'text':
      ctx.add_class('flat');
      break;
    case 'danger':
      ctx.add_class('destructive-action');
      break;
  }

  // Apply size CSS classes
  switch (size) {
    case 'sm':
      ctx.add_class('compact');
      break;
    case 'lg':
      ctx.add_class('large');
      break;
  }

  if (onClick) {
    button.connect('clicked', onClick);
  }

  return button;
}
