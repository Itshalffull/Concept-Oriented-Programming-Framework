// ============================================================
// Clef Surface Ink Widget — CodeBlock
//
// Syntax-highlighted code display block rendered in the terminal
// with optional line numbers, highlighted lines shown in inverse
// style, and a copyable indicator. Provides a bordered code
// region with language label.
//
// Adapts the code-block.widget spec: anatomy (root, header,
// language, copyButton, lineNumbers, code), states (idle,
// hovered, focused, copied), and connect attributes.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface CodeBlockProps {
  /** The source code string to display. */
  code: string;
  /** Programming language name. */
  language?: string;
  /** Whether to show line numbers in the gutter. */
  showLineNumbers?: boolean;
  /** Line numbers to highlight (1-based). */
  highlightLines?: number[];
  /** Whether the code can be copied. */
  copyable?: boolean;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'plaintext',
  showLineNumbers = true,
  highlightLines = [],
  copyable = false,
  isFocused = false,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  useInput(
    (input, key) => {
      if (!isFocused) return;
      if (input === 'c' && key.ctrl && copyable) {
        setCopied(true);
      }
    },
    { isActive: isFocused },
  );

  const lines = code.split('\n');
  const gutterWidth = showLineNumbers ? String(lines.length).length + 1 : 0;
  const highlightSet = new Set(highlightLines);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? 'cyan' : 'gray'}>
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold color="yellow">{language}</Text>
        {copyable && (
          <Text color={copied ? 'green' : 'gray'}>
            {copied ? '[Copied!]' : '[Copy]'}
          </Text>
        )}
      </Box>

      {/* Code lines */}
      <Box flexDirection="column" paddingX={1}>
        {lines.map((line, index) => {
          const lineNum = index + 1;
          const isHighlighted = highlightSet.has(lineNum);

          return (
            <Box key={index}>
              {showLineNumbers && (
                <Text dimColor>
                  {String(lineNum).padStart(gutterWidth)}
                  {' \u2502 '}
                </Text>
              )}
              <Text inverse={isHighlighted} bold={isHighlighted}>
                {line}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

CodeBlock.displayName = 'CodeBlock';
export default CodeBlock;
