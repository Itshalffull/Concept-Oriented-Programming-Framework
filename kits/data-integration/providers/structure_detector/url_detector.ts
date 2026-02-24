// URL/email/phone detector — finds URLs, email addresses, and phone numbers
// Validates URL structure, normalizes phone numbers to E.164 format

export const PROVIDER_ID = 'url_detector';
export const PLUGIN_TYPE = 'structure_detector';

export interface DetectorConfig {
  options?: Record<string, unknown>;
  confidenceThreshold?: number;
}

export interface Detection {
  field: string;
  value: unknown;
  type: string;
  confidence: number;
  evidence: string;
}

// Country code mapping for phone normalization
const DEFAULT_COUNTRY_CODE = '+1';

function normalizePhoneToE164(raw: string): string {
  const digits = raw.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) {
    return digits;
  }
  if (digits.length === 10) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

function isValidUrlStructure(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

export class UrlDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const threshold = config.confidenceThreshold ?? 0.5;
    const detections: Detection[] = [];
    const seen = new Set<string>();

    // HTTP(S) URLs with path and query support
    const urlRegex = /https?:\/\/[A-Za-z0-9][-A-Za-z0-9]*(?:\.[A-Za-z0-9][-A-Za-z0-9]*)+(?::\d{1,5})?(?:\/[^\s<>"{}|\\^`\[\]]*)?/g;
    let match: RegExpExecArray | null;

    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0].replace(/[.,;:!?)]+$/, ''); // strip trailing punctuation
      if (!isValidUrlStructure(url)) continue;
      if (seen.has(url)) continue;
      seen.add(url);

      const hasPath = new URL(url).pathname.length > 1;
      const hasQuery = url.includes('?');
      const confidence = hasQuery ? 0.98 : hasPath ? 0.95 : 0.92;
      if (confidence < threshold) continue;

      detections.push({
        field: 'url',
        value: url,
        type: 'url',
        confidence,
        evidence: url,
      });
    }

    // Email addresses
    const emailRegex = /\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/g;

    while ((match = emailRegex.exec(text)) !== null) {
      const email = match[1].toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);

      // Validate domain has at least one dot
      const domain = email.split('@')[1];
      if (!domain || !domain.includes('.')) continue;
      const tld = domain.split('.').pop() ?? '';
      const confidence = tld.length >= 2 && tld.length <= 6 ? 0.95 : 0.80;
      if (confidence < threshold) continue;

      detections.push({
        field: 'email',
        value: email,
        type: 'email',
        confidence,
        evidence: match[0],
      });
    }

    // Phone numbers: international, US, and common formats
    const phonePatterns = [
      // International: +1-234-567-8900
      { regex: /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, confidence: 0.90 },
      // US parenthetical: (234) 567-8900
      { regex: /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g, confidence: 0.88 },
      // US standard: 234-567-8900 or 234.567.8900
      { regex: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, confidence: 0.82 },
    ];

    for (const pattern of phonePatterns) {
      pattern.regex.lastIndex = 0;
      while ((match = pattern.regex.exec(text)) !== null) {
        const raw = match[0];
        const normalized = normalizePhoneToE164(raw);
        const digits = normalized.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) continue;

        const dedupKey = `phone:${digits}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        if (pattern.confidence < threshold) continue;

        detections.push({
          field: 'phone',
          value: normalized,
          type: 'phone',
          confidence: pattern.confidence,
          evidence: raw,
        });
      }
    }

    return detections;
  }

  appliesTo(contentType: string): boolean {
    return ['text/plain', 'text/html', 'text/markdown', 'text/csv', 'application/json'].includes(contentType);
  }
}

export default UrlDetectorProvider;
