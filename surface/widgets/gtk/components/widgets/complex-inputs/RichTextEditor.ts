// ============================================================
// Clef Surface GTK Widget — RichTextEditor
//
// WYSIWYG rich text editor with formatting toolbar. Uses
// Gtk.TextView with a formatting toolbar for bold, italic,
// underline, and other text formatting operations.
//
// Adapts the rich-text-editor.widget spec: anatomy (root,
// toolbar, editor, formatButton), states (idle, focused,
// selecting), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface RichTextEditorProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 rich text editor with formatting toolbar
 * and Gtk.TextView for content editing.
 */
export function createRichTextEditor(props: RichTextEditorProps = {}): Gtk.Widget {
  const {
    value = '',
    placeholder = 'Start typing...',
    disabled = false,
    onValueChange,
  } = props;

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });

  // Formatting toolbar
  const toolbar = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 0,
  });
  toolbar.get_style_context().add_class('linked');

  const textView = new Gtk.TextView({
    wrapMode: Gtk.WrapMode.WORD_CHAR,
    editable: !disabled,
  });
  const buffer = textView.get_buffer();
  buffer.set_text(value, value.length);

  // Create formatting tags
  const tagTable = buffer.get_tag_table();
  const boldTag = Gtk.TextTag.new('bold');
  (boldTag as any).weight = 700; // Pango BOLD
  tagTable.add(boldTag);

  const italicTag = Gtk.TextTag.new('italic');
  (italicTag as any).style = 2; // Pango ITALIC
  tagTable.add(italicTag);

  const underlineTag = Gtk.TextTag.new('underline');
  (underlineTag as any).underline = 1; // Pango SINGLE
  tagTable.add(underlineTag);

  const formatButtons = [
    { icon: 'format-text-bold-symbolic', tag: 'bold', tooltip: 'Bold' },
    { icon: 'format-text-italic-symbolic', tag: 'italic', tooltip: 'Italic' },
    { icon: 'format-text-underline-symbolic', tag: 'underline', tooltip: 'Underline' },
  ];

  formatButtons.forEach((fmt) => {
    const btn = new Gtk.Button({
      iconName: fmt.icon,
      tooltipText: fmt.tooltip,
    });
    btn.get_style_context().add_class('flat');
    btn.set_sensitive(!disabled);
    btn.connect('clicked', () => {
      const [hasSelection, start, end] = buffer.get_selection_bounds();
      if (hasSelection) {
        buffer.apply_tag_by_name(fmt.tag, start, end);
      }
    });
    toolbar.append(btn);
  });

  container.append(toolbar);

  // Editor area
  const scrolled = new Gtk.ScrolledWindow({
    minContentHeight: 150,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  });

  if (onValueChange) {
    buffer.connect('changed', () => {
      const [start, end] = [buffer.get_start_iter(), buffer.get_end_iter()];
      onValueChange(buffer.get_text(start, end, false));
    });
  }

  scrolled.set_child(textView);
  container.append(scrolled);

  return container;
}
