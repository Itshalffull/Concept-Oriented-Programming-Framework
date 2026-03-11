// ============================================================
// Clef Surface GTK Widget — LayoutControlPanel
//
// Control panel for selecting and applying layout algorithms
// to a canvas. Provides algorithm selector (GtkDropDown),
// direction toggle group, spacing slider (GtkScale), and
// apply button.
//
// Adapts the layout-control-panel.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface LayoutAlgorithm {
  name: string;
  label: string;
}

// --------------- Props ---------------

export interface LayoutControlPanelProps {
  algorithms?: LayoutAlgorithm[];
  selectedAlgorithm?: string;
  direction?: 'top-to-bottom' | 'left-to-right' | 'bottom-to-top' | 'right-to-left';
  spacingX?: number;
  spacingY?: number;
  canvasId?: string;
  onApply?: (algorithm: string, direction: string, spacingX: number, spacingY: number) => void;
}

// --------------- Component ---------------

export function createLayoutControlPanel(props: LayoutControlPanelProps = {}): Gtk.Widget {
  const {
    algorithms = [],
    selectedAlgorithm,
    direction = 'top-to-bottom',
    spacingX = 80,
    spacingY = 100,
    onApply,
  } = props;

  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 });
  root.get_style_context().add_class('toolbar');

  // Section: Algorithm selector
  const algoLabel = new Gtk.Label({ label: 'Algorithm', xalign: 0 });
  algoLabel.get_style_context().add_class('dim-label');
  root.append(algoLabel);

  const algoNames = algorithms.map((a) => a.label);
  const algoModel = Gtk.StringList.new(algoNames);
  const algoDropDown = new Gtk.DropDown({ model: algoModel });

  // Pre-select if provided
  const selectedIdx = algorithms.findIndex((a) => a.name === selectedAlgorithm);
  if (selectedIdx >= 0) algoDropDown.set_selected(selectedIdx);
  root.append(algoDropDown);

  // Section: Direction toggle group
  const dirLabel = new Gtk.Label({ label: 'Direction', xalign: 0 });
  dirLabel.get_style_context().add_class('dim-label');
  root.append(dirLabel);

  const directions = ['top-to-bottom', 'left-to-right', 'bottom-to-top', 'right-to-left'] as const;
  const directionShort: Record<string, string> = {
    'top-to-bottom': '\u2193',
    'left-to-right': '\u2192',
    'bottom-to-top': '\u2191',
    'right-to-left': '\u2190',
  };

  const dirBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4, homogeneous: true });
  let activeDirection = direction;

  const dirButtons: Gtk.ToggleButton[] = [];
  directions.forEach((dir, i) => {
    const btn = new Gtk.ToggleButton({ label: directionShort[dir] });
    btn.set_tooltip_text(dir);
    if (dir === direction) btn.set_active(true);

    // Link to first button for radio-group behaviour
    if (i > 0) btn.set_group(dirButtons[0]);

    btn.connect('toggled', () => {
      if (btn.get_active()) activeDirection = dir;
    });

    dirButtons.push(btn);
    dirBox.append(btn);
  });
  root.append(dirBox);

  // Section: Spacing slider
  const spacingLabel = new Gtk.Label({ label: 'Spacing', xalign: 0 });
  spacingLabel.get_style_context().add_class('dim-label');
  root.append(spacingLabel);

  let currentSpacingX = spacingX;
  let currentSpacingY = spacingY;

  const xScale = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: new Gtk.Adjustment({
      value: spacingX,
      lower: 10,
      upper: 300,
      stepIncrement: 5,
      pageIncrement: 20,
    }),
    drawValue: true,
  });
  xScale.set_tooltip_text('Horizontal spacing');
  xScale.connect('value-changed', () => { currentSpacingX = xScale.get_value(); });
  root.append(xScale);

  const yScale = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: new Gtk.Adjustment({
      value: spacingY,
      lower: 10,
      upper: 300,
      stepIncrement: 5,
      pageIncrement: 20,
    }),
    drawValue: true,
  });
  yScale.set_tooltip_text('Vertical spacing');
  yScale.connect('value-changed', () => { currentSpacingY = yScale.get_value(); });
  root.append(yScale);

  // Apply button
  const applyBtn = new Gtk.Button({ label: 'Apply Layout' });
  applyBtn.get_style_context().add_class('suggested-action');
  applyBtn.set_sensitive(algorithms.length > 0);

  applyBtn.connect('clicked', () => {
    const idx = algoDropDown.get_selected();
    const algo = algorithms[idx]?.name ?? '';
    onApply?.(algo, activeDirection, currentSpacingX, currentSpacingY);
  });
  root.append(applyBtn);

  return root;
}
