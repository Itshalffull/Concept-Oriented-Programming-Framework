// ============================================================
// Clef Surface NativeScript Widget — RichTextEditor
//
// Rich text editing control with a formatting toolbar providing
// bold, italic, underline, heading, and list buttons, a multi-
// line text area for content entry, and a character/word count
// status bar. Uses markdown-style markers for formatting state.
//
// Adapts the rich-text-editor.widget spec: anatomy (root,
// toolbar, editor, statusBar, formatButton), states (editing,
// focused, disabled, readOnly), and connect attributes to
// NativeScript TextView and Button-based toolbar.
// ============================================================

import {
  StackLayout,
  GridLayout,
  ScrollView,
  Label,
  TextView,
  Button,
} from '@nativescript/core';

// --------------- Props ---------------

export interface RichTextEditorProps {
  value?: string;
  placeholder?: string;
  maxLength?: number;
  showWordCount?: boolean;
  showCharCount?: boolean;
  readOnly?: boolean;
  enabled?: boolean;
  onContentChange?: (content: string) => void;
}

// --------------- Helpers ---------------

interface FormatAction {
  label: string;
  icon: string;
  prefix: string;
  suffix: string;
}

const FORMAT_ACTIONS: FormatAction[] = [
  { label: 'Bold', icon: 'B', prefix: '**', suffix: '**' },
  { label: 'Italic', icon: 'I', prefix: '_', suffix: '_' },
  { label: 'Underline', icon: 'U', prefix: '<u>', suffix: '</u>' },
  { label: 'Strikethrough', icon: 'S', prefix: '~~', suffix: '~~' },
  { label: 'Code', icon: '<>', prefix: '`', suffix: '`' },
];

const BLOCK_ACTIONS = [
  { label: 'H1', prefix: '# ' },
  { label: 'H2', prefix: '## ' },
  { label: 'H3', prefix: '### ' },
  { label: 'Bullet', prefix: '- ' },
  { label: 'Number', prefix: '1. ' },
  { label: 'Quote', prefix: '> ' },
];

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript rich text editor with a formatting
 * toolbar, multi-line text area, and character/word count
 * status bar.
 */
export function createRichTextEditor(props: RichTextEditorProps = {}): StackLayout {
  const {
    value = '',
    placeholder = 'Start writing...',
    maxLength = 0,
    showWordCount = true,
    showCharCount = true,
    readOnly = false,
    enabled = true,
    onContentChange,
  } = props;

  const isEditable = enabled && !readOnly;

  const container = new StackLayout();
  container.className = 'clef-widget-rich-text-editor';
  container.padding = 8;

  // -- Inline formatting toolbar --
  const inlineToolbar = new ScrollView();
  inlineToolbar.orientation = 'horizontal';
  inlineToolbar.height = 40;
  inlineToolbar.marginBottom = 4;

  const inlineRow = new StackLayout();
  inlineRow.orientation = 'horizontal';

  FORMAT_ACTIONS.forEach((action) => {
    const btn = new Button();
    btn.text = action.icon;
    btn.fontSize = 14;
    btn.fontWeight = action.label === 'Bold' ? 'bold' : 'normal';
    btn.width = 36;
    btn.height = 36;
    btn.margin = 2;
    btn.borderRadius = 4;
    btn.borderWidth = 1;
    btn.borderColor = '#E0E0E0';
    btn.backgroundColor = '#FAFAFA' as any;
    btn.isEnabled = isEditable;

    btn.on('tap', () => {
      const current = editor.text;
      editor.text = current + action.prefix + action.suffix;
      if (onContentChange) onContentChange(editor.text);
    });

    inlineRow.addChild(btn);
  });

  // Separator
  const sep = new Label();
  sep.text = '|';
  sep.opacity = 0.3;
  sep.verticalAlignment = 'middle';
  sep.marginLeft = 4;
  sep.marginRight = 4;
  inlineRow.addChild(sep);

  // Block formatting buttons
  BLOCK_ACTIONS.forEach((action) => {
    const btn = new Button();
    btn.text = action.label;
    btn.fontSize = 11;
    btn.height = 36;
    btn.padding = 4;
    btn.margin = 2;
    btn.borderRadius = 4;
    btn.borderWidth = 1;
    btn.borderColor = '#E0E0E0';
    btn.backgroundColor = '#FAFAFA' as any;
    btn.isEnabled = isEditable;

    btn.on('tap', () => {
      const current = editor.text;
      const needsNewline = current.length > 0 && !current.endsWith('\n');
      editor.text = current + (needsNewline ? '\n' : '') + action.prefix;
      if (onContentChange) onContentChange(editor.text);
    });

    inlineRow.addChild(btn);
  });

  inlineToolbar.content = inlineRow;
  container.addChild(inlineToolbar);

  // -- Editor text area --
  const editor = new TextView();
  editor.text = value;
  editor.hint = placeholder;
  editor.editable = isEditable;
  editor.height = 200;
  editor.borderWidth = 1;
  editor.borderColor = '#CCCCCC';
  editor.borderRadius = 4;
  editor.padding = 12;
  editor.fontSize = 14;
  editor.marginBottom = 4;

  if (maxLength > 0) {
    editor.maxLength = maxLength;
  }

  container.addChild(editor);

  // -- Status bar --
  const statusBar = new GridLayout();
  statusBar.columns = '*, auto';
  statusBar.rows = 'auto';

  const leftStatus = new StackLayout();
  leftStatus.orientation = 'horizontal';
  leftStatus.col = 0;

  const charCountLabel = new Label();
  charCountLabel.fontSize = 11;
  charCountLabel.opacity = 0.5;

  const wordCountLabel = new Label();
  wordCountLabel.fontSize = 11;
  wordCountLabel.opacity = 0.5;
  wordCountLabel.marginLeft = 12;

  function updateCounts(): void {
    const text = editor.text;
    if (showCharCount) {
      const charText = maxLength > 0
        ? `${text.length} / ${maxLength} chars`
        : `${text.length} chars`;
      charCountLabel.text = charText;

      if (maxLength > 0 && text.length > maxLength * 0.9) {
        charCountLabel.color = '#F44336' as any;
      } else {
        charCountLabel.color = '#757575' as any;
      }
    }
    if (showWordCount) {
      wordCountLabel.text = `${countWords(text)} words`;
    }
  }

  if (showCharCount) leftStatus.addChild(charCountLabel);
  if (showWordCount) leftStatus.addChild(wordCountLabel);
  statusBar.addChild(leftStatus);

  // Read-only indicator
  if (readOnly) {
    const roLabel = new Label();
    roLabel.text = 'Read Only';
    roLabel.fontSize = 11;
    roLabel.opacity = 0.5;
    roLabel.col = 1;
    statusBar.addChild(roLabel);
  }

  container.addChild(statusBar);

  editor.on('textChange', () => {
    updateCounts();
    if (onContentChange) onContentChange(editor.text);
  });

  updateCounts();

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createRichTextEditor.displayName = 'RichTextEditor';
export default createRichTextEditor;
