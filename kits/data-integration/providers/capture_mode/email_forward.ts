// Data Integration Kit - Email Forward Capture Provider
// Parses forwarded email via RFC 2822 headers and MIME multipart decoding

export const PROVIDER_ID = 'email_forward';
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

interface EmailHeaders {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  contentType: string;
  boundary?: string;
  [key: string]: string | undefined;
}

interface MimePart {
  contentType: string;
  encoding?: string;
  body: string;
  filename?: string;
}

function parseHeaders(raw: string): EmailHeaders {
  const headers: Record<string, string> = {};
  // Unfold continuation lines (lines starting with whitespace)
  const unfolded = raw.replace(/\r?\n([ \t]+)/g, ' ');
  const lines = unfolded.split(/\r?\n/);

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const name = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();
    headers[name] = value;
  }

  const contentType = headers['content-type'] || 'text/plain';
  const boundaryMatch = contentType.match(/boundary=["']?([^"';\s]+)["']?/i);

  return {
    from: headers['from'] || '',
    to: headers['to'] || '',
    subject: headers['subject'] || '(No Subject)',
    date: headers['date'] || '',
    messageId: headers['message-id'] || '',
    contentType,
    boundary: boundaryMatch?.[1],
  };
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, '') // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBase64(input: string): string {
  try {
    return Buffer.from(input.replace(/\s/g, ''), 'base64').toString('utf-8');
  } catch {
    return input;
  }
}

function decodeBody(body: string, encoding?: string): string {
  if (!encoding) return body;
  switch (encoding.toLowerCase()) {
    case 'quoted-printable': return decodeQuotedPrintable(body);
    case 'base64': return decodeBase64(body);
    case '7bit':
    case '8bit':
    default: return body;
  }
}

function parseMultipart(body: string, boundary: string): MimePart[] {
  const parts: MimePart[] = [];
  const delimiter = `--${boundary}`;
  const segments = body.split(delimiter);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed || trimmed === '--') continue;

    const headerEnd = trimmed.indexOf('\n\n') !== -1
      ? trimmed.indexOf('\n\n')
      : trimmed.indexOf('\r\n\r\n');

    if (headerEnd === -1) continue;

    const headerSection = trimmed.substring(0, headerEnd);
    const bodySection = trimmed.substring(headerEnd).trim();

    const partHeaders: Record<string, string> = {};
    const unfolded = headerSection.replace(/\r?\n([ \t]+)/g, ' ');
    for (const line of unfolded.split(/\r?\n/)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      partHeaders[line.substring(0, colonIdx).trim().toLowerCase()] = line.substring(colonIdx + 1).trim();
    }

    const ct = partHeaders['content-type'] || 'text/plain';
    const encoding = partHeaders['content-transfer-encoding'];
    const disposition = partHeaders['content-disposition'] || '';
    const filenameMatch = disposition.match(/filename=["']?([^"';\s]+)["']?/i);

    parts.push({
      contentType: ct.split(';')[0].trim(),
      encoding,
      body: decodeBody(bodySection, encoding),
      filename: filenameMatch?.[1],
    });
  }
  return parts;
}

function extractForwardedChain(body: string): string[] {
  const chain: string[] = [];
  const forwardPatterns = [
    /[-]+\s*(?:Forwarded|Original)\s+[Mm]essage\s*[-]+/g,
    /^>+\s*(?:From|Date|Subject|To):/gm,
  ];

  let segments = [body];
  for (const pattern of forwardPatterns) {
    const newSegments: string[] = [];
    for (const seg of segments) {
      newSegments.push(...seg.split(pattern));
    }
    segments = newSegments;
  }

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed.length > 0) chain.push(trimmed);
  }
  return chain;
}

function splitHeadersBody(raw: string): { headers: string; body: string } {
  const doubleLine = raw.indexOf('\n\n') !== -1
    ? raw.indexOf('\n\n')
    : raw.indexOf('\r\n\r\n');
  if (doubleLine === -1) return { headers: raw, body: '' };
  return {
    headers: raw.substring(0, doubleLine),
    body: raw.substring(doubleLine).trim(),
  };
}

export class EmailForwardCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    const rawEmail = input.email;
    if (!rawEmail) throw new Error('email_forward capture requires email content');

    const { headers: headerSection, body: bodySection } = splitHeadersBody(rawEmail);
    const headers = parseHeaders(headerSection);

    let textContent = '';
    let htmlContent = '';
    const attachments: MimePart[] = [];

    if (headers.boundary) {
      const parts = parseMultipart(bodySection, headers.boundary);
      for (const part of parts) {
        if (part.filename) {
          attachments.push(part);
        } else if (part.contentType === 'text/plain' && !textContent) {
          textContent = part.body;
        } else if (part.contentType === 'text/html' && !htmlContent) {
          htmlContent = part.body;
        }
      }
    } else {
      const encoding = headers['content-transfer-encoding'];
      textContent = decodeBody(bodySection, encoding);
    }

    const preferHtml = config.options?.preferHtml === true;
    const primaryContent = preferHtml && htmlContent ? htmlContent : textContent || htmlContent;
    const forwardChain = extractForwardedChain(primaryContent);

    const contentSummary = [
      `Subject: ${headers.subject}`,
      `From: ${headers.from}`,
      `To: ${headers.to}`,
      `Date: ${headers.date}`,
      headers.messageId ? `Message-ID: ${headers.messageId}` : '',
      attachments.length > 0 ? `Attachments: ${attachments.map(a => a.filename).join(', ')}` : '',
      `---`,
      primaryContent,
    ].filter(Boolean).join('\n');

    return {
      content: contentSummary,
      sourceMetadata: {
        title: headers.subject,
        capturedAt: new Date().toISOString(),
        contentType: 'message/rfc822',
        author: headers.from,
        tags: [
          'email',
          forwardChain.length > 1 ? 'forwarded' : 'direct',
          attachments.length > 0 ? 'has-attachments' : 'no-attachments',
        ],
        source: 'email_forward',
      },
      rawData: config.options?.includeRaw ? {
        headers,
        forwardChain,
        attachments: attachments.map(a => ({ filename: a.filename, contentType: a.contentType })),
      } : undefined,
    };
  }

  supports(input: CaptureInput): boolean {
    return typeof input.email === 'string' && input.email.length > 0;
  }
}

export default EmailForwardCaptureProvider;
