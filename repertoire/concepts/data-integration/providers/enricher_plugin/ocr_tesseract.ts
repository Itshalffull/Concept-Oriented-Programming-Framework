// Clef Data Integration Kit - Local OCR via Tesseract enricher provider
// Shells out to the tesseract binary, parses HOCR output for word-level bounding boxes.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export const PROVIDER_ID = 'ocr_tesseract';
export const PLUGIN_TYPE = 'enricher_plugin';

export interface ContentItem {
  id: string;
  content: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}

export interface EnricherConfig {
  model?: string;
  apiKey?: string;
  threshold?: number;
  options?: Record<string, unknown>;
}

export interface EnrichmentResult {
  fields: Record<string, unknown>;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface SchemaRef {
  name: string;
  fields?: string[];
}

export interface CostEstimate {
  tokens?: number;
  apiCalls?: number;
  durationMs?: number;
}

interface WordBox {
  word: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
}

function parseHocr(hocr: string): { text: string; wordBoxes: WordBox[] } {
  const wordBoxes: WordBox[] = [];
  const lines: string[] = [];

  // Match ocrx_word spans: <span class='ocrx_word' ... title='bbox x1 y1 x2 y2; x_wconf NN'>word</span>
  const wordPattern = /<span[^>]*class=['"]ocrx_word['"][^>]*title=['"]bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+);\s*x_wconf\s+(\d+)['"][^>]*>([^<]+)<\/span>/gi;
  let match: RegExpExecArray | null;

  while ((match = wordPattern.exec(hocr)) !== null) {
    const [, x1Str, y1Str, x2Str, y2Str, confStr, word] = match;
    const conf = parseInt(confStr, 10) / 100;
    wordBoxes.push({
      word: word.trim(),
      x1: parseInt(x1Str, 10),
      y1: parseInt(y1Str, 10),
      x2: parseInt(x2Str, 10),
      y2: parseInt(y2Str, 10),
      confidence: conf,
    });
  }

  // Extract line-level text from ocr_line spans
  const linePattern = /<span[^>]*class=['"]ocr_line['"][^>]*>([\s\S]*?)<\/span>\s*(?=<span[^>]*class=['"]ocr_line|<\/p>|<\/div>)/gi;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = linePattern.exec(hocr)) !== null) {
    const lineHtml = lineMatch[1];
    const stripped = lineHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (stripped) lines.push(stripped);
  }

  const text = lines.length > 0 ? lines.join('\n') : wordBoxes.map((w) => w.word).join(' ');
  return { text, wordBoxes };
}

export class OcrTesseractEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const language = (config.options?.language as string) ?? 'eng';
    const psm = (config.options?.psm as number) ?? 3;
    const dpi = (config.options?.dpi as number) ?? 300;

    // Write image content (base64-encoded) to a temp file
    const tmpPath = join(tmpdir(), `clef_ocr_${item.id}_${Date.now()}.png`);
    const imageBuffer = Buffer.from(item.content, 'base64');
    writeFileSync(tmpPath, imageBuffer);

    try {
      const args = [
        tmpPath,
        'stdout',
        '-l', language,
        '--psm', String(psm),
        '--dpi', String(dpi),
        'hocr',
      ];

      const { stdout, stderr } = await execFileAsync('tesseract', args, {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stderr && stderr.includes('Error')) {
        throw new Error(`Tesseract error: ${stderr}`);
      }

      const { text, wordBoxes } = parseHocr(stdout);
      const avgConfidence = wordBoxes.length > 0
        ? wordBoxes.reduce((sum, w) => sum + w.confidence, 0) / wordBoxes.length
        : 0;

      return {
        fields: {
          extracted_text: text,
          word_boxes: wordBoxes,
          word_count: wordBoxes.length,
        },
        confidence: avgConfidence,
        metadata: {
          provider: PROVIDER_ID,
          language,
          psm,
          dpi,
          processingEngine: 'tesseract',
        },
      };
    } finally {
      try { unlinkSync(tmpPath); } catch { /* cleanup best-effort */ }
    }
  }

  appliesTo(schema: SchemaRef): boolean {
    const imageSchemas = ['image', 'document_scan', 'scanned_page', 'photo'];
    return imageSchemas.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const sizeKb = Buffer.byteLength(item.content, 'base64') / 1024;
    // Tesseract local processing: ~500ms per page, scales with image size
    const estimatedMs = Math.max(500, Math.min(30000, sizeKb * 2));
    return {
      durationMs: Math.round(estimatedMs),
      apiCalls: 0,
    };
  }
}

export default OcrTesseractEnricherProvider;
