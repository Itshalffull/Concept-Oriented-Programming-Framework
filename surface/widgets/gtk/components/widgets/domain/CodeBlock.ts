// ============================================================
// Clef Surface GTK Widget — CodeBlock
//
// Syntax-highlighted code display with optional copy button
// and line numbers. Uses monospace Gtk.TextView or Gtk.Label.
//
// Adapts the code-block.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface CodeBlockProps {
  code?: string;
  language?: string;
  showLineNumbers?: boolean;
  onCopy?: () => void;
}

// --------------- Component ---------------

export function createCodeBlock(props: CodeBlockProps = {}): Gtk.Widget {
  const { code = '', language = '', showLineNumbers = true, onCopy } = props;

  const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
  container.get_style_context().add_class('card');

  // Header with language label and copy button
  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  if (language) {
    const langLabel = new Gtk.Label({ label: language });
    langLabel.get_style_context().add_class('dim-label');
    header.append(langLabel);
  }
  const spacer = new Gtk.Box({ hexpand: true });
  header.append(spacer);

  const copyBtn = new Gtk.Button({ iconName: 'edit-copy-symbolic', tooltipText: 'Copy' });
  copyBtn.get_style_context().add_class('flat');
  if (onCopy) copyBtn.connect('clicked', onCopy);
  header.append(copyBtn);
  container.append(header);

  // Code content
  const scrolled = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    minContentHeight: 60,
  });

  const lines = code.split('\n');
  const displayText = showLineNumbers
    ? lines.map((line, i) => `${String(i + 1).padStart(4)} | ${line}`).join('\n')
    : code;

  const textView = new Gtk.TextView({
    editable: false,
    monospace: true,
    wrapMode: Gtk.WrapMode.NONE,
  });
  textView.get_buffer().set_text(displayText, displayText.length);

  scrolled.set_child(textView);
  container.append(scrolled);

  return container;
}
