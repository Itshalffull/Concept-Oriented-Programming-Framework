// Data Integration Kit - Share Intent Capture Provider
// Mobile/OS share sheet receiver normalizing across iOS NSItemProvider and Android Intent extras

export const PROVIDER_ID = 'share_intent';
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

type SharePlatform = 'ios' | 'android' | 'web' | 'desktop' | 'unknown';

interface NormalizedShareData {
  text?: string;
  url?: string;
  title?: string;
  images?: ShareImage[];
  files?: ShareFile[];
  platform: SharePlatform;
  contentType: ShareContentType;
}

interface ShareImage {
  data: Buffer | string;
  mimeType: string;
  width?: number;
  height?: number;
}

interface ShareFile {
  data: Buffer | string;
  mimeType: string;
  filename: string;
  size: number;
}

type ShareContentType = 'text' | 'url' | 'image' | 'file' | 'mixed';

function detectPlatform(shareData: Record<string, unknown>): SharePlatform {
  // iOS NSItemProvider pattern: has 'itemProviders' array or 'NSExtensionItem'
  if (shareData.itemProviders || shareData.NSExtensionItem || shareData.UTType) {
    return 'ios';
  }
  // Android Intent pattern: has 'action', 'type', 'extras'
  if (shareData.action || shareData.EXTRA_TEXT || shareData.EXTRA_STREAM) {
    return 'android';
  }
  // Web Share API: has 'title', 'text', 'url' from navigator.share()
  if (shareData.title !== undefined && (shareData.text !== undefined || shareData.url !== undefined)) {
    if (!shareData.action && !shareData.itemProviders) return 'web';
  }
  // Desktop: has clipboard or drag-and-drop data
  if (shareData.clipboardData || shareData.dataTransfer) {
    return 'desktop';
  }
  return 'unknown';
}

function normalizeIosShare(shareData: Record<string, unknown>): NormalizedShareData {
  const result: NormalizedShareData = { platform: 'ios', contentType: 'text' };

  // NSItemProvider provides typed data through UTType identifiers
  const items = (shareData.itemProviders || shareData.items || []) as Record<string, unknown>[];
  const extensionItem = shareData.NSExtensionItem as Record<string, unknown> | undefined;

  if (extensionItem?.attributedTitle) {
    result.title = String(extensionItem.attributedTitle);
  }

  for (const item of (Array.isArray(items) ? items : [])) {
    const uti = (item.UTType || item.typeIdentifier || '') as string;
    const data = item.data;

    if (uti.includes('public.url') || uti.includes('public.plain-text')) {
      const text = typeof data === 'string' ? data : '';
      if (text.match(/^https?:\/\//)) {
        result.url = text;
        result.contentType = 'url';
      } else {
        result.text = text;
      }
    } else if (uti.includes('public.image')) {
      result.images = result.images || [];
      result.images.push({
        data: data as Buffer | string,
        mimeType: uti.includes('png') ? 'image/png' : 'image/jpeg',
      });
      result.contentType = result.url || result.text ? 'mixed' : 'image';
    } else if (uti.includes('public.file-url') || uti.includes('public.data')) {
      result.files = result.files || [];
      result.files.push({
        data: data as Buffer | string,
        mimeType: (item.mimeType as string) || 'application/octet-stream',
        filename: (item.suggestedName || item.filename || 'shared-file') as string,
        size: typeof data === 'string' ? data.length : ((data as Buffer)?.length || 0),
      });
      result.contentType = 'file';
    }
  }

  return result;
}

function normalizeAndroidShare(shareData: Record<string, unknown>): NormalizedShareData {
  const result: NormalizedShareData = { platform: 'android', contentType: 'text' };
  const action = (shareData.action || '') as string;

  // ACTION_SEND and ACTION_SEND_MULTIPLE handling
  if (shareData.EXTRA_TEXT) {
    const text = String(shareData.EXTRA_TEXT);
    if (text.match(/^https?:\/\//)) {
      result.url = text;
      result.contentType = 'url';
    } else {
      result.text = text;
    }
  }
  if (shareData.EXTRA_SUBJECT) {
    result.title = String(shareData.EXTRA_SUBJECT);
  }
  if (shareData.EXTRA_HTML_TEXT) {
    result.text = result.text || String(shareData.EXTRA_HTML_TEXT);
  }

  // EXTRA_STREAM contains URI(s) for shared files/images
  const streams = shareData.EXTRA_STREAM;
  if (streams) {
    const streamList = Array.isArray(streams) ? streams : [streams];
    const mimeType = (shareData.type || 'application/octet-stream') as string;

    for (const stream of streamList) {
      if (mimeType.startsWith('image/')) {
        result.images = result.images || [];
        result.images.push({ data: stream as Buffer | string, mimeType });
        result.contentType = result.text || result.url ? 'mixed' : 'image';
      } else {
        result.files = result.files || [];
        result.files.push({
          data: stream as Buffer | string,
          mimeType,
          filename: (stream as Record<string, unknown>)?.displayName as string || 'shared-file',
          size: 0,
        });
        result.contentType = 'file';
      }
    }
  }

  return result;
}

function normalizeWebShare(shareData: Record<string, unknown>): NormalizedShareData {
  const result: NormalizedShareData = { platform: 'web', contentType: 'text' };

  if (shareData.title) result.title = String(shareData.title);
  if (shareData.text) result.text = String(shareData.text);
  if (shareData.url) {
    result.url = String(shareData.url);
    result.contentType = 'url';
  }

  // Web Share API Level 2: files array
  const files = shareData.files as File[] | undefined;
  if (files && Array.isArray(files)) {
    result.files = files.map(f => ({
      data: f as unknown as Buffer,
      mimeType: (f as unknown as Record<string, string>).type || 'application/octet-stream',
      filename: (f as unknown as Record<string, string>).name || 'shared-file',
      size: (f as unknown as Record<string, number>).size || 0,
    }));
    result.contentType = result.url || result.text ? 'mixed' : 'file';
  }

  return result;
}

function normalizeShareData(shareData: unknown): NormalizedShareData {
  if (!shareData || typeof shareData !== 'object') {
    return { platform: 'unknown', contentType: 'text', text: String(shareData ?? '') };
  }

  const data = shareData as Record<string, unknown>;
  const platform = detectPlatform(data);

  switch (platform) {
    case 'ios': return normalizeIosShare(data);
    case 'android': return normalizeAndroidShare(data);
    case 'web': return normalizeWebShare(data);
    default: return {
      platform,
      contentType: 'text',
      text: data.text as string | undefined,
      url: data.url as string | undefined,
      title: data.title as string | undefined,
    };
  }
}

export class ShareIntentCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (!input.shareData) throw new Error('share_intent capture requires shareData');

    const normalized = normalizeShareData(input.shareData);

    const contentParts: string[] = [];
    if (normalized.title) contentParts.push(`# ${normalized.title}`);
    if (normalized.url) contentParts.push(`URL: ${normalized.url}`);
    if (normalized.text) contentParts.push(normalized.text);
    if (normalized.images?.length) {
      contentParts.push(`\nImages: ${normalized.images.length} shared`);
      normalized.images.forEach((img, i) => {
        contentParts.push(`  [${i + 1}] ${img.mimeType}${img.width ? ` ${img.width}x${img.height}` : ''}`);
      });
    }
    if (normalized.files?.length) {
      contentParts.push(`\nFiles: ${normalized.files.length} shared`);
      normalized.files.forEach((file, i) => {
        contentParts.push(`  [${i + 1}] ${file.filename} (${file.mimeType}, ${file.size} bytes)`);
      });
    }

    const title = normalized.title
      || (normalized.url ? `Shared: ${new URL(normalized.url).hostname}` : undefined)
      || 'Shared Content';

    const contentType = normalized.contentType === 'image' ? 'image/*'
      : normalized.contentType === 'url' ? 'text/uri-list'
      : normalized.contentType === 'file' ? 'application/octet-stream'
      : 'text/plain';

    return {
      content: contentParts.join('\n') || '(empty share)',
      sourceMetadata: {
        title,
        url: normalized.url,
        capturedAt: new Date().toISOString(),
        contentType,
        tags: [
          'share-intent',
          normalized.platform,
          normalized.contentType,
          ...(normalized.images?.length ? ['has-images'] : []),
          ...(normalized.files?.length ? ['has-files'] : []),
        ],
        source: 'share_intent',
      },
      rawData: config.options?.includeRaw ? normalized : undefined,
    };
  }

  supports(input: CaptureInput): boolean {
    return input.shareData !== undefined && input.shareData !== null;
  }
}

export default ShareIntentCaptureProvider;
