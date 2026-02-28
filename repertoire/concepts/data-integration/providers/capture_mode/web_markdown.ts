// Data Integration Kit - Web Markdown Capture Provider
// HTML to Markdown conversion with Readability extraction and YAML frontmatter

export const PROVIDER_ID = 'web_markdown';
export const PLUGIN_TYPE = 'capture_mode';

export interface CaptureInput {
  url?: string;
  file?: Buffer;
  email?: string;
  shareData?: unknown;
}

export interface CaptureConfig {
  mode: string;
  options?: Record<string, unknown>;
}

export interface SourceMetadata {
  title: string;
  url?: string;
  capturedAt: string;
  contentType: string;
  author?: string;
  tags?: string[];
  source?: string;
}

export interface CaptureItem {
  content: string;
  sourceMetadata: SourceMetadata;
  rawData?: unknown;
}

interface ArticleMeta {
  title: string;
  author?: string;
  date?: string;
  description?: string;
  tags: string[];
}

function extractArticleMeta(html: string): ArticleMeta {
  const meta = (prop: string): string | undefined => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'));
    return m?.[1]?.trim();
  };

  let title = meta('og:title');
  if (!title) { const m = html.match(/<title>([^<]+)<\/title>/i); title = m?.[1]?.trim(); }

  const author = meta('author') ?? meta('article:author');
  const date = meta('article:published_time') ?? meta('date');
  const description = meta('og:description') ?? meta('description');

  const tagMatch = meta('article:tag') ?? meta('keywords');
  const tags = tagMatch ? tagMatch.split(',').map(t => t.trim()).filter(Boolean) : [];

  return { title: title || 'Untitled', author, date, description, tags };
}

function stripNonContent(html: string): string {
  return html
    .replace(/<(script|style|nav|footer|header|aside|iframe|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function htmlToMarkdown(html: string): string {
  let md = html;

  // Headings: <h1>-<h6> to # prefixes
  for (let i = 1; i <= 6; i++) {
    const prefix = '#'.repeat(i);
    const re = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi');
    md = md.replace(re, (_, content) => `\n${prefix} ${stripTags(content).trim()}\n`);
  }

  // Bold and italic
  md = md.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_, __, content) => `**${stripTags(content)}**`);
  md = md.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_, __, content) => `*${stripTags(content)}*`);

  // Links: <a href="...">text</a> to [text](url)
  md = md.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const clean = stripTags(text).trim();
    return `[${clean}](${href})`;
  });

  // Images: <img src="..." alt="..."> to ![alt](src)
  md = md.replace(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*?)["'][^>]*\/?>/gi, (_, src, alt) => `![${alt}](${src})`);
  md = md.replace(/<img[^>]+alt=["']([^"']*?)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (_, alt, src) => `![${alt}](${src})`);

  // Code blocks: <pre><code> to fenced code
  md = md.replace(/<pre[^>]*>\s*<code[^>]*(?:class=["']language-(\w+)["'][^>]*)?>([\\s\\S]*?)<\/code>\s*<\/pre>/gi,
    (_, lang, code) => `\n\`\`\`${lang || ''}\n${decodeEntities(code).trim()}\n\`\`\`\n`);

  // Inline code
  md = md.replace(/<code>([\s\S]*?)<\/code>/gi, (_, code) => `\`${decodeEntities(code)}\``);

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const lines = stripTags(content).trim().split('\n');
    return '\n' + lines.map(l => `> ${l}`).join('\n') + '\n';
  });

  // Unordered lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, items) => {
    return '\n' + items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, item: string) => `- ${stripTags(item).trim()}\n`);
  });

  // Ordered lists
  let counter = 0;
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, items) => {
    counter = 0;
    return '\n' + items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, item: string) => `${++counter}. ${stripTags(item).trim()}\n`);
  });

  // Tables
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    return convertTable(tableContent);
  });

  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Paragraphs and line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => `\n${stripTags(content).trim()}\n`);

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');
  md = decodeEntities(md);

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

function convertTable(html: string): string {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]).trim());
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return '';

  const maxCols = Math.max(...rows.map(r => r.length));
  const lines: string[] = [];
  rows.forEach((row, i) => {
    const padded = Array.from({ length: maxCols }, (_, j) => row[j] || '');
    lines.push('| ' + padded.join(' | ') + ' |');
    if (i === 0) {
      lines.push('| ' + padded.map(() => '---').join(' | ') + ' |');
    }
  });
  return '\n' + lines.join('\n') + '\n';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function generateFrontmatter(meta: ArticleMeta, url: string): string {
  const lines = ['---'];
  lines.push(`title: "${meta.title.replace(/"/g, '\\"')}"`);
  if (meta.author) lines.push(`author: "${meta.author}"`);
  if (meta.date) lines.push(`date: "${meta.date}"`);
  lines.push(`source: "${url}"`);
  if (meta.description) lines.push(`description: "${meta.description.replace(/"/g, '\\"')}"`);
  if (meta.tags.length) lines.push(`tags: [${meta.tags.map(t => `"${t}"`).join(', ')}]`);
  lines.push('---');
  return lines.join('\n');
}

export class WebMarkdownCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (!input.url) throw new Error('web_markdown capture requires a URL');

    const response = await fetch(input.url);
    const html = await response.text();
    const meta = extractArticleMeta(html);
    const cleaned = stripNonContent(html);
    const markdown = htmlToMarkdown(cleaned);

    const includeFrontmatter = config.options?.frontmatter !== false;
    const frontmatter = includeFrontmatter ? generateFrontmatter(meta, input.url) : '';
    const content = frontmatter ? `${frontmatter}\n\n${markdown}` : markdown;

    return {
      content,
      sourceMetadata: {
        title: meta.title,
        url: input.url,
        capturedAt: new Date().toISOString(),
        contentType: 'text/markdown',
        author: meta.author,
        tags: ['markdown', ...meta.tags],
        source: 'web_markdown',
      },
      rawData: config.options?.includeHtml ? html : undefined,
    };
  }

  supports(input: CaptureInput): boolean {
    if (!input.url) return false;
    try {
      const parsed = new URL(input.url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

export default WebMarkdownCaptureProvider;
