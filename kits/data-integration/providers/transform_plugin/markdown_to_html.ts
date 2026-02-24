// Transform Plugin Provider: markdown_to_html
// Convert Markdown content to HTML syntax.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'markdown_to_html';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class MarkdownToHtmlTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    let md = String(value);
    const wrapInDiv = config.options?.wrapInDiv === true;

    // Normalize line breaks
    md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Code blocks (fenced) - must be processed before inline patterns
    md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
      const langAttr = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${langAttr}>${this.escapeHtml(code.trimEnd())}</code></pre>`;
    });

    // Blockquotes (process line by line)
    md = md.replace(/((?:^>.*\n?)+)/gm, (block) => {
      const content = block
        .split('\n')
        .map(line => line.replace(/^>\s?/, ''))
        .join('\n')
        .trim();
      return `<blockquote>${content}</blockquote>\n`;
    });

    // Headings
    md = md.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    md = md.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    md = md.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    md = md.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    md = md.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    md = md.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    md = md.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr>');

    // Tables
    md = md.replace(/((?:\|.*\|\n?)+)/g, (block) => {
      return this.convertTable(block.trim());
    });

    // Unordered lists
    md = md.replace(/((?:^[-*+]\s+.+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(line => {
        const content = line.replace(/^[-*+]\s+/, '');
        return `<li>${content}</li>`;
      });
      return `<ul>\n${items.join('\n')}\n</ul>\n`;
    });

    // Ordered lists
    md = md.replace(/((?:^\d+\.\s+.+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map(line => {
        const content = line.replace(/^\d+\.\s+/, '');
        return `<li>${content}</li>`;
      });
      return `<ol>\n${items.join('\n')}\n</ol>\n`;
    });

    // Images (before links to avoid conflict)
    md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Links
    md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Inline code (before bold/italic to avoid conflicts)
    md = md.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold: **text** or __text__
    md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    md = md.replace(/\*(.+?)\*/g, '<em>$1</em>');
    md = md.replace(/_(.+?)_/g, '<em>$1</em>');

    // Strikethrough: ~~text~~
    md = md.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Paragraphs: wrap remaining text blocks
    md = md.replace(/\n{2,}/g, '\n\n');
    const lines = md.split('\n\n');
    const processed = lines.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Skip blocks that are already HTML
      if (/^<(?:h[1-6]|ul|ol|li|pre|blockquote|table|hr|div|p)\b/i.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    });

    let result = processed.filter(b => b !== '').join('\n');

    if (wrapInDiv) {
      result = `<div>${result}</div>`;
    }

    return result;
  }

  private convertTable(tableBlock: string): string {
    const rows = tableBlock.split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;

    const parseRow = (row: string): string[] => {
      return row.split('|').map(c => c.trim()).filter((_, i, arr) =>
        i > 0 && i < arr.length - (row.endsWith('|') ? 1 : 0)
      );
    };

    const headerCells = parseRow(rows[0]);
    // Skip separator row (row[1]) which contains ---
    const bodyRows = rows.slice(2);

    let html = '<table>\n<thead>\n<tr>';
    for (const cell of headerCells) {
      html += `<th>${cell}</th>`;
    }
    html += '</tr>\n</thead>\n<tbody>\n';

    for (const row of bodyRows) {
      const cells = parseRow(row);
      html += '<tr>';
      for (const cell of cells) {
        html += `<td>${cell}</td>`;
      }
      html += '</tr>\n';
    }

    html += '</tbody>\n</table>';
    return html;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default MarkdownToHtmlTransformProvider;
