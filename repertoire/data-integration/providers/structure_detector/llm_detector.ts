// LLM-based structure detector — uses language model API for arbitrary structure detection
// Builds prompts from content + hint, parses structured JSON response from LLM

export const PROVIDER_ID = 'llm_detector';
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

interface LlmConfig {
  hint?: string;
  model?: string;
  maxTokens?: number;
  apiEndpoint?: string;
  apiKey?: string;
  temperature?: number;
}

interface LlmResponse {
  detections: Array<{
    field: string;
    value: unknown;
    type: string;
    confidence?: number;
    evidence?: string;
  }>;
}

function buildPrompt(content: string, hint: string | undefined): string {
  const systemInstruction = [
    'You are a structure detection assistant. Analyze the following content and extract structured data.',
    'Return a JSON object with a "detections" array. Each detection must have:',
    '  - "field": string (the name of the detected structure)',
    '  - "value": any (the extracted value)',
    '  - "type": string (the data type)',
    '  - "confidence": number between 0 and 1',
    '  - "evidence": string (the text that supports this detection)',
    '',
    'Return ONLY valid JSON, no markdown or explanation.',
  ].join('\n');

  const hintSection = hint
    ? `\n\nDetection hint: ${hint}\nFocus your analysis on finding structures related to this hint.`
    : '';

  const contentSection = content.length > 4000
    ? content.slice(0, 4000) + '\n... [truncated]'
    : content;

  return `${systemInstruction}${hintSection}\n\nContent to analyze:\n---\n${contentSection}\n---`;
}

function parseJsonResponse(responseText: string): LlmResponse | null {
  // Try direct parse
  try {
    const parsed = JSON.parse(responseText);
    if (parsed && Array.isArray(parsed.detections)) return parsed;
  } catch { /* continue */ }

  // Try extracting JSON from markdown code block
  const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed && Array.isArray(parsed.detections)) return parsed;
    } catch { /* continue */ }
  }

  // Try finding JSON object in response
  const jsonMatch = responseText.match(/\{[\s\S]*"detections"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && Array.isArray(parsed.detections)) return parsed;
    } catch { /* continue */ }
  }

  return null;
}

async function callLlmApi(
  prompt: string,
  config: LlmConfig
): Promise<string> {
  const endpoint = config.apiEndpoint ?? 'https://api.openai.com/v1/chat/completions';
  const model = config.model ?? 'gpt-4o-mini';
  const maxTokens = config.maxTokens ?? 2000;
  const temperature = config.temperature ?? 0.1;

  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
    response_format: { type: 'json_object' },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey ?? ''}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

export class LlmDetectorProvider {
  /**
   * Synchronous detect for interface compatibility.
   * For actual LLM calls, use detectAsync which returns a Promise.
   * This method returns an empty array - consumers should use detectAsync.
   */
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    // Synchronous fallback: return empty. Use detectAsync for real LLM calls.
    return [];
  }

  /**
   * Async detection using LLM API. This is the primary method for this provider.
   */
  async detectAsync(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Promise<Detection[]> {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const threshold = config.confidenceThreshold ?? 0.5;
    const llmConfig = (config.options ?? {}) as LlmConfig;

    if (!llmConfig.apiKey && !llmConfig.apiEndpoint) {
      return [{
        field: 'error',
        value: 'No API key or endpoint configured for LLM detector',
        type: 'error',
        confidence: 1.0,
        evidence: 'Missing config.options.apiKey or config.options.apiEndpoint',
      }];
    }

    const prompt = buildPrompt(text, llmConfig.hint);

    try {
      const responseText = await callLlmApi(prompt, llmConfig);
      const parsed = parseJsonResponse(responseText);

      if (!parsed) {
        return [{
          field: 'error',
          value: 'Failed to parse LLM response as structured JSON',
          type: 'parse_error',
          confidence: 1.0,
          evidence: responseText.slice(0, 200),
        }];
      }

      return parsed.detections
        .filter(d => (d.confidence ?? 0.5) >= threshold)
        .map(d => ({
          field: d.field ?? 'unknown',
          value: d.value,
          type: d.type ?? 'unknown',
          confidence: Math.min(d.confidence ?? 0.5, 0.95), // cap LLM confidence
          evidence: d.evidence ?? 'Detected by LLM',
        }));
    } catch (error) {
      return [{
        field: 'error',
        value: error instanceof Error ? error.message : String(error),
        type: 'api_error',
        confidence: 1.0,
        evidence: 'LLM API call failed',
      }];
    }
  }

  appliesTo(contentType: string): boolean {
    // LLM detector can handle any content type
    return true;
  }
}

export default LlmDetectorProvider;
