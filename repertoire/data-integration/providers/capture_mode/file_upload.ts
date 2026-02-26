// Data Integration Kit - File Upload Capture Provider
// Direct file ingestion with MIME detection via magic bytes and metadata extraction

export const PROVIDER_ID = 'file_upload';
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

interface MagicSignature {
  bytes: number[];
  offset: number;
  mimeType: string;
  extension: string;
}

const MAGIC_SIGNATURES: MagicSignature[] = [
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mimeType: 'image/png', extension: 'png' },
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeType: 'image/jpeg', extension: 'jpg' },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0, mimeType: 'image/gif', extension: 'gif' },
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0, mimeType: 'image/gif', extension: 'gif' },
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: 'application/pdf', extension: 'pdf' },
  { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeType: 'application/zip', extension: 'zip' },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: 'image/webp', extension: 'webp' },
  { bytes: [0x42, 0x4D], offset: 0, mimeType: 'image/bmp', extension: 'bmp' },
  { bytes: [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], offset: 0, mimeType: 'video/mp4', extension: 'mp4' },
  { bytes: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], offset: 0, mimeType: 'video/mp4', extension: 'mp4' },
  { bytes: [0x49, 0x44, 0x33], offset: 0, mimeType: 'audio/mpeg', extension: 'mp3' },
  { bytes: [0x66, 0x4C, 0x61, 0x43], offset: 0, mimeType: 'audio/flac', extension: 'flac' },
  { bytes: [0x4F, 0x67, 0x67, 0x53], offset: 0, mimeType: 'audio/ogg', extension: 'ogg' },
  { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0, mimeType: 'video/webm', extension: 'webm' },
  { bytes: [0x7B], offset: 0, mimeType: 'application/json', extension: 'json' },
];

function detectMimeType(buffer: Buffer): { mimeType: string; extension: string } {
  for (const sig of MAGIC_SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) { match = false; break; }
    }
    if (match) return { mimeType: sig.mimeType, extension: sig.extension };
  }

  // Check for text-based formats by examining first bytes
  const header = buffer.slice(0, Math.min(buffer.length, 512)).toString('utf-8');
  if (header.trimStart().startsWith('<?xml') || header.trimStart().startsWith('<svg')) {
    return { mimeType: 'image/svg+xml', extension: 'svg' };
  }
  if (header.trimStart().startsWith('<!DOCTYPE html') || header.trimStart().startsWith('<html')) {
    return { mimeType: 'text/html', extension: 'html' };
  }
  // Check if content is valid UTF-8 text
  try {
    const text = buffer.toString('utf-8');
    if (/^[\x00-\x7F\xC0-\xFF]*$/.test(text.slice(0, 256))) {
      return { mimeType: 'text/plain', extension: 'txt' };
    }
  } catch { /* not text */ }

  return { mimeType: 'application/octet-stream', extension: 'bin' };
}

function extractPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  // PNG IHDR chunk starts at offset 16: 4 bytes width + 4 bytes height (big-endian)
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function extractJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  // Scan for SOF0 (0xFFC0) or SOF2 (0xFFC2) markers
  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xFF) { offset++; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    const segLen = buffer.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }
  return null;
}

function extractGifDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return { width, height };
}

function extractImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  switch (mimeType) {
    case 'image/png': return extractPngDimensions(buffer);
    case 'image/jpeg': return extractJpegDimensions(buffer);
    case 'image/gif': return extractGifDimensions(buffer);
    default: return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export class FileUploadCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    if (!input.file) throw new Error('file_upload capture requires a file buffer');

    const { mimeType, extension } = detectMimeType(input.file);
    const fileSize = input.file.length;
    const filename = (config.options?.filename as string) || `upload.${extension}`;

    const dimensions = mimeType.startsWith('image/')
      ? extractImageDimensions(input.file, mimeType)
      : null;

    const summaryParts = [
      `File: ${filename}`,
      `Type: ${mimeType}`,
      `Size: ${formatFileSize(fileSize)}`,
    ];
    if (dimensions) {
      summaryParts.push(`Dimensions: ${dimensions.width}x${dimensions.height}`);
    }

    const isText = mimeType.startsWith('text/') || mimeType === 'application/json';
    let textContent: string | undefined;
    if (isText && fileSize < 1048576) {
      textContent = input.file.toString('utf-8');
    }

    const tags = [extension, mimeType.split('/')[0]];
    if (dimensions) tags.push(`${dimensions.width}x${dimensions.height}`);

    return {
      content: textContent || summaryParts.join('\n'),
      sourceMetadata: {
        title: filename,
        capturedAt: new Date().toISOString(),
        contentType: mimeType,
        tags,
        source: 'file_upload',
      },
      rawData: config.options?.includeBuffer ? {
        buffer: input.file,
        dimensions,
        fileSize,
        detectedMime: mimeType,
      } : undefined,
    };
  }

  supports(input: CaptureInput): boolean {
    return input.file !== undefined && input.file !== null && input.file.length > 0;
  }
}

export default FileUploadCaptureProvider;
