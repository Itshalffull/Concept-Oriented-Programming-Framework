// Data Integration Kit - Web Bookmark Capture Provider
// Lightweight metadata-only capture via OpenGraph, Twitter Card, and HTML meta tags

export const PROVIDER_ID = 'web_bookmark';
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

interface BookmarkData {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  canonicalUrl?: string;
  siteName?: string;
  twitterCard?: string;
  twitterSite?: string;
  author?: string;
  type?: string;
}

const MAX_HEAD_BYTES = 16384; // Only fetch first 16KB for metadata extraction

function extractMetaTag(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractOpenGraph(html: string): Partial<BookmarkData> {
  return {
    title: extractMetaTag(html, 'og:title'),
    description: extractMetaTag(html, 'og:description'),
    image: extractMetaTag(html, 'og:image'),
    siteName: extractMetaTag(html, 'og:site_name'),
    type: extractMetaTag(html, 'og:type'),
    canonicalUrl: extractMetaTag(html, 'og:url'),
  };
}

function extractTwitterCard(html: string): Partial<BookmarkData> {
  return {
    twitterCard: extractMetaTag(html, 'twitter:card'),
    title: extractMetaTag(html, 'twitter:title'),
    description: extractMetaTag(html, 'twitter:description'),
    image: extractMetaTag(html, 'twitter:image'),
    twitterSite: extractMetaTag(html, 'twitter:site'),
  };
}

function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

function extractMetaDescription(html: string): string | undefined {
  return extractMetaTag(html, 'description');
}

function extractFavicon(html: string, baseUrl: string): string | undefined {
  const patterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try { return new URL(match[1], baseUrl).href; } catch { return match[1]; }
    }
  }
  try { return new URL('/favicon.ico', baseUrl).href; } catch { return undefined; }
}

function extractCanonicalUrl(html: string): string | undefined {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return match?.[1]?.trim();
}

function extractAuthor(html: string): string | undefined {
  return extractMetaTag(html, 'author') ?? extractMetaTag(html, 'article:author');
}

function mergeBookmarkData(...sources: Partial<BookmarkData>[]): BookmarkData {
  const result: BookmarkData = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value && !(result as Record<string, unknown>)[key]) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }
  return result;
}

export class WebBookmarkCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (!input.url) throw new Error('web_bookmark capture requires a URL');

    const response = await fetch(input.url, {
      headers: { 'Range': `bytes=0-${MAX_HEAD_BYTES}` },
    });
    const html = await response.text();

    const og = extractOpenGraph(html);
    const twitter = extractTwitterCard(html);
    const htmlMeta: Partial<BookmarkData> = {
      title: extractHtmlTitle(html),
      description: extractMetaDescription(html),
      canonicalUrl: extractCanonicalUrl(html),
      favicon: extractFavicon(html, input.url),
      author: extractAuthor(html),
    };

    const bookmark = mergeBookmarkData(og, twitter, htmlMeta);
    const title = bookmark.title || 'Untitled Bookmark';

    const contentParts = [
      `# ${title}`,
      bookmark.description ? `\n${bookmark.description}` : '',
      bookmark.siteName ? `\nSite: ${bookmark.siteName}` : '',
      bookmark.author ? `\nAuthor: ${bookmark.author}` : '',
      bookmark.image ? `\nImage: ${bookmark.image}` : '',
      bookmark.favicon ? `\nFavicon: ${bookmark.favicon}` : '',
    ].filter(Boolean).join('');

    return {
      content: contentParts,
      sourceMetadata: {
        title,
        url: bookmark.canonicalUrl || input.url,
        capturedAt: new Date().toISOString(),
        contentType: 'application/x-bookmark',
        author: bookmark.author,
        tags: ['bookmark', bookmark.type || 'webpage'].filter(Boolean) as string[],
        source: 'web_bookmark',
      },
      rawData: config.options?.includeRawMeta ? bookmark : undefined,
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

export default WebBookmarkCaptureProvider;
