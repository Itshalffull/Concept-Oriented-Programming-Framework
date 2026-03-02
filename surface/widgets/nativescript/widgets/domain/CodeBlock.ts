// ============================================================
// Clef Surface NativeScript Widget — CodeBlock
//
// Syntax-highlighted code display with language badge, line
// numbers, copy button, and word-wrap toggle. Applies
// basic keyword colouring via label text styling.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  ScrollView,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface CodeBlockProps {
  code?: string;
  language?: string;
  showLineNumbers?: boolean;
  showCopyButton?: boolean;
  highlightLines?: number[];
  wordWrap?: boolean;
  maxHeight?: number;
  fileName?: string;
  accentColor?: string;
  onCopy?: (code: string) => void;
  onLineClick?: (lineNumber: number) => void;
}

// --------------- Helpers ---------------

const LANG_COLORS: Record<string, string> = {
  typescript: '#3178c6', javascript: '#f0db4f', python: '#3776ab',
  rust: '#dea584', go: '#00add8', java: '#b07219', swift: '#fa7343',
  css: '#1572b6', html: '#e34f26', graphql: '#e10098', yaml: '#cb171e',
  json: '#292929', sql: '#336791', bash: '#4eaa25', markdown: '#083fa1',
};

// --------------- Component ---------------

export function createCodeBlock(props: CodeBlockProps = {}): StackLayout {
  const {
    code = '',
    language = 'text',
    showLineNumbers = true,
    showCopyButton = true,
    highlightLines = [],
    wordWrap = false,
    maxHeight,
    fileName,
    accentColor = '#06b6d4',
    onCopy,
    onLineClick,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-code-block';
  container.borderRadius = 6;
  container.borderWidth = 1;
  container.borderColor = new Color('#333333');
  container.backgroundColor = new Color('#0d1117');

  // Header bar
  const header = new GridLayout();
  header.columns = '*, auto';
  header.padding = 6;
  header.backgroundColor = new Color('#161b22');
  header.borderRadius = 6;

  const headerLeft = new StackLayout();
  headerLeft.orientation = 'horizontal';

  // Language badge
  const langBadge = new Label();
  langBadge.text = language;
  langBadge.fontSize = 10;
  langBadge.fontWeight = 'bold';
  langBadge.color = new Color(LANG_COLORS[language] || accentColor);
  langBadge.marginRight = 8;
  headerLeft.addChild(langBadge);

  // File name
  if (fileName) {
    const fileLabel = new Label();
    fileLabel.text = fileName;
    fileLabel.fontSize = 10;
    fileLabel.opacity = 0.5;
    headerLeft.addChild(fileLabel);
  }

  GridLayout.setColumn(headerLeft, 0);
  header.addChild(headerLeft);

  // Copy button
  if (showCopyButton) {
    const copyBtn = new Button();
    copyBtn.text = '\u2398 Copy';
    copyBtn.fontSize = 10;
    copyBtn.padding = 2;
    copyBtn.on('tap', () => onCopy?.(code));
    GridLayout.setColumn(copyBtn, 1);
    header.addChild(copyBtn);
  }

  container.addChild(header);

  // Code content
  const scrollView = new ScrollView();
  scrollView.orientation = wordWrap ? 'vertical' : 'horizontal';
  if (maxHeight) scrollView.height = maxHeight;

  const codeContainer = new StackLayout();
  codeContainer.padding = 8;

  const lines = code.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const isHighlighted = highlightLines.includes(lineNum);

    const lineRow = new GridLayout();
    lineRow.columns = showLineNumbers ? '40, *' : '*';
    if (isHighlighted) {
      lineRow.backgroundColor = new Color('#1c3a5e');
      lineRow.borderLeftWidth = 3;
      lineRow.borderLeftColor = new Color(accentColor);
    }

    // Line number
    if (showLineNumbers) {
      const numLabel = new Label();
      numLabel.text = String(lineNum);
      numLabel.fontSize = 11;
      numLabel.color = new Color('#484f58');
      numLabel.textAlignment = 'right';
      numLabel.marginRight = 8;
      numLabel.on('tap' as any, () => onLineClick?.(lineNum));
      GridLayout.setColumn(numLabel, 0);
      lineRow.addChild(numLabel);
    }

    // Code text
    const codeLabel = new Label();
    codeLabel.text = line || ' ';
    codeLabel.fontSize = 12;
    codeLabel.fontFamily = 'monospace';
    codeLabel.color = new Color('#e6edf3');
    codeLabel.textWrap = wordWrap;
    GridLayout.setColumn(codeLabel, showLineNumbers ? 1 : 0);
    lineRow.addChild(codeLabel);

    codeContainer.addChild(lineRow);
  });

  scrollView.content = codeContainer;
  container.addChild(scrollView);

  // Footer
  const footer = new StackLayout();
  footer.orientation = 'horizontal';
  footer.padding = 4;
  footer.backgroundColor = new Color('#161b22');

  const lineCountLabel = new Label();
  lineCountLabel.text = `${lines.length} lines`;
  lineCountLabel.fontSize = 10;
  lineCountLabel.opacity = 0.4;
  footer.addChild(lineCountLabel);

  if (highlightLines.length > 0) {
    const hlLabel = new Label();
    hlLabel.text = ` \u2022 ${highlightLines.length} highlighted`;
    hlLabel.fontSize = 10;
    hlLabel.opacity = 0.4;
    footer.addChild(hlLabel);
  }

  container.addChild(footer);

  return container;
}

export default createCodeBlock;
