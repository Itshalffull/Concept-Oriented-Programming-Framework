// Transform Plugin Provider: html_to_markdown
// Convert HTML content to Markdown syntax.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'html_to_markdown';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class HtmlToMarkdownTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    let html = String(value);
    const preserveLinks = config.options?.preserveLinks !== false;
    const preserveImages = config.options?.preserveImages !== false;

    // Normalize line breaks
    html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Handle headings h1-h6
    for (let i = 6; i >= 1; i--) {
      const hashes = '#'.repeat(i);
      const re = new RegExp(`<h${i}[^>]*>(.*?)<\\/h${i}>`, 'gis');
      html = html.replace(re, `\n\n${hashes} $1\n\n`);
    }

    // Bold: <strong> and <b>
    html = html.replace(/<(?:strong|b)(?:\s[^>]*)?>(.+?)<\/(?:strong|b)>/gis, '**$1**');

    // Italic: <em> and <i>
    html = html.replace(/<(?:em|i)(?:\s[^>]*)?>(.+?)<\/(?:em|i)>/gis, '*$1*');

    // Code blocks: <pre><code>
    html = html.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, '\n\n```\n$1\n```\n\n');

    // Inline code
    html = html.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Links
    if (preserveLinks) {
      html = html.replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    } else {
      html = html.replace(/<a\s+[^>]*>(.*?)<\/a>/gi, '$1');
    }

    // Images
    if (preserveImages) {
      html = html.replace(
        /<img\s+[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
        '![$2]($1)'
      );
      html = html.replace(
        /<img\s+[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*\/?>/gi,
        '![$1]($2)'
      );
      html = html.replace(/<img\s+[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, '![]($1)');
    }

    // Blockquotes
    html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, content: string) => {
      const lines = content.trim().split('\n');
      return '\n\n' + lines.map(l => `> ${l.trim()}`).join('\n') + '\n\n';
    });

    // Unordered lists
    html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, content: string) => {
      const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
      const mdItems = items.map(item => {
        const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
        return `- ${text}`;
      });
      return '\n\n' + mdItems.join('\n') + '\n\n';
    });

    // Ordered lists
    html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, content: string) => {
      const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
      const mdItems = items.map((item, idx) => {
        const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
        return `${idx + 1}. ${text}`;
      });
      return '\n\n' + mdItems.join('\n') + '\n\n';
    });

    // Horizontal rules
    html = html.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

    // Line breaks
    html = html.replace(/<br\s*\/?>/gi, '\n');

    // Paragraphs
    html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');

    // Tables
    html = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match, tableContent: string) => {
      return this.convertTable(tableContent);
    });

    // Strip remaining tags
    html = html.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    html = this.decodeEntities(html);

    // Clean up excessive blank lines
    html = html.replace(/\n{3,}/g, '\n\n');

    return html.trim();
  }

  private convertTable(tableHtml: string): string {
    const rows: string[][] = [];
    const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];

    for (const row of rowMatches) {
      const cells = (row.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) ?? []).map(
        cell => cell.replace(/<\/?(?:td|th)[^>]*>/gi, '').trim()
      );
      rows.push(cells);
    }

    if (rows.length === 0) return '';

    const header = rows[0];
    const separator = header.map(() => '---');
    const body = rows.slice(1);

    const lines = [
      '| ' + header.join(' | ') + ' |',
      '| ' + separator.join(' | ') + ' |',
      ...body.map(r => '| ' + r.join(' | ') + ' |'),
    ];

    return '\n\n' + lines.join('\n') + '\n\n';
  }

  private decodeEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
      '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&mdash;': '\u2014',
      '&ndash;': '\u2013', '&hellip;': '\u2026', '&copy;': '\u00A9',
      '&reg;': '\u00AE', '&trade;': '\u2122',
    };
    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.split(entity).join(char);
    }
    // Numeric entities
    result = result.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)));
    result = result.replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => String.fromCharCode(parseInt(code, 16)));
    return result;
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default HtmlToMarkdownTransformProvider;
