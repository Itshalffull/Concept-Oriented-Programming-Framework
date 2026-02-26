// COPF Data Integration Kit - Vision-Language Model captioning enricher provider
// Sends image to VLM API endpoint, receives caption + detailed description + detected objects.

import * as https from 'https';

export const PROVIDER_ID = 'vlm_caption';
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

interface DetectedObject {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

const DEFAULT_CAPTION_PROMPT = `Analyze this image and provide:
1. A concise caption (1 sentence)
2. A detailed description (2-4 sentences)
3. A list of detected objects with confidence scores

Respond in JSON format:
{
  "caption": "...",
  "description": "...",
  "detected_objects": [{"label": "...", "confidence": 0.0-1.0, "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}]
}`;

function buildVlmRequestBody(
  imageB64: string,
  model: string,
  maxTokens: number,
  promptTemplate: string,
): { messages: object[]; model: string; max_tokens: number } {
  return {
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imageB64}` },
          },
          { type: 'text', text: promptTemplate },
        ],
      },
    ],
  };
}

function determineApiEndpoint(model: string): { hostname: string; path: string } {
  if (model.startsWith('gpt-4') || model.startsWith('gpt-4o')) {
    return { hostname: 'api.openai.com', path: '/v1/chat/completions' };
  }
  if (model.startsWith('claude')) {
    return { hostname: 'api.anthropic.com', path: '/v1/messages' };
  }
  if (model.startsWith('gemini')) {
    return { hostname: 'generativelanguage.googleapis.com', path: '/v1/models/' + model + ':generateContent' };
  }
  // Default to OpenAI-compatible endpoint
  return { hostname: 'api.openai.com', path: '/v1/chat/completions' };
}

function parseVlmResponse(responseBody: any, model: string): {
  caption: string; description: string; detectedObjects: DetectedObject[];
} {
  let textContent = '';

  // Extract text from different API response formats
  if (model.startsWith('claude')) {
    textContent = responseBody?.content?.[0]?.text ?? '';
  } else if (model.startsWith('gemini')) {
    textContent = responseBody?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } else {
    textContent = responseBody?.choices?.[0]?.message?.content ?? '';
  }

  // Parse JSON from the response text (handle markdown code blocks)
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      caption: parsed.caption ?? '',
      description: parsed.description ?? '',
      detectedObjects: (parsed.detected_objects ?? []).map((obj: any) => ({
        label: obj.label ?? 'unknown',
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
        bbox: {
          x: obj.bbox?.x ?? 0,
          y: obj.bbox?.y ?? 0,
          width: obj.bbox?.width ?? 0,
          height: obj.bbox?.height ?? 0,
        },
      })),
    };
  } catch {
    // Fallback: treat entire response as caption
    return {
      caption: textContent.slice(0, 200),
      description: textContent,
      detectedObjects: [],
    };
  }
}

function makeApiRequest(
  hostname: string, path: string, apiKey: string, body: string, model: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(body)),
    };

    if (model.startsWith('claude')) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { reject(new Error('Failed to parse VLM API response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export class VlmCaptionEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const model = config.model ?? 'gpt-4o';
    const apiKey = config.apiKey ?? '';
    const maxTokens = (config.options?.maxTokens as number) ?? 1024;
    const promptTemplate = (config.options?.promptTemplate as string) ?? DEFAULT_CAPTION_PROMPT;

    const { hostname, path } = determineApiEndpoint(model);
    const requestBody = buildVlmRequestBody(item.content, model, maxTokens, promptTemplate);
    const body = JSON.stringify(requestBody);

    const response = await makeApiRequest(hostname, path, apiKey, body, model);
    const { caption, description, detectedObjects } = parseVlmResponse(response, model);

    // Compute aggregate confidence from detected objects
    const objConfidence = detectedObjects.length > 0
      ? detectedObjects.reduce((sum, obj) => sum + obj.confidence, 0) / detectedObjects.length
      : 0.7;

    const overallConfidence = caption ? Math.min(1.0, (objConfidence + 0.8) / 2) : 0.3;

    const tokensUsed = response?.usage?.total_tokens
      ?? response?.usage?.input_tokens + response?.usage?.output_tokens
      ?? Math.ceil(item.content.length / 4) + maxTokens;

    return {
      fields: {
        caption,
        description,
        detected_objects: detectedObjects,
        object_count: detectedObjects.length,
      },
      confidence: overallConfidence,
      metadata: {
        provider: PROVIDER_ID,
        model,
        tokensUsed,
        promptTemplate: promptTemplate.slice(0, 100),
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    const imageSchemas = ['image', 'photo', 'screenshot', 'figure', 'diagram', 'visual'];
    return imageSchemas.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    // Image tokens scale with resolution: ~85 tokens per 512x512 tile
    const imageSizeKb = Buffer.byteLength(item.content, 'base64') / 1024;
    const estimatedTiles = Math.max(1, Math.ceil(imageSizeKb / 100));
    const imageTokens = estimatedTiles * 85;
    const outputTokens = 500;

    return {
      tokens: imageTokens + outputTokens,
      apiCalls: 1,
      durationMs: 3000 + estimatedTiles * 200,
    };
  }
}

export default VlmCaptionEnricherProvider;
