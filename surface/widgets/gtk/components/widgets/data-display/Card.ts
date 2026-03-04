// ============================================================
// Clef Surface GTK Widget — Card
//
// Content container with optional header, body, and footer.
// Renders as a styled Gtk.Box with the "card" CSS class from
// Adwaita stylesheet.
//
// Adapts the card.widget spec: anatomy (root, header, body,
// footer), states (idle, hovered), and connect attributes
// to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface CardProps {
  title?: string | null;
  subtitle?: string | null;
  content?: Gtk.Widget | null;
  footer?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 card container with optional title, subtitle,
 * body content, and footer sections.
 */
export function createCard(props: CardProps = {}): Gtk.Widget {
  const {
    title = null,
    subtitle = null,
    content = null,
    footer = null,
  } = props;

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });
  card.get_style_context().add_class('card');

  if (title) {
    const header = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 2,
    });
    const titleLabel = new Gtk.Label({ label: title, xalign: 0 });
    titleLabel.get_style_context().add_class('title-3');
    header.append(titleLabel);

    if (subtitle) {
      const subtitleLabel = new Gtk.Label({ label: subtitle, xalign: 0 });
      subtitleLabel.get_style_context().add_class('dim-label');
      header.append(subtitleLabel);
    }
    card.append(header);
  }

  if (content) {
    card.append(content);
  }

  if (footer) {
    card.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }));
    card.append(footer);
  }

  return card;
}
