// ============================================================
// Clef Surface NativeScript Widget — Chip
//
// Selectable/deletable chip element. Supports select, deselect,
// and delete actions via tap gestures.
// ============================================================

import {
  StackLayout,
  Label,
  Button,
  Color,
} from "@nativescript/core";

// --------------- Props ---------------

export interface ChipProps {
  label?: string;
  selected?: boolean;
  deletable?: boolean;
  disabled?: boolean;
  color?: string;
  value?: string;
  onSelect?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
}

// --------------- Component ---------------

export function createChip(props: ChipProps): StackLayout {
  const {
    label = "",
    selected = false,
    deletable = false,
    disabled = false,
    color,
    value,
    onSelect,
    onDeselect,
    onDelete,
  } = props;

  let isSelected = selected;

  const container = new StackLayout();
  container.className = "clef-widget-chip";
  container.orientation = "horizontal";
  container.verticalAlignment = "middle";
  container.padding = "4 8";
  container.isEnabled = !disabled;
  container.accessibilityRole = "button";
  container.accessibilityLabel = label;
  container.accessibilityState = { selected: isSelected, disabled };

  if (color) {
    container.backgroundColor = new Color(color);
  }

  const textLabel = new Label();
  textLabel.text = label;
  textLabel.verticalAlignment = "middle";
  container.addChild(textLabel);

  if (deletable) {
    const deleteBtn = new Button();
    deleteBtn.text = "×";
    deleteBtn.className = "clef-chip-delete";
    deleteBtn.marginLeft = 4;
    deleteBtn.accessibilityLabel = "Remove";

    deleteBtn.on("tap", () => {
      if (!disabled) onDelete?.();
    });

    container.addChild(deleteBtn);
  }

  container.on("tap", () => {
    if (disabled) return;
    if (isSelected) {
      isSelected = false;
      onDeselect?.();
    } else {
      isSelected = true;
      onSelect?.();
    }
  });

  return container;
}

export default createChip;
