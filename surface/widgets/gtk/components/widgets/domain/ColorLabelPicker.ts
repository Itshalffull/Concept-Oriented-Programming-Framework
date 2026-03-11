// ============================================================
// Clef Surface GTK Widget — ColorLabelPicker
//
// Combined color + label picker for tagging. Displays preset
// color labels with names for category/tag selection.
//
// Adapts the color-label-picker.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ColorLabel { id: string; name: string; color: string; }

// --------------- Props ---------------

export interface ColorLabelPickerProps {
  labels?: ColorLabel[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

export function createColorLabelPicker(props: ColorLabelPickerProps = {}): Gtk.Widget {
  const { labels = [], selectedId = null, onSelect } = props;

  const flowBox = new Gtk.FlowBox({ selectionMode: Gtk.SelectionMode.NONE, homogeneous: false });

  labels.forEach((label) => {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
    const dot = new Gtk.DrawingArea({ widthRequest: 12, heightRequest: 12 });
    dot.set_draw_func((_area: Gtk.DrawingArea, cr: any) => {
      cr.setSourceRGBA(0.5, 0.5, 0.5, 1); // Fallback
      cr.arc(6, 6, 6, 0, Math.PI * 2);
      cr.fill();
    });
    box.append(dot);

    const btn = new Gtk.Button({ label: label.name });
    btn.get_style_context().add_class('flat');
    if (label.id === selectedId) btn.get_style_context().add_class('accent');
    btn.connect('clicked', () => onSelect?.(label.id));
    box.append(btn);

    flowBox.insert(box, -1);
  });

  return flowBox;
}
