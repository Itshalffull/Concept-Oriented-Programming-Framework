// ============================================================
// Clef Surface GTK Widget — Rating
//
// Star rating input. Renders as a horizontal row of star
// buttons (filled/empty) for rating selection.
//
// Adapts the rating.widget spec: anatomy (root, star), states
// (idle, hovering, selected), and connect attributes to GTK4
// rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface RatingProps {
  value?: number;
  max?: number;
  disabled?: boolean;
  onRatingChange?: (value: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 star rating input as a row of clickable
 * star icon buttons.
 */
export function createRating(props: RatingProps = {}): Gtk.Widget {
  const {
    value = 0,
    max = 5,
    disabled = false,
    onRatingChange,
  } = props;

  let currentValue = value;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 2,
  });

  const buttons: Gtk.Button[] = [];

  function updateStars(): void {
    buttons.forEach((btn, idx) => {
      const icon = idx < currentValue
        ? 'starred-symbolic'
        : 'non-starred-symbolic';
      (btn.get_child() as Gtk.Image)?.set_from_icon_name(icon);
    });
  }

  for (let i = 0; i < max; i++) {
    const iconName = i < value ? 'starred-symbolic' : 'non-starred-symbolic';
    const btn = new Gtk.Button();
    btn.set_child(new Gtk.Image({ iconName, pixelSize: 20 }));
    btn.get_style_context().add_class('flat');
    btn.set_sensitive(!disabled);

    btn.connect('clicked', () => {
      currentValue = i + 1;
      updateStars();
      onRatingChange?.(currentValue);
    });

    buttons.push(btn);
    box.append(btn);
  }

  return box;
}
