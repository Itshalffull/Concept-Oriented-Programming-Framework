// ============================================================
// Clef Surface GTK Widget — Tooltip
//
// Informational text popup shown on hover. Uses the native
// GTK4 tooltip system via set_tooltip_text or set_tooltip_markup
// on the target widget.
//
// Adapts the tooltip.widget spec: anatomy (root, trigger,
// positioner, content, arrow), states (open, closed), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface TooltipProps {
  text?: string;
  markup?: string | null;
  target?: Gtk.Widget | null;
}

// --------------- Component ---------------

/**
 * Applies a tooltip to a GTK4 widget using the native tooltip
 * system. Returns the target widget with tooltip applied.
 */
export function createTooltip(props: TooltipProps = {}): Gtk.Widget {
  const {
    text = '',
    markup = null,
    target = null,
  } = props;

  const widget = target ?? new Gtk.Label({ label: text });

  if (markup) {
    widget.set_tooltip_markup(markup);
  } else {
    widget.set_tooltip_text(text);
  }

  widget.set_has_tooltip(true);
  return widget;
}
