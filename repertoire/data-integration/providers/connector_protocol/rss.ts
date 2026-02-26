// RSS — connector_protocol provider
// RSS/Atom feed parser with entry dedup via guid, enclosure handling, and conditional GET via ETag/Last-Modified

export interface ConnectorConfig {
  baseUrl?: string;
  connectionString?: string;
  auth?: Record<string, unknown>;
  headers?: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface QuerySpec {
  path?: string;
  query?: string;
  params?: Record<string, unknown>;
  cursor?: string;
  limit?: number;
}

export interface WriteResult { created: number; updated: number; skipped: number; errors: number; }
export interface TestResult { connected: boolean; message: string; latencyMs?: number; }
export interface StreamDef { name: string; schema: Record<string, unknown>; supportedSyncModes: string[]; }
export interface DiscoveryResult { streams: StreamDef[]; }

export const PROVIDER_ID = 'rss';
export const PLUGIN_TYPE = 'connector_protocol';

interface FeedEntry {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author: string;
  categories: string[];
  enclosures: Array<{ url: string; type: string; length: number }>;
}

type FeedType = 'rss' | 'atom' | 'unknown';

function detectFeedType(xml: string): FeedType {
  if (xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"')) return 'atom';
  if (xml.includes('<rss') || xml.includes('<channel>')) return 'rss';
  return 'unknown';
}

function extractTagContent(xml: string, tag: string): string {
  const openPattern = new RegExp(`<${tag}[^>]*>`, 'i');
  const closePattern = new RegExp(`</${tag}>`, 'i');
  const openMatch = xml.match(openPattern);
  if (!openMatch) return '';
  const startIdx = openMatch.index! + openMatch[0].length;
  const closeMatch = xml.slice(startIdx).match(closePattern);
  if (!closeMatch) return '';
  const content = xml.slice(startIdx, startIdx + closeMatch.index!);
  return content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function extractAttribute(tag: string, attr: string): string {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function parseRSSItems(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const guid = extractTagContent(item, 'guid') || extractTagContent(item, 'link') || '';
    const enclosures: FeedEntry['enclosures'] = [];
    const encRegex = /<enclosure([^>]*?)\/?\s*>/gi;
    let encMatch;
    while ((encMatch = encRegex.exec(item)) !== null) {
      enclosures.push({
        url: extractAttribute(encMatch[1], 'url'),
        type: extractAttribute(encMatch[1], 'type'),
        length: parseInt(extractAttribute(encMatch[1], 'length') || '0', 10),
      });
    }
    const catRegex = /<category[^>]*>([\s\S]*?)<\/category>/gi;
    const categories: string[] = [];
    let catMatch;
    while ((catMatch = catRegex.exec(item)) !== null) {
      categories.push(catMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
    }
    entries.push({
      guid,
      title: extractTagContent(item, 'title'),
      link: extractTagContent(item, 'link'),
      description: extractTagContent(item, 'description'),
      pubDate: extractTagContent(item, 'pubDate'),
      author: extractTagContent(item, 'author') || extractTagContent(item, 'dc:creator'),
      categories,
      enclosures,
    });
  }
  return entries;
}

function parseAtomEntries(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const linkMatch = entry.match(/<link[^>]*href\s*=\s*"([^"]*)"[^>]*\/?\s*>/i);
    const link = linkMatch ? linkMatch[1] : '';
    entries.push({
      guid: extractTagContent(entry, 'id') || link,
      title: extractTagContent(entry, 'title'),
      link,
      description: extractTagContent(entry, 'summary') || extractTagContent(entry, 'content'),
      pubDate: extractTagContent(entry, 'updated') || extractTagContent(entry, 'published'),
      author: extractTagContent(entry, 'name'),
      categories: [],
      enclosures: [],
    });
  }
  return entries;
}

export class RssConnectorProvider {
  private etag: string | null = null;
  private lastModified: string | null = null;
  private seenGuids = new Set<string>();

  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const feedUrl = config.baseUrl ?? query.path ?? '';
    const headers: Record<string, string> = { ...config.headers };
    if (this.etag) headers['If-None-Match'] = this.etag;
    if (this.lastModified) headers['If-Modified-Since'] = this.lastModified;

    const resp = await fetch(feedUrl, { headers });
    if (resp.status === 304) return; // Not modified
    if (!resp.ok) throw new Error(`Feed fetch failed: ${resp.status}`);

    this.etag = resp.headers.get('ETag');
    this.lastModified = resp.headers.get('Last-Modified');

    const xml = await resp.text();
    const feedType = detectFeedType(xml);
    const entries = feedType === 'atom' ? parseAtomEntries(xml) : parseRSSItems(xml);
    const limit = query.limit ?? entries.length;
    const dedupEnabled = (config.options?.dedup as boolean) ?? true;

    let yielded = 0;
    for (const entry of entries) {
      if (yielded >= limit) break;
      if (dedupEnabled && this.seenGuids.has(entry.guid)) continue;
      this.seenGuids.add(entry.guid);
      yield entry as unknown as Record<string, unknown>;
      yielded++;
    }
  }

  async write(_records: Record<string, unknown>[], _config: ConnectorConfig): Promise<WriteResult> {
    // RSS feeds are read-only
    return { created: 0, updated: 0, skipped: _records.length, errors: 0 };
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const feedUrl = config.baseUrl ?? '';
    const start = Date.now();
    try {
      const resp = await fetch(feedUrl, { method: 'HEAD', headers: config.headers });
      const contentType = resp.headers.get('Content-Type') ?? '';
      const isFeed = contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom');
      return {
        connected: resp.ok,
        message: resp.ok
          ? `Feed accessible (${isFeed ? 'feed content-type detected' : 'non-feed content-type'})`
          : `HTTP ${resp.status}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const feedUrl = config.baseUrl ?? '';
    try {
      const resp = await fetch(feedUrl, { headers: config.headers });
      if (!resp.ok) return { streams: [] };
      const xml = await resp.text();
      const feedType = detectFeedType(xml);
      const title = extractTagContent(xml, 'title');
      return {
        streams: [{
          name: title || feedUrl,
          schema: {
            type: 'object',
            properties: {
              guid: { type: 'string' },
              title: { type: 'string' },
              link: { type: 'string' },
              description: { type: 'string' },
              pubDate: { type: 'string' },
              author: { type: 'string' },
              categories: { type: 'array', items: { type: 'string' } },
              enclosures: { type: 'array' },
            },
          },
          supportedSyncModes: ['full_refresh', 'incremental'],
        }],
      };
    } catch {
      return { streams: [] };
    }
  }
}

export default RssConnectorProvider;
