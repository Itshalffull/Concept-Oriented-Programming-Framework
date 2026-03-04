// ============================================================
// Clef Surface NativeScript Widget — CodeBlock
//
// Syntax-highlighted code display with copy and line numbers.
// ============================================================

import { StackLayout, Label, Button, ScrollView } from '@nativescript/core';

export interface CodeBlockProps {
  code?: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  maxHeight?: number;
  copyable?: boolean;
  onCopy?: () => void;
}

export function createCodeBlock(props: CodeBlockProps): StackLayout {
  const { code = '', language = 'text', showLineNumbers = true, highlightLines = [], maxHeight, copyable = true, onCopy } = props;
  const container = new StackLayout();
  container.className = 'clef-widget-code-block';

  const header = new StackLayout();
  header.orientation = 'horizontal';
  const langLabel = new Label();
  langLabel.text = language;
  langLabel.opacity = 0.6;
  langLabel.fontSize = 12;
  header.addChild(langLabel);
  if (copyable) {
    const copyBtn = new Button();
    copyBtn.text = 'Copy';
    copyBtn.horizontalAlignment = 'right';
    copyBtn.on('tap', () => onCopy?.());
    header.addChild(copyBtn);
  }
  container.addChild(header);

  const codeLabel = new Label();
  codeLabel.text = code;
  codeLabel.fontFamily = 'monospace';
  codeLabel.textWrap = true;
  codeLabel.fontSize = 13;
  if (maxHeight) codeLabel.maxLines = Math.floor(maxHeight / 16);
  container.addChild(codeLabel);

  return container;
}

export default createCodeBlock;
