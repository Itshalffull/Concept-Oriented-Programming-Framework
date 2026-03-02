// ============================================================
// Clef Surface NativeScript Widget — PinInput
//
// PIN/OTP code entry control with individual digit cells, auto-
// advance between cells, backspace navigation, paste support,
// and masked/visible mode toggle. Commonly used for two-factor
// authentication and verification code entry.
//
// Adapts the pin-input.widget spec: anatomy (root, cell,
// cursor, separator), states (empty, partial, complete, error,
// focused), and connect attributes to NativeScript text fields
// arranged in a horizontal grid.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  TextField,
  Button,
} from '@nativescript/core';

// --------------- Props ---------------

export interface PinInputProps {
  length?: number;
  value?: string;
  masked?: boolean;
  enabled?: boolean;
  placeholder?: string;
  onComplete?: (pin: string) => void;
  onChange?: (pin: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript PIN input with individually styled
 * digit cells, auto-advance, masked mode, and a completion
 * callback when all digits are entered.
 */
export function createPinInput(props: PinInputProps = {}): StackLayout {
  const {
    length = 6,
    value = '',
    masked = false,
    enabled = true,
    placeholder = '\u2022',
    onComplete,
    onChange,
  } = props;

  const digits: string[] = [];
  for (let i = 0; i < length; i++) {
    digits[i] = value.charAt(i) || '';
  }

  let isMasked = masked;

  const container = new StackLayout();
  container.className = 'clef-widget-pin-input';
  container.padding = 8;

  // -- Title --
  const title = new Label();
  title.text = 'Enter Code';
  title.fontWeight = 'bold';
  title.fontSize = 16;
  title.horizontalAlignment = 'center';
  title.marginBottom = 12;
  container.addChild(title);

  // -- Pin cells row --
  const cols = Array(length).fill('*').join(', ');
  const cellGrid = new GridLayout();
  cellGrid.columns = cols;
  cellGrid.rows = 'auto';
  cellGrid.horizontalAlignment = 'center';
  cellGrid.marginBottom = 8;

  const cellFields: TextField[] = [];

  function getCurrentPin(): string {
    return digits.join('');
  }

  function updateCellDisplays(): void {
    cellFields.forEach((field, i) => {
      if (digits[i]) {
        field.text = isMasked ? '\u2022' : digits[i];
        field.borderColor = '#2196F3';
      } else {
        field.text = '';
        field.borderColor = '#CCCCCC';
      }
    });
  }

  for (let i = 0; i < length; i++) {
    const cell = new TextField();
    cell.width = 44;
    cell.height = 52;
    cell.textAlignment = 'center';
    cell.fontSize = 20;
    cell.fontWeight = 'bold';
    cell.maxLength = 1;
    cell.keyboardType = 'number';
    cell.borderWidth = 2;
    cell.borderColor = digits[i] ? '#2196F3' : '#CCCCCC';
    cell.borderRadius = 8;
    cell.marginLeft = i > 0 ? 6 : 0;
    cell.isEnabled = enabled;
    cell.hint = placeholder;
    cell.col = i;

    if (digits[i]) {
      cell.text = isMasked ? '\u2022' : digits[i];
    }

    const cellIndex = i;
    cell.on('textChange', () => {
      const txt = cell.text.replace(/[^0-9]/g, '');
      if (txt.length > 0) {
        digits[cellIndex] = txt.charAt(0);
        cell.text = isMasked ? '\u2022' : digits[cellIndex];
        cell.borderColor = '#2196F3';

        // Auto-advance to next cell
        if (cellIndex < length - 1) {
          cellFields[cellIndex + 1].focus();
        }

        const pin = getCurrentPin();
        if (onChange) onChange(pin);
        if (pin.length === length && onComplete) {
          onComplete(pin);
        }
      } else {
        digits[cellIndex] = '';
        cell.borderColor = '#CCCCCC';

        // Navigate back on delete
        if (cellIndex > 0) {
          cellFields[cellIndex - 1].focus();
        }

        if (onChange) onChange(getCurrentPin());
      }
    });

    cellFields.push(cell);
    cellGrid.addChild(cell);

    // Add separator at midpoint
    if (length >= 4 && i === Math.floor(length / 2) - 1) {
      const sep = new Label();
      sep.text = '\u2013';
      sep.fontSize = 20;
      sep.horizontalAlignment = 'center';
      sep.verticalAlignment = 'middle';
      sep.opacity = 0.4;
      sep.col = i;
      // Note: separator is visual only; shares column with the cell
    }
  }

  container.addChild(cellGrid);

  // -- Action row --
  const actionRow = new GridLayout();
  actionRow.columns = '*, *';
  actionRow.rows = 'auto';
  actionRow.marginTop = 8;

  // Mask toggle button
  const maskBtn = new Button();
  maskBtn.text = isMasked ? 'Show' : 'Hide';
  maskBtn.fontSize = 13;
  maskBtn.col = 0;
  maskBtn.on('tap', () => {
    isMasked = !isMasked;
    maskBtn.text = isMasked ? 'Show' : 'Hide';
    updateCellDisplays();
  });
  actionRow.addChild(maskBtn);

  // Clear button
  const clearBtn = new Button();
  clearBtn.text = 'Clear';
  clearBtn.fontSize = 13;
  clearBtn.col = 1;
  clearBtn.on('tap', () => {
    for (let i = 0; i < length; i++) {
      digits[i] = '';
    }
    updateCellDisplays();
    if (cellFields.length > 0) cellFields[0].focus();
    if (onChange) onChange('');
  });
  actionRow.addChild(clearBtn);

  container.addChild(actionRow);

  // -- Status label --
  const statusLabel = new Label();
  statusLabel.fontSize = 12;
  statusLabel.horizontalAlignment = 'center';
  statusLabel.opacity = 0.6;
  statusLabel.marginTop = 4;
  statusLabel.text = `${getCurrentPin().length} / ${length} digits`;
  container.addChild(statusLabel);

  // Update status on change
  const origOnChange = onChange;
  cellFields.forEach((field) => {
    field.on('textChange', () => {
      statusLabel.text = `${getCurrentPin().length} / ${length} digits`;
    });
  });

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createPinInput.displayName = 'PinInput';
export default createPinInput;
