// ============================================================
// Clef Surface GTK Widget — TokenInput
//
// Token/tag entry input similar to ChipInput but with
// validation and custom token rendering.
//
// Adapts the token-input.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface TokenInputProps {
  tokens?: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange?: (tokens: string[]) => void;
  onValidate?: (token: string) => boolean;
}

// --------------- Component ---------------

export function createTokenInput(props: TokenInputProps = {}): Gtk.Widget {
  const { tokens = [], placeholder = 'Add token...', disabled = false, onChange, onValidate } = props;
  const currentTokens = [...tokens];

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
  const flowBox = new Gtk.FlowBox({ selectionMode: Gtk.SelectionMode.NONE, homogeneous: false });

  function rebuild(): void {
    let child = flowBox.get_first_child();
    while (child) { const next = child.get_next_sibling(); flowBox.remove(child); child = next; }

    currentTokens.forEach((token, idx) => {
      const tokenBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      tokenBox.get_style_context().add_class('card');
      tokenBox.append(new Gtk.Label({ label: token }));
      const removeBtn = new Gtk.Button({ iconName: 'window-close-symbolic' });
      removeBtn.get_style_context().add_class('flat');
      removeBtn.get_style_context().add_class('circular');
      removeBtn.connect('clicked', () => { currentTokens.splice(idx, 1); rebuild(); onChange?.([...currentTokens]); });
      tokenBox.append(removeBtn);
      flowBox.insert(tokenBox, -1);
    });
  }

  rebuild();
  box.append(flowBox);

  const entry = new Gtk.Entry({ placeholderText: placeholder });
  entry.set_sensitive(!disabled);
  entry.connect('activate', () => {
    const text = entry.get_text().trim();
    if (text && (!onValidate || onValidate(text))) {
      currentTokens.push(text);
      entry.set_text('');
      rebuild();
      onChange?.([...currentTokens]);
    }
  });
  box.append(entry);

  return box;
}
