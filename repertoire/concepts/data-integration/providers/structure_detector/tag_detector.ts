// Tag detector — finds #hashtags and @mentions in text content
// Normalizes CamelCase to kebab-case, deduplicates, strips trailing punctuation

export const PROVIDER_ID = 'tag_detector';
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

function camelToKebab(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function stripTrailingPunctuation(str: string): string {
  return str.replace(/[.,;:!?)]+$/, '');
}

function normalizeTag(raw: string): string {
  const stripped = stripTrailingPunctuation(raw);
  return camelToKebab(stripped);
}

export class TagDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const threshold = config.confidenceThreshold ?? 0.5;
    const detections: Detection[] = [];

    // Detect hashtags: #word pattern (must be preceded by whitespace, start-of-line, or start-of-string)
    const hashtagRegex = /(?:^|(?<=\s))#([A-Za-z_]\w{0,138})\b/g;
    const seenTags = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = hashtagRegex.exec(text)) !== null) {
      const raw = match[1];
      const normalized = normalizeTag(raw);
      if (normalized.length === 0) continue;
      if (seenTags.has(normalized)) continue;
      seenTags.add(normalized);

      const confidence = normalized.length >= 3 ? 0.90 : 0.75;
      if (confidence < threshold) continue;

      detections.push({
        field: 'tags',
        value: normalized,
        type: 'hashtag',
        confidence,
        evidence: match[0].trim(),
      });
    }

    // Detect mentions: @username pattern
    const mentionRegex = /(?:^|(?<=\s))@([A-Za-z_]\w{0,38})\b/g;
    const seenMentions = new Set<string>();

    while ((match = mentionRegex.exec(text)) !== null) {
      const raw = match[1];
      const normalized = stripTrailingPunctuation(raw).toLowerCase();
      if (normalized.length === 0) continue;
      if (seenMentions.has(normalized)) continue;
      seenMentions.add(normalized);

      const confidence = normalized.length >= 2 ? 0.90 : 0.70;
      if (confidence < threshold) continue;

      detections.push({
        field: 'mentions',
        value: normalized,
        type: 'mention',
        confidence,
        evidence: match[0].trim(),
      });
    }

    // Aggregate tags and mentions into arrays if multiple found
    const tagValues = detections.filter(d => d.field === 'tags').map(d => d.value);
    const mentionValues = detections.filter(d => d.field === 'mentions').map(d => d.value);
    const aggregated: Detection[] = [];

    if (tagValues.length > 0) {
      aggregated.push({
        field: 'tags',
        value: tagValues,
        type: 'hashtag_list',
        confidence: 0.90,
        evidence: `Found ${tagValues.length} hashtag(s)`,
      });
    }

    if (mentionValues.length > 0) {
      aggregated.push({
        field: 'mentions',
        value: mentionValues,
        type: 'mention_list',
        confidence: 0.90,
        evidence: `Found ${mentionValues.length} mention(s)`,
      });
    }

    // Return individual detections plus aggregate summaries
    return [...detections, ...aggregated];
  }

  appliesTo(contentType: string): boolean {
    return ['text/plain', 'text/html', 'text/markdown', 'application/json'].includes(contentType);
  }
}

export default TagDetectorProvider;
