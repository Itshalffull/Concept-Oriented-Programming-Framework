// ============================================================
// Clef Surface GTK Widget — BlockEditor
//
// Block-based content editor (Notion/Gutenberg style). Renders
// content blocks as a vertical stack of editable rows with
// type indicators and drag handles.
//
// Adapts the block-editor.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface ContentBlock { id: string; type: string; content: string; }

// --------------- Props ---------------

export interface BlockEditorProps {
  blocks?: ContentBlock[];
  onBlockChange?: (id: string, content: string) => void;
  onAddBlock?: (afterId: string | null) => void;
  onRemoveBlock?: (id: string) => void;
}

// --------------- Component ---------------

export function createBlockEditor(props: BlockEditorProps = {}): Gtk.Widget {
  const { blocks = [], onBlockChange, onAddBlock, onRemoveBlock } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });

  blocks.forEach((block) => {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });

    const typeLabel = new Gtk.Label({ label: block.type, widthChars: 8 });
    typeLabel.get_style_context().add_class('dim-label');
    row.append(typeLabel);

    const entry = new Gtk.Entry({ text: block.content, hexpand: true });
    entry.connect('changed', () => onBlockChange?.(block.id, entry.get_text()));
    row.append(entry);

    const removeBtn = new Gtk.Button({ iconName: 'list-remove-symbolic' });
    removeBtn.get_style_context().add_class('flat');
    removeBtn.connect('clicked', () => onRemoveBlock?.(block.id));
    row.append(removeBtn);

    box.append(row);
  });

  const addBtn = new Gtk.Button({ label: '+ Add Block' });
  addBtn.get_style_context().add_class('flat');
  addBtn.connect('clicked', () => onAddBlock?.(blocks.length > 0 ? blocks[blocks.length - 1].id : null));
  box.append(addBtn);

  return box;
}
