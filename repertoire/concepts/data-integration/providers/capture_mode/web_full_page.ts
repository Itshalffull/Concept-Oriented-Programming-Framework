// Data Integration Kit - Web Full Page Capture Provider
// Full HTML snapshot with inlined styles and base64-encoded images

export const PROVIDER_ID = 'web_full_page';
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

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function extractStylesheetUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    urls.push(resolveUrl(baseUrl, match[1]));
  }
  return urls;
}

function extractImageUrls(html: string, baseUrl: string): Map<string, string> {
  const map = new Map<string, string>();
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const original = match[1];
    if (!original.startsWith('data:')) {
      map.set(original, resolveUrl(baseUrl, original));
    }
  }
  return map;
}

function resolveRelativeUrls(html: string, baseUrl: string): string {
  return html.replace(/(href|src|action)=["']([^"'#][^"']*)["']/gi, (full, attr, url) => {
    if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#')) {
      return full;
    }
    const resolved = resolveUrl(baseUrl, url);
    return `${attr}="${resolved}"`;
  });
}

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

async function inlineStylesheets(html: string, baseUrl: string): Promise<string> {
  const stylesheetUrls = extractStylesheetUrls(html, baseUrl);
  let result = html;

  for (const cssUrl of stylesheetUrls) {
    try {
      const response = await fetch(cssUrl);
      const cssText = await response.text();
      const resolvedCss = cssText.replace(/url\(["']?([^"')]+)["']?\)/g, (_, path) => {
        return `url("${resolveUrl(cssUrl, path)}")`;
      });
      const styleTag = `<style data-original-href="${cssUrl}">\n${resolvedCss}\n</style>`;
      const linkPattern = new RegExp(
        `<link[^>]+href=["']${cssUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i'
      );
      result = result.replace(linkPattern, styleTag);
    } catch {
      // Keep original link tag if fetch fails
    }
  }
  return result;
}

async function inlineImages(html: string, baseUrl: string): Promise<string> {
  const imageMap = extractImageUrls(html, baseUrl);
  let result = html;

  const entries = Array.from(imageMap.entries());
  const dataUris = await Promise.all(
    entries.map(([, absoluteUrl]) => fetchAsBase64(absoluteUrl))
  );

  entries.forEach(([originalSrc], index) => {
    const dataUri = dataUris[index];
    if (dataUri) {
      const escaped = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), dataUri);
    }
  });

  return result;
}

export class WebFullPageCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (!input.url) throw new Error('web_full_page capture requires a URL');

    const response = await fetch(input.url);
    let html = await response.text();

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || 'Untitled Page';

    html = resolveRelativeUrls(html, input.url);

    const inlineCss = config.options?.inlineStyles !== false;
    const inlineImgs = config.options?.inlineImages !== false;

    if (inlineCss) {
      html = await inlineStylesheets(html, input.url);
    }
    if (inlineImgs) {
      html = await inlineImages(html, input.url);
    }

    const timestamp = new Date().toISOString();
    const snapshotComment = `<!-- Full page snapshot captured from ${input.url} at ${timestamp} -->`;
    html = snapshotComment + '\n' + html;

    return {
      content: html,
      sourceMetadata: {
        title,
        url: input.url,
        capturedAt: timestamp,
        contentType: 'text/html',
        tags: ['full-page', 'snapshot'],
        source: 'web_full_page',
      },
      rawData: config.options?.includeOriginal ? { originalUrl: input.url } : undefined,
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

export default WebFullPageCaptureProvider;
