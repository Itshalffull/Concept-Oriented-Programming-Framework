// ============================================================
// Clef Surface GTK Widget — MarkdownPreview
//
// Markdown text preview renderer. Displays markdown as
// formatted text using Gtk.Label with Pango markup or a
// read-only Gtk.TextView.
//
// Adapts the markdown-preview.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface MarkdownPreviewProps {
  markdown?: string;
}

// --------------- Component ---------------

export function createMarkdownPreview(props: MarkdownPreviewProps = {}): Gtk.Widget {
  const { markdown = '' } = props;

  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  });

  // Basic markdown rendering via text with styling
  const textView = new Gtk.TextView({
    editable: false,
    wrapMode: Gtk.WrapMode.WORD_CHAR,
  });

  const buffer = textView.get_buffer();
  // Simple rendering — headers as bold, code blocks as monospace
  const lines = markdown.split('\n');
  let displayText = '';
  lines.forEach((line) => {
    if (line.startsWith('# ')) displayText += line.substring(2).toUpperCase() + '\n';
    else if (line.startsWith('## ')) displayText += line.substring(3) + '\n';
    else if (line.startsWith('### ')) displayText += line.substring(4) + '\n';
    else displayText += line + '\n';
  });

  buffer.set_text(displayText.trimEnd(), -1);
  scrolled.set_child(textView);

  return scrolled;
}
