// Clef Data Integration Kit - LLM structured data extraction enricher provider
// Builds prompt with target schema + content, calls LLM API, parses JSON response.
// Config: model, targetSchema, instructions, autoAcceptThreshold.

import * as https from 'https';

export const PROVIDER_ID = 'llm_structured_extract';
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

interface TargetSchemaField {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
}

interface TargetSchema {
  name: string;
  fields: TargetSchemaField[];
}

interface FieldConfidence {
  field: string;
  value: unknown;
  confidence: number;
  source?: string;
}

function buildExtractionPrompt(
  content: string,
  schema: TargetSchema,
  instructions: string,
): string {
  const schemaDescription = schema.fields.map((field) => {
    let desc = `  "${field.name}": ${field.type}`;
    if (field.description) desc += ` // ${field.description}`;
    if (field.required) desc += ' (REQUIRED)';
    if (field.enum) desc += ` (one of: ${field.enum.join(', ')})`;
    return desc;
  }).join('\n');

  const jsonTemplate = '{\n' + schema.fields.map((f) => {
    let defaultVal: string;
    switch (f.type) {
      case 'string': defaultVal = '""'; break;
      case 'number': case 'integer': defaultVal = '0'; break;
      case 'boolean': defaultVal = 'false'; break;
      case 'array': defaultVal = '[]'; break;
      default: defaultVal = 'null'; break;
    }
    return `  "${f.name}": ${defaultVal}`;
  }).join(',\n') + '\n}';

  return `Extract structured data from the following content according to the target schema.

## Target Schema: ${schema.name}
Fields:
${schemaDescription}

## Expected JSON Output Format:
${jsonTemplate}

## Additional Instructions:
${instructions || 'Extract all relevant fields from the content. Use null for fields that cannot be determined.'}

## Important:
- Return ONLY valid JSON matching the schema above.
- For each field, also provide a confidence score (0.0-1.0) in a separate "_confidence" object.
- Your response MUST be valid JSON with two top-level keys: "data" and "_confidence".

Example response format:
{
  "data": { ... extracted fields ... },
  "_confidence": { "field1": 0.95, "field2": 0.7, ... }
}

## Content to Extract From:
${content.slice(0, 12000)}`;
}

function buildApiRequestBody(model: string, prompt: string, maxTokens: number): string {
  if (model.startsWith('claude')) {
    return JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
  }
  return JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: 'You are a precise data extraction assistant. Always respond with valid JSON.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });
}

function getApiEndpoint(model: string): { hostname: string; path: string } {
  if (model.startsWith('claude')) {
    return { hostname: 'api.anthropic.com', path: '/v1/messages' };
  }
  return { hostname: 'api.openai.com', path: '/v1/chat/completions' };
}

function parseExtractedData(
  responseBody: any,
  model: string,
  schema: TargetSchema,
): { data: Record<string, unknown>; confidence: Record<string, number> } {
  // Extract text from API response
  let textContent = '';
  if (model.startsWith('claude')) {
    textContent = responseBody?.content?.[0]?.text ?? '';
  } else {
    textContent = responseBody?.choices?.[0]?.message?.content ?? '';
  }

  // Strip markdown code blocks if present
  let jsonStr = textContent;
  const codeBlockMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle response format with data + _confidence
    if (parsed.data && typeof parsed.data === 'object') {
      const confidence: Record<string, number> = {};
      if (parsed._confidence && typeof parsed._confidence === 'object') {
        for (const [key, val] of Object.entries(parsed._confidence)) {
          confidence[key] = typeof val === 'number' ? val : 0.5;
        }
      }
      return { data: parsed.data, confidence };
    }

    // Fallback: assume flat structure with no confidence scores
    const confidence: Record<string, number> = {};
    for (const field of schema.fields) {
      if (parsed[field.name] !== undefined && parsed[field.name] !== null) {
        confidence[field.name] = 0.7; // Default confidence for present fields
      } else {
        confidence[field.name] = 0;
      }
    }
    return { data: parsed, confidence };
  } catch {
    return { data: {}, confidence: {} };
  }
}

function validateAgainstSchema(
  data: Record<string, unknown>,
  schema: TargetSchema,
): { valid: boolean; errors: string[]; completeness: number } {
  const errors: string[] = [];
  let filledFields = 0;

  for (const field of schema.fields) {
    const value = data[field.name];

    if (field.required && (value === undefined || value === null)) {
      errors.push(`Required field "${field.name}" is missing`);
      continue;
    }

    if (value === undefined || value === null) continue;
    filledFields++;

    // Type validation
    if (field.type === 'string' && typeof value !== 'string') {
      errors.push(`Field "${field.name}" should be string, got ${typeof value}`);
    } else if ((field.type === 'number' || field.type === 'integer') && typeof value !== 'number') {
      errors.push(`Field "${field.name}" should be ${field.type}, got ${typeof value}`);
    } else if (field.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field "${field.name}" should be boolean, got ${typeof value}`);
    } else if (field.type === 'array' && !Array.isArray(value)) {
      errors.push(`Field "${field.name}" should be array, got ${typeof value}`);
    }

    // Enum validation
    if (field.enum && !field.enum.includes(String(value))) {
      errors.push(`Field "${field.name}" value "${value}" not in allowed values`);
    }
  }

  const completeness = schema.fields.length > 0 ? filledFields / schema.fields.length : 0;
  return { valid: errors.length === 0, errors, completeness };
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
        catch { reject(new Error('Failed to parse API response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export class LlmStructuredExtractEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const model = config.model ?? 'gpt-4o-mini';
    const apiKey = config.apiKey ?? '';
    const targetSchema = (config.options?.targetSchema as TargetSchema) ?? {
      name: 'generic',
      fields: [{ name: 'summary', type: 'string' }, { name: 'entities', type: 'array' }],
    };
    const instructions = (config.options?.instructions as string) ?? '';
    const autoAcceptThreshold = (config.options?.autoAcceptThreshold as number) ?? 0.8;
    const maxTokens = (config.options?.maxTokens as number) ?? 2000;

    // Build extraction prompt
    const prompt = buildExtractionPrompt(item.content, targetSchema, instructions);

    // Call LLM API
    const { hostname, path } = getApiEndpoint(model);
    const body = buildApiRequestBody(model, prompt, maxTokens);
    const response = await makeApiRequest(hostname, path, apiKey, body, model);

    // Parse extraction results
    const { data, confidence } = parseExtractedData(response, model, targetSchema);

    // Validate against schema
    const validation = validateAgainstSchema(data, targetSchema);

    // Compute per-field results with confidence
    const fieldResults: FieldConfidence[] = targetSchema.fields.map((field) => ({
      field: field.name,
      value: data[field.name] ?? null,
      confidence: confidence[field.name] ?? 0,
      source: data[field.name] != null ? 'extracted' : 'missing',
    }));

    // Overall confidence from per-field confidence average + validation
    const avgFieldConfidence = fieldResults.length > 0
      ? fieldResults.reduce((sum, f) => sum + f.confidence, 0) / fieldResults.length
      : 0;
    const overallConfidence = avgFieldConfidence * (validation.valid ? 1.0 : 0.7) * validation.completeness;

    // Determine auto-accept status
    const autoAccepted = overallConfidence >= autoAcceptThreshold;

    const tokensUsed = response?.usage?.total_tokens
      ?? (response?.usage?.input_tokens ?? 0) + (response?.usage?.output_tokens ?? 0);

    return {
      fields: {
        extracted: data,
        field_confidence: confidence,
        field_results: fieldResults,
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          completeness: Math.round(validation.completeness * 100) / 100,
        },
        auto_accepted: autoAccepted,
      },
      confidence: Math.round(overallConfidence * 1000) / 1000,
      metadata: {
        provider: PROVIDER_ID,
        model,
        schemaName: targetSchema.name,
        fieldCount: targetSchema.fields.length,
        autoAcceptThreshold,
        tokensUsed,
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    // LLM structured extraction applies to any content type
    return true;
  }

  costEstimate(item: ContentItem): CostEstimate {
    const wordCount = item.content.split(/\s+/).length;
    const inputTokens = Math.ceil(wordCount * 1.3) + 500; // Content + prompt overhead
    const outputTokens = 1000;

    return {
      tokens: inputTokens + outputTokens,
      apiCalls: 1,
      durationMs: 2000 + Math.ceil(inputTokens / 100),
    };
  }
}

export default LlmStructuredExtractEnricherProvider;
