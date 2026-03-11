// ============================================================
// Clef Surface GTK Widget — DiagramExportDialog
//
// Modal dialog for exporting a canvas diagram. Provides format
// selection (GtkDropDown), size inputs (GtkSpinButton),
// background and embed-data toggles (GtkSwitch), preview area,
// and export/cancel action buttons.
//
// Adapts the diagram-export-dialog.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ExportFormat {
  name: string;
  label: string;
  mime_type: string;
}

// --------------- Props ---------------

export interface DiagramExportDialogProps {
  canvasId?: string;
  formats?: ExportFormat[];
  selectedFormat?: string;
  width?: number;
  height?: number;
  includeBackground?: boolean;
  embedData?: boolean;
  onExport?: (format: string, width: number, height: number, background: boolean, embedData: boolean) => void;
  onCancel?: () => void;
}

// --------------- Component ---------------

export function createDiagramExportDialog(
  parent: Gtk.Window | null,
  props: DiagramExportDialogProps = {},
): Gtk.Window {
  const {
    formats = [],
    selectedFormat,
    width = 1920,
    height = 1080,
    includeBackground = true,
    embedData = false,
    onExport,
    onCancel,
  } = props;

  const dialog = new Gtk.Window({
    title: 'Export Diagram',
    modal: true,
    defaultWidth: 420,
    defaultHeight: 480,
    transientFor: parent ?? undefined,
  });

  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16 });
  content.set_margin_top(16);
  content.set_margin_bottom(16);
  content.set_margin_start(16);
  content.set_margin_end(16);
  dialog.set_child(content);

  // Format selector
  const formatLabel = new Gtk.Label({ label: 'Format', xalign: 0 });
  formatLabel.get_style_context().add_class('dim-label');
  content.append(formatLabel);

  const formatNames = formats.map((f) => f.label);
  const formatModel = Gtk.StringList.new(formatNames);
  const formatDropDown = new Gtk.DropDown({ model: formatModel });

  const selectedIdx = formats.findIndex((f) => f.name === selectedFormat);
  if (selectedIdx >= 0) formatDropDown.set_selected(selectedIdx);
  content.append(formatDropDown);

  // Size options
  const sizeLabel = new Gtk.Label({ label: 'Size', xalign: 0 });
  sizeLabel.get_style_context().add_class('dim-label');
  content.append(sizeLabel);

  const sizeBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });

  const widthSpin = new Gtk.SpinButton({
    adjustment: new Gtk.Adjustment({ value: width, lower: 100, upper: 8192, stepIncrement: 10, pageIncrement: 100 }),
    digits: 0,
  });
  widthSpin.set_tooltip_text('Width (px)');

  const xLabel = new Gtk.Label({ label: '\u00d7' });

  const heightSpin = new Gtk.SpinButton({
    adjustment: new Gtk.Adjustment({ value: height, lower: 100, upper: 8192, stepIncrement: 10, pageIncrement: 100 }),
    digits: 0,
  });
  heightSpin.set_tooltip_text('Height (px)');

  sizeBox.append(widthSpin);
  sizeBox.append(xLabel);
  sizeBox.append(heightSpin);
  content.append(sizeBox);

  // Background toggle
  const bgRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  bgRow.append(new Gtk.Label({ label: 'Include background', xalign: 0, hexpand: true }));
  const bgSwitch = new Gtk.Switch({ active: includeBackground, valign: Gtk.Align.CENTER });
  bgRow.append(bgSwitch);
  content.append(bgRow);

  // Embed data toggle
  const embedRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  embedRow.append(new Gtk.Label({ label: 'Embed round-trip data', xalign: 0, hexpand: true }));
  const embedSwitch = new Gtk.Switch({ active: embedData, valign: Gtk.Align.CENTER });
  embedRow.append(embedSwitch);
  content.append(embedRow);

  // Preview area
  const preview = new Gtk.DrawingArea({ widthRequest: 380, heightRequest: 120 });
  preview.set_draw_func((_area: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    cr.setSourceRGBA(0.95, 0.95, 0.95, 1);
    cr.rectangle(0, 0, w, h);
    cr.fill();
    cr.setSourceRGBA(0.6, 0.6, 0.6, 1);
    cr.setFontSize(12);
    cr.moveTo(w / 2 - 30, h / 2);
    cr.showText('Preview');
  });
  content.append(preview);

  // Action buttons
  const actionBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, halign: Gtk.Align.END });

  const cancelBtn = new Gtk.Button({ label: 'Cancel' });
  cancelBtn.connect('clicked', () => {
    onCancel?.();
    dialog.close();
  });
  actionBox.append(cancelBtn);

  const exportBtn = new Gtk.Button({ label: 'Export' });
  exportBtn.get_style_context().add_class('suggested-action');
  exportBtn.connect('clicked', () => {
    const idx = formatDropDown.get_selected();
    const fmt = formats[idx]?.name ?? '';
    onExport?.(
      fmt,
      widthSpin.get_value(),
      heightSpin.get_value(),
      bgSwitch.get_active(),
      embedSwitch.get_active(),
    );
    dialog.close();
  });
  actionBox.append(exportBtn);

  content.append(actionBox);

  return dialog;
}
