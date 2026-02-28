// Data Integration Kit - Web Article Capture Provider
// Extracts article content via Readability-style algorithm with scoring heuristics

export const PROVIDER_ID = 'web_article';
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

const NEGATIVE_PATTERNS = /combx|comment|community|disqus|extra|footer|header|menu|nav|remark|rss|shoutbox|sidebar|sponsor|ad-break|agegate|pagination|pager|popup/i;
const POSITIVE_PATTERNS = /article|body|content|entry|hentry|main|page|post|text|blog|story/i;
const BLOCK_TAGS = new Set(['div', 'section', 'article', 'main', 'p', 'pre', 'blockquote', 'td']);

function scoreElement(tag: string, className: string, id: string): number {
  let score = 0;
  if (tag === 'article') score += 30;
  else if (tag === 'section') score += 10;
  else if (tag === 'div') score += 5;
  else if (tag === 'p') score += 3;

  const combined = `${className} ${id}`;
  if (POSITIVE_PATTERNS.test(combined)) score += 25;
  if (NEGATIVE_PATTERNS.test(combined)) score -= 25;

  return score;
}

function extractMetaContent(html: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractJsonLd(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (match?.[1]) {
    try {
      const data = JSON.parse(match[1]);
      if (data.headline) result.title = data.headline;
      if (data.author?.name) result.author = data.author.name;
      if (data.datePublished) result.date = data.datePublished;
      if (data.description) result.description = data.description;
    } catch { /* malformed JSON-LD ignored */ }
  }
  return result;
}

function stripNonContentTags(html: string): string {
  return html
    .replace(/<(script|style|nav|footer|header|aside|iframe|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function extractTextContent(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findMainContent(html: string): string {
  const cleaned = stripNonContentTags(html);
  const blockRegex = /<(div|section|article|main)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let bestScore = -Infinity;
  let bestContent = '';
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(cleaned)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const inner = match[3];
    const classMatch = attrs.match(/class=["']([^"']+)["']/);
    const idMatch = attrs.match(/id=["']([^"']+)["']/);
    const className = classMatch?.[1] ?? '';
    const id = idMatch?.[1] ?? '';

    const paragraphs = (inner.match(/<p[\s>]/gi) || []).length;
    const textLen = extractTextContent(inner).length;
    let score = scoreElement(tag, className, id);
    score += paragraphs * 3;
    score += Math.min(textLen / 100, 20);

    if (score > bestScore) {
      bestScore = score;
      bestContent = inner;
    }
  }
  return bestContent || cleaned;
}

export class WebArticleCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (!input.url) throw new Error('web_article capture requires a URL');

    const response = await fetch(input.url);
    const html = await response.text();
    const jsonLd = extractJsonLd(html);

    const title = jsonLd.title
      ?? extractMetaContent(html, [/og:title["']\s+content=["']([^"']+)/i, /<title>([^<]+)<\/title>/i])
      ?? 'Untitled';

    const author = jsonLd.author
      ?? extractMetaContent(html, [/name=["']author["']\s+content=["']([^"']+)/i, /rel=["']author["'][^>]*>([^<]+)/i]);

    const mainHtml = findMainContent(html);
    const preserveSemantic = config.options?.preserveSemantic !== false;
    const content = preserveSemantic
      ? mainHtml.replace(/<(script|style|nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1>/gi, '').trim()
      : extractTextContent(mainHtml);

    return {
      content,
      sourceMetadata: {
        title,
        url: input.url,
        capturedAt: new Date().toISOString(),
        contentType: 'text/html',
        author,
        tags: jsonLd.date ? ['article', `published:${jsonLd.date}`] : ['article'],
        source: 'web_article',
      },
      rawData: config.options?.includeRaw ? html : undefined,
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

export default WebArticleCaptureProvider;
