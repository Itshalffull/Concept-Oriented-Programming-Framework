// List detector — detects bullet, numbered, and checkbox lists in text
// Handles nested items via indentation depth analysis

export const PROVIDER_ID = 'list_detector';
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

interface ListItem {
  text: string;
  depth: number;
  checked?: boolean;
}

interface ListBlock {
  items: ListItem[];
  listType: 'bullet' | 'numbered' | 'checkbox';
  nested: boolean;
  startLine: number;
  endLine: number;
}

// Patterns for different list types
const BULLET_RE = /^(\s*)([-*\u2022\u2023])\s+(.+)$/;
const NUMBERED_RE = /^(\s*)(\d+[.)]|[a-zA-Z][.)]|[ivxlc]+[.)])\s+(.+)$/;
const CHECKBOX_RE = /^(\s*)([-*])\s+\[([ xX])\]\s+(.+)$/;

function measureIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  const spaces = match[1];
  // Count tabs as 4 spaces
  let depth = 0;
  for (const ch of spaces) {
    depth += ch === '\t' ? 4 : 1;
  }
  return Math.floor(depth / 2); // normalize: 2 spaces = 1 level
}

function detectListBlocks(lines: string[]): ListBlock[] {
  const blocks: ListBlock[] = [];
  let currentItems: ListItem[] = [];
  let currentType: 'bullet' | 'numbered' | 'checkbox' | null = null;
  let blockStart = 0;

  function flushBlock(endLine: number): void {
    if (currentItems.length >= 2 && currentType) {
      const nested = currentItems.some(item => item.depth > 0);
      blocks.push({
        items: [...currentItems],
        listType: currentType,
        nested,
        startLine: blockStart,
        endLine,
      });
    }
    currentItems = [];
    currentType = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    if (trimmed.length === 0) {
      // Blank line may break a list if next line is not a list item
      if (currentItems.length > 0 && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trimEnd();
        if (!BULLET_RE.test(nextLine) && !NUMBERED_RE.test(nextLine) && !CHECKBOX_RE.test(nextLine)) {
          flushBlock(i - 1);
        }
      }
      continue;
    }

    // Try checkbox first (it is a superset of bullet pattern)
    const cbMatch = trimmed.match(CHECKBOX_RE);
    if (cbMatch) {
      if (currentType && currentType !== 'checkbox') flushBlock(i - 1);
      if (!currentType) { currentType = 'checkbox'; blockStart = i; }
      currentItems.push({
        text: cbMatch[4].trim(),
        depth: measureIndent(trimmed),
        checked: cbMatch[3] !== ' ',
      });
      continue;
    }

    // Try bullet
    const bulletMatch = trimmed.match(BULLET_RE);
    if (bulletMatch) {
      if (currentType && currentType !== 'bullet') flushBlock(i - 1);
      if (!currentType) { currentType = 'bullet'; blockStart = i; }
      currentItems.push({
        text: bulletMatch[3].trim(),
        depth: measureIndent(trimmed),
      });
      continue;
    }

    // Try numbered
    const numMatch = trimmed.match(NUMBERED_RE);
    if (numMatch) {
      if (currentType && currentType !== 'numbered') flushBlock(i - 1);
      if (!currentType) { currentType = 'numbered'; blockStart = i; }
      currentItems.push({
        text: numMatch[3].trim(),
        depth: measureIndent(trimmed),
      });
      continue;
    }

    // Non-list line: check if indented continuation of previous item
    if (currentItems.length > 0 && measureIndent(trimmed) > 0) {
      // Treat as continuation of previous item
      const lastItem = currentItems[currentItems.length - 1];
      lastItem.text += ' ' + trimmed.trim();
      continue;
    }

    // Truly non-list line
    flushBlock(i - 1);
  }

  flushBlock(lines.length - 1);
  return blocks;
}

export class ListDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const threshold = config.confidenceThreshold ?? 0.5;
    const lines = text.split(/\r?\n/);
    const blocks = detectListBlocks(lines);
    const detections: Detection[] = [];

    for (const block of blocks) {
      const itemCount = block.items.length;
      // More items = higher confidence
      let confidence = itemCount >= 5 ? 0.95 : itemCount >= 3 ? 0.88 : 0.75;
      // Checkbox lists are very specific
      if (block.listType === 'checkbox') confidence = Math.min(confidence + 0.05, 0.99);
      if (confidence < threshold) continue;

      detections.push({
        field: 'list',
        value: {
          items: block.items.map(item => {
            const entry: Record<string, unknown> = { text: item.text, depth: item.depth };
            if (item.checked !== undefined) entry.checked = item.checked;
            return entry;
          }),
          type: block.listType,
          nested: block.nested,
          itemCount,
        },
        type: 'list',
        confidence,
        evidence: `${block.listType} list with ${itemCount} items (lines ${block.startLine + 1}-${block.endLine + 1})`,
      });
    }

    return detections;
  }

  appliesTo(contentType: string): boolean {
    return ['text/plain', 'text/html', 'text/markdown'].includes(contentType);
  }
}

export default ListDetectorProvider;
