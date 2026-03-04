// ============================================================
// Clef Surface GTK Widget — Chart
//
// Data visualization chart. Renders a text-based chart
// representation using Gtk.DrawingArea for custom canvas
// drawing of bar/line chart data points.
//
// Adapts the chart.widget spec: anatomy (root, canvas, legend,
// axis, dataPoint, tooltip), states (idle, hovering), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ChartDataPoint {
  label: string;
  value: number;
}

// --------------- Props ---------------

export interface ChartProps {
  type?: 'bar' | 'line';
  data?: ChartDataPoint[];
  title?: string | null;
  width?: number;
  height?: number;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 chart widget using Gtk.DrawingArea for custom
 * rendering of bar or line chart data.
 */
export function createChart(props: ChartProps = {}): Gtk.Widget {
  const {
    type = 'bar',
    data = [],
    title = null,
    width = 400,
    height = 200,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });

  if (title) {
    const titleLabel = new Gtk.Label({ label: title, xalign: 0 });
    titleLabel.get_style_context().add_class('title-4');
    container.append(titleLabel);
  }

  const drawingArea = new Gtk.DrawingArea({
    widthRequest: width,
    heightRequest: height,
  });

  drawingArea.set_draw_func((_area: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    if (data.length === 0) return;

    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const padding = 40;
    const chartW = w - padding * 2;
    const chartH = h - padding * 2;

    // Background
    cr.setSourceRGBA(0.95, 0.95, 0.95, 1);
    cr.rectangle(padding, padding, chartW, chartH);
    cr.fill();

    if (type === 'bar') {
      const barWidth = chartW / data.length * 0.8;
      const gap = chartW / data.length * 0.2;

      data.forEach((point, i) => {
        const barH = (point.value / maxVal) * chartH;
        const x = padding + i * (barWidth + gap);
        const y = padding + chartH - barH;

        cr.setSourceRGBA(0.2, 0.5, 0.9, 1);
        cr.rectangle(x, y, barWidth, barH);
        cr.fill();
      });
    } else {
      // Line chart
      cr.setSourceRGBA(0.2, 0.5, 0.9, 1);
      cr.setLineWidth(2);

      data.forEach((point, i) => {
        const x = padding + (i / Math.max(data.length - 1, 1)) * chartW;
        const y = padding + chartH - (point.value / maxVal) * chartH;
        if (i === 0) {
          cr.moveTo(x, y);
        } else {
          cr.lineTo(x, y);
        }
      });
      cr.stroke();
    }
  });

  container.append(drawingArea);

  // Legend
  const legend = new Gtk.FlowBox({
    selectionMode: Gtk.SelectionMode.NONE,
    homogeneous: false,
  });
  data.forEach((point) => {
    legend.insert(new Gtk.Label({ label: `${point.label}: ${point.value}` }), -1);
  });
  container.append(legend);

  return container;
}
