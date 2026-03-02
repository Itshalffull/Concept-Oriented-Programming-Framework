// ============================================================
// Clef Surface Ink Widget — MarkdownPreview
//
// Live markdown rendering widget adapted for terminal output.
// Transforms raw markdown source into styled Ink Text elements:
// headings as bold text, bold/italic via Text props, bullets for
// lists, indented dim text for blockquotes, and bordered code
// blocks.
//
// Adapts the markdown-preview.widget spec: anatomy (root,
// content), states (static, rendering), and connect attributes.
// ============================================================

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface MarkdownPreviewProps {
  /** Raw markdown content string. */
  content: string;
  /** Maximum width for text wrapping. */
  width?: number;
}

// --------------- Types ---------------

interface RenderedLine {
  type: 'heading' | 'bold' | 'text' | 'bullet' | 'quote' | 'code' | 'hr' | 'blank';
  level?: number;
  content: string;
}

// --------------- Helpers ---------------

function parseMarkdown(source: string): RenderedLine[] {
  const lines = source.split('\n');
  const result: RenderedLine[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        result.push({ type: 'code', content: '--- code ---' });
      }
      continue;
    }

    if (inCodeBlock) {
      result.push({ type: 'code', content: line });
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      result.push({ type: 'blank', content: '' });
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      result.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      result.push({ type: 'hr', content: '' });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      result.push({ type: 'quote', content: trimmed.slice(2) });
      continue;
    }

    // Bullet list
    if (/^[-*+]\s/.test(trimmed)) {
      result.push({ type: 'bullet', content: trimmed.slice(2) });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s(.*)/);
      result.push({ type: 'bullet', content: match ? match[1] : trimmed });
      continue;
    }

    // Bold text line
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      result.push({ type: 'bold', content: trimmed.slice(2, -2) });
      continue;
    }

    // Regular text
    result.push({ type: 'text', content: trimmed });
  }

  return result;
}

// --------------- Component ---------------

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  width,
}) => {
  const parsed = useMemo(() => parseMarkdown(content), [content]);

  return (
    <Box flexDirection="column" width={width}>
      {parsed.map((line, index) => {
        switch (line.type) {
          case 'heading':
            return (
              <Box key={index}>
                <Text bold color="cyan">
                  {'#'.repeat(line.level || 1)} {line.content}
                </Text>
              </Box>
            );

          case 'bold':
            return (
              <Box key={index}>
                <Text bold>{line.content}</Text>
              </Box>
            );

          case 'bullet':
            return (
              <Box key={index} paddingLeft={1}>
                <Text color="green">{'\u2022'} </Text>
                <Text>{line.content}</Text>
              </Box>
            );

          case 'quote':
            return (
              <Box key={index} paddingLeft={2}>
                <Text dimColor color="gray">
                  {'\u2502'} {line.content}
                </Text>
              </Box>
            );

          case 'code':
            return (
              <Box key={index} paddingLeft={2}>
                <Text color="yellow">{line.content}</Text>
              </Box>
            );

          case 'hr':
            return (
              <Box key={index}>
                <Text dimColor>{'\u2500'.repeat(width || 40)}</Text>
              </Box>
            );

          case 'blank':
            return <Box key={index}><Text> </Text></Box>;

          case 'text':
          default:
            return (
              <Box key={index}>
                <Text>{line.content}</Text>
              </Box>
            );
        }
      })}
    </Box>
  );
};

MarkdownPreview.displayName = 'MarkdownPreview';
export default MarkdownPreview;
