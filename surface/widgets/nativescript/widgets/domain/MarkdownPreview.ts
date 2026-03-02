// ============================================================
// Clef Surface NativeScript Widget — MarkdownPreview
//
// Markdown content renderer. Parses a subset of Markdown
// syntax and renders it using native NativeScript labels with
// appropriate styling for headings, bold, italic, code,
// blockquotes, lists, and horizontal rules.
// ============================================================

import {
  StackLayout,
  Label,
  ScrollView,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface MarkdownPreviewProps {
  content?: string;
  maxHeight?: number;
  showLineNumbers?: boolean;
  baseTextSize?: number;
  accentColor?: string;
  codeBackground?: string;
  onLinkTap?: (url: string) => void;
}

// --------------- Parser ---------------

interface MarkdownLine {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'paragraph' | 'code' | 'codeBlock' | 'blockquote' | 'ul' | 'ol' | 'hr' | 'empty';
  text: string;
  indent?: number;
}

function parseMarkdownLines(content: string): MarkdownLine[] {
  const lines = content.split('\n');
  const result: MarkdownLine[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push({ type: 'codeBlock', text: codeBlockLines.join('\n') });
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === '') {
      result.push({ type: 'empty', text: '' });
    } else if (trimmed.startsWith('#### ')) {
      result.push({ type: 'h4', text: trimmed.slice(5) });
    } else if (trimmed.startsWith('### ')) {
      result.push({ type: 'h3', text: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      result.push({ type: 'h2', text: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      result.push({ type: 'h1', text: trimmed.slice(2) });
    } else if (trimmed.startsWith('> ')) {
      result.push({ type: 'blockquote', text: trimmed.slice(2) });
    } else if (/^[-*+] /.test(trimmed)) {
      result.push({ type: 'ul', text: trimmed.slice(2), indent: line.length - line.trimStart().length });
    } else if (/^\d+\. /.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\. (.*)$/);
      result.push({ type: 'ol', text: match ? match[2] : trimmed, indent: line.length - line.trimStart().length });
    } else if (/^---+$|^___+$|^\*\*\*+$/.test(trimmed)) {
      result.push({ type: 'hr', text: '' });
    } else if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 2) {
      result.push({ type: 'code', text: trimmed.slice(1, -1) });
    } else {
      result.push({ type: 'paragraph', text: trimmed });
    }
  }

  // Close unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    result.push({ type: 'codeBlock', text: codeBlockLines.join('\n') });
  }

  return result;
}

// --------------- Component ---------------

export function createMarkdownPreview(props: MarkdownPreviewProps = {}): StackLayout {
  const {
    content = '',
    maxHeight,
    showLineNumbers = false,
    baseTextSize = 14,
    accentColor = '#06b6d4',
    codeBackground = '#161b22',
    onLinkTap,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-markdown-preview';

  const scrollView = new ScrollView();
  if (maxHeight) scrollView.height = maxHeight;

  const body = new StackLayout();
  body.padding = 8;

  const lines = parseMarkdownLines(content);
  let lineNumber = 0;

  lines.forEach((line) => {
    lineNumber++;

    const row = new StackLayout();
    row.orientation = showLineNumbers ? 'horizontal' : 'vertical';

    if (showLineNumbers) {
      const numLabel = new Label();
      numLabel.text = String(lineNumber);
      numLabel.fontSize = 9;
      numLabel.width = 24;
      numLabel.opacity = 0.2;
      numLabel.textAlignment = 'right';
      numLabel.marginRight = 8;
      row.addChild(numLabel);
    }

    switch (line.type) {
      case 'h1': {
        const label = new Label();
        label.text = line.text;
        label.fontSize = baseTextSize + 10;
        label.fontWeight = 'bold';
        label.color = new Color('#ffffff');
        label.marginTop = 12;
        label.marginBottom = 4;
        label.textWrap = true;
        row.addChild(label);

        // Underline
        const hr = new Label();
        hr.text = '\u2500'.repeat(40);
        hr.opacity = 0.2;
        hr.fontSize = 8;
        row.addChild(hr);
        break;
      }
      case 'h2': {
        const label = new Label();
        label.text = line.text;
        label.fontSize = baseTextSize + 6;
        label.fontWeight = 'bold';
        label.color = new Color('#e0e0e0');
        label.marginTop = 10;
        label.marginBottom = 3;
        label.textWrap = true;
        row.addChild(label);
        break;
      }
      case 'h3': {
        const label = new Label();
        label.text = line.text;
        label.fontSize = baseTextSize + 3;
        label.fontWeight = 'bold';
        label.color = new Color('#c0c0c0');
        label.marginTop = 8;
        label.marginBottom = 2;
        label.textWrap = true;
        row.addChild(label);
        break;
      }
      case 'h4': {
        const label = new Label();
        label.text = line.text;
        label.fontSize = baseTextSize + 1;
        label.fontWeight = 'bold';
        label.color = new Color('#a0a0a0');
        label.marginTop = 6;
        label.marginBottom = 2;
        label.textWrap = true;
        row.addChild(label);
        break;
      }
      case 'blockquote': {
        const quoteContainer = new StackLayout();
        quoteContainer.borderLeftWidth = 3;
        quoteContainer.borderLeftColor = new Color(accentColor);
        quoteContainer.paddingLeft = 8;
        quoteContainer.marginTop = 4;
        quoteContainer.marginBottom = 4;

        const label = new Label();
        label.text = line.text;
        label.fontSize = baseTextSize;
        label.fontStyle = 'italic';
        label.color = new Color('#a0a0a0');
        label.textWrap = true;
        quoteContainer.addChild(label);

        row.addChild(quoteContainer);
        break;
      }
      case 'ul': {
        const indent = (line.indent || 0) / 2;
        const label = new Label();
        label.text = `${'  '.repeat(indent)}\u2022 ${line.text}`;
        label.fontSize = baseTextSize;
        label.color = new Color('#d0d0d0');
        label.textWrap = true;
        label.marginLeft = indent * 12;
        row.addChild(label);
        break;
      }
      case 'ol': {
        const indent = (line.indent || 0) / 2;
        const label = new Label();
        label.text = `${'  '.repeat(indent)}${lineNumber}. ${line.text}`;
        label.fontSize = baseTextSize;
        label.color = new Color('#d0d0d0');
        label.textWrap = true;
        label.marginLeft = indent * 12;
        row.addChild(label);
        break;
      }
      case 'code': {
        const codeLabel = new Label();
        codeLabel.text = line.text;
        codeLabel.fontSize = baseTextSize - 1;
        codeLabel.fontFamily = 'monospace';
        codeLabel.color = new Color(accentColor);
        codeLabel.backgroundColor = new Color(codeBackground);
        codeLabel.borderRadius = 3;
        codeLabel.padding = 4;
        row.addChild(codeLabel);
        break;
      }
      case 'codeBlock': {
        const codeContainer = new StackLayout();
        codeContainer.backgroundColor = new Color(codeBackground);
        codeContainer.borderRadius = 6;
        codeContainer.padding = 8;
        codeContainer.marginTop = 4;
        codeContainer.marginBottom = 4;
        codeContainer.borderWidth = 1;
        codeContainer.borderColor = new Color('#333333');

        const codeLabel = new Label();
        codeLabel.text = line.text;
        codeLabel.fontSize = baseTextSize - 2;
        codeLabel.fontFamily = 'monospace';
        codeLabel.color = new Color('#e6edf3');
        codeLabel.textWrap = true;
        codeContainer.addChild(codeLabel);

        row.addChild(codeContainer);
        break;
      }
      case 'hr': {
        const hrLabel = new Label();
        hrLabel.text = '\u2500'.repeat(50);
        hrLabel.opacity = 0.2;
        hrLabel.fontSize = 8;
        hrLabel.marginTop = 8;
        hrLabel.marginBottom = 8;
        row.addChild(hrLabel);
        break;
      }
      case 'empty': {
        const spacer = new Label();
        spacer.text = ' ';
        spacer.height = 8;
        row.addChild(spacer);
        break;
      }
      default: {
        const label = new Label();
        label.text = line.text;
        label.fontSize = baseTextSize;
        label.color = new Color('#d0d0d0');
        label.textWrap = true;
        label.marginBottom = 4;
        row.addChild(label);
        break;
      }
    }

    body.addChild(row);
  });

  // Empty state
  if (!content.trim()) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No content to preview.';
    emptyLabel.opacity = 0.4;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.marginTop = 20;
    body.addChild(emptyLabel);
  }

  scrollView.content = body;
  container.addChild(scrollView);

  return container;
}

export default createMarkdownPreview;
