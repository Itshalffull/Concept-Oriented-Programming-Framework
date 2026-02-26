// Clef Data Integration Kit - Cloud OCR enricher provider (AWS Textract, Google Vision, Azure)
// Builds HTTP requests to cloud OCR APIs, parses structured responses with tables/forms/key-value pairs.

import * as https from 'https';
import * as crypto from 'crypto';

export const PROVIDER_ID = 'ocr_cloud';
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

type CloudProvider = 'textract' | 'vision' | 'azure';

interface TableCell {
  row: number;
  col: number;
  text: string;
  confidence: number;
}

interface FormField {
  key: string;
  value: string;
  confidence: number;
}

function buildTextractRequest(imageBytes: string, region: string, apiKey: string): {
  hostname: string; path: string; headers: Record<string, string>; body: string;
} {
  const body = JSON.stringify({
    Document: { Bytes: imageBytes },
    FeatureTypes: ['TABLES', 'FORMS'],
  });
  const host = `textract.${region}.amazonaws.com`;
  // AWS Signature V4 would be computed here; simplified for provider skeleton
  return {
    hostname: host,
    path: '/',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'Textract.AnalyzeDocument',
      'Authorization': `AWS4-HMAC-SHA256 Credential=${apiKey}`,
      'Content-Length': String(Buffer.byteLength(body)),
    },
    body,
  };
}

function buildVisionRequest(imageBytes: string, apiKey: string): {
  hostname: string; path: string; headers: Record<string, string>; body: string;
} {
  const body = JSON.stringify({
    requests: [{
      image: { content: imageBytes },
      features: [
        { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 50 },
        { type: 'TEXT_DETECTION', maxResults: 50 },
      ],
    }],
  });
  return {
    hostname: 'vision.googleapis.com',
    path: `/v1/images:annotate?key=${apiKey}`,
    headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) },
    body,
  };
}

function buildAzureRequest(imageBytes: string, apiKey: string, region: string): {
  hostname: string; path: string; headers: Record<string, string>; body: string;
} {
  const body = JSON.stringify({ url: `data:image/png;base64,${imageBytes}` });
  return {
    hostname: `${region}.api.cognitive.microsoft.com`,
    path: '/vision/v3.2/read/analyze?readingOrder=natural',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Length': String(Buffer.byteLength(body)),
    },
    body,
  };
}

function parseTextractResponse(data: any): {
  text: string; tables: TableCell[][]; forms: FormField[]; confidence: number;
} {
  const blocks = data.Blocks || [];
  const lineBlocks = blocks.filter((b: any) => b.BlockType === 'LINE');
  const text = lineBlocks.map((b: any) => b.Text).join('\n');
  const avgConf = lineBlocks.length > 0
    ? lineBlocks.reduce((s: number, b: any) => s + (b.Confidence || 0), 0) / lineBlocks.length / 100
    : 0;

  // Parse TABLE blocks into cell arrays
  const tables: TableCell[][] = [];
  const tableBlocks = blocks.filter((b: any) => b.BlockType === 'TABLE');
  for (const table of tableBlocks) {
    const cells: TableCell[] = [];
    const cellIds = (table.Relationships || [])
      .filter((r: any) => r.Type === 'CHILD')
      .flatMap((r: any) => r.Ids || []);
    for (const cellId of cellIds) {
      const cell = blocks.find((b: any) => b.Id === cellId && b.BlockType === 'CELL');
      if (cell) {
        const wordIds = (cell.Relationships || [])
          .filter((r: any) => r.Type === 'CHILD')
          .flatMap((r: any) => r.Ids || []);
        const cellText = wordIds
          .map((wid: string) => blocks.find((b: any) => b.Id === wid))
          .filter(Boolean)
          .map((b: any) => b.Text || '')
          .join(' ');
        cells.push({
          row: cell.RowIndex || 0,
          col: cell.ColumnIndex || 0,
          text: cellText,
          confidence: (cell.Confidence || 0) / 100,
        });
      }
    }
    tables.push(cells);
  }

  // Parse KEY_VALUE_SET blocks into form fields
  const forms: FormField[] = [];
  const kvBlocks = blocks.filter((b: any) => b.BlockType === 'KEY_VALUE_SET' && b.EntityTypes?.includes('KEY'));
  for (const kvKey of kvBlocks) {
    const keyWordIds = (kvKey.Relationships || [])
      .filter((r: any) => r.Type === 'CHILD')
      .flatMap((r: any) => r.Ids || []);
    const keyText = keyWordIds
      .map((wid: string) => blocks.find((b: any) => b.Id === wid))
      .filter(Boolean)
      .map((b: any) => b.Text || '')
      .join(' ');

    const valueRefs = (kvKey.Relationships || [])
      .filter((r: any) => r.Type === 'VALUE')
      .flatMap((r: any) => r.Ids || []);
    let valueText = '';
    for (const vId of valueRefs) {
      const valBlock = blocks.find((b: any) => b.Id === vId);
      if (valBlock) {
        const valWordIds = (valBlock.Relationships || [])
          .filter((r: any) => r.Type === 'CHILD')
          .flatMap((r: any) => r.Ids || []);
        valueText = valWordIds
          .map((wid: string) => blocks.find((b: any) => b.Id === wid))
          .filter(Boolean)
          .map((b: any) => b.Text || '')
          .join(' ');
      }
    }
    forms.push({ key: keyText, value: valueText, confidence: (kvKey.Confidence || 0) / 100 });
  }

  return { text, tables, forms, confidence: avgConf };
}

function parseVisionResponse(data: any): {
  text: string; tables: TableCell[][]; forms: FormField[]; confidence: number;
} {
  const responses = data.responses || [];
  const firstResp = responses[0] || {};
  const fullAnnotation = firstResp.fullTextAnnotation || {};
  const text = fullAnnotation.text || '';
  const pages = fullAnnotation.pages || [];
  let totalConf = 0;
  let confCount = 0;
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (block.confidence) { totalConf += block.confidence; confCount++; }
    }
  }
  return {
    text,
    tables: [],
    forms: [],
    confidence: confCount > 0 ? totalConf / confCount : 0,
  };
}

function makeHttpsRequest(options: {
  hostname: string; path: string; headers: Record<string, string>; body: string;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: options.hostname, path: options.path, method: 'POST', headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          try { resolve(JSON.parse(body)); } catch { resolve({ raw: body }); }
        });
      },
    );
    req.on('error', reject);
    req.write(options.body);
    req.end();
  });
}

export class OcrCloudEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const provider = (config.options?.provider as CloudProvider) ?? 'textract';
    const apiKey = config.apiKey ?? '';
    const region = (config.options?.region as string) ?? 'us-east-1';
    const imageBytes = item.content; // Expected base64

    let reqConfig: { hostname: string; path: string; headers: Record<string, string>; body: string };

    switch (provider) {
      case 'textract':
        reqConfig = buildTextractRequest(imageBytes, region, apiKey);
        break;
      case 'vision':
        reqConfig = buildVisionRequest(imageBytes, apiKey);
        break;
      case 'azure':
        reqConfig = buildAzureRequest(imageBytes, apiKey, region);
        break;
      default:
        throw new Error(`Unsupported OCR cloud provider: ${provider}`);
    }

    const rawResponse = await makeHttpsRequest(reqConfig);
    let parsed: { text: string; tables: TableCell[][]; forms: FormField[]; confidence: number };

    switch (provider) {
      case 'textract':
        parsed = parseTextractResponse(rawResponse);
        break;
      case 'vision':
        parsed = parseVisionResponse(rawResponse);
        break;
      case 'azure':
        // Azure uses async polling; simplified inline parsing
        parsed = {
          text: rawResponse?.analyzeResult?.readResults
            ?.flatMap((r: any) => r.lines?.map((l: any) => l.text) || [])
            .join('\n') || '',
          tables: [],
          forms: [],
          confidence: 0.9,
        };
        break;
      default:
        parsed = { text: '', tables: [], forms: [], confidence: 0 };
    }

    return {
      fields: {
        structured_text: parsed.text,
        tables: parsed.tables,
        forms: parsed.forms,
      },
      confidence: parsed.confidence,
      metadata: {
        provider: PROVIDER_ID,
        cloudProvider: provider,
        region,
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    const applicable = ['image', 'document', 'scan', 'receipt', 'invoice', 'form'];
    return applicable.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const sizeKb = Buffer.byteLength(item.content, 'base64') / 1024;
    const pages = Math.max(1, Math.ceil(sizeKb / 200));
    return {
      apiCalls: 1,
      durationMs: 1500 + pages * 500,
    };
  }
}

export default OcrCloudEnricherProvider;
