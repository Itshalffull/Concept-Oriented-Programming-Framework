// ============================================================
// Clef Surface GTK Widget — StatCard
//
// Statistics summary card displaying a metric value with label,
// optional trend indicator, and change percentage.
//
// Adapts the stat-card.widget spec: anatomy (root, label,
// value, trend, change), states (idle, up, down, neutral), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface StatCardProps {
  label?: string;
  value?: string;
  change?: string | null;
  trend?: 'up' | 'down' | 'neutral';
}

// --------------- Component ---------------

/**
 * Creates a GTK4 statistics card with metric value, label,
 * and optional trend indicator.
 */
export function createStatCard(props: StatCardProps = {}): Gtk.Widget {
  const {
    label = '',
    value = '0',
    change = null,
    trend = 'neutral',
  } = props;

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  card.get_style_context().add_class('card');

  // Label
  const labelWidget = new Gtk.Label({ label, xalign: 0 });
  labelWidget.get_style_context().add_class('dim-label');
  card.append(labelWidget);

  // Value
  const valueWidget = new Gtk.Label({ label: value, xalign: 0 });
  valueWidget.get_style_context().add_class('title-1');
  card.append(valueWidget);

  // Trend + change
  if (change) {
    const trendBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 4,
    });

    const trendIcon = trend === 'up'
      ? 'pan-up-symbolic'
      : trend === 'down'
        ? 'pan-down-symbolic'
        : 'horizontal-arrows-symbolic';

    trendBox.append(new Gtk.Image({ iconName: trendIcon, pixelSize: 12 }));

    const changeLabel = new Gtk.Label({ label: change });
    if (trend === 'up') {
      changeLabel.get_style_context().add_class('success');
    } else if (trend === 'down') {
      changeLabel.get_style_context().add_class('error');
    }
    trendBox.append(changeLabel);

    card.append(trendBox);
  }

  return card;
}
