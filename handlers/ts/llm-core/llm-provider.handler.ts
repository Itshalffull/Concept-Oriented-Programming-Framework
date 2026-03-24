// @clef-handler style=functional
// LLMProvider Concept Implementation
// Atomic gateway to any large language model. Wraps provider-specific APIs
// behind a uniform interface for completion, streaming, embedding, and token counting.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `llm-provider-${++idCounter}`;
}

const KNOWN_MODELS = new Set([
  'gpt-4', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo',
  'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5-sonnet', 'claude-4-opus',
  'gemini-pro', 'gemini-ultra',
  'llama-3', 'llama-3.1', 'mistral-large', 'mistral-medium',
  'command-r', 'command-r-plus',
]);

const VALID_CAPABILITIES = new Set([
  'chat', 'completion', 'embedding', 'vision', 'tool_calling', 'structured_output', 'streaming',
]);

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'LLMProvider' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const providerId = input.provider_id as string;
    const modelId = input.model_id as string;
    const credentials = input.credentials as string;
    const config = input.config as Record<string, unknown>;
    const capabilities = input.capabilities as string[];

    // Validate inputs
    if (!providerId || providerId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'provider_id is required' }) as StorageProgram<Result>;
    }
    if (!modelId || !KNOWN_MODELS.has(modelId)) {
      return complete(createProgram(), 'invalid', { message: `Model ID '${modelId}' not recognized` }) as StorageProgram<Result>;
    }
    if (!credentials) {
      return complete(createProgram(), 'invalid', { message: 'Credentials fail validation' }) as StorageProgram<Result>;
    }
    if (capabilities) {
      for (const cap of capabilities) {
        if (!VALID_CAPABILITIES.has(cap)) {
          return complete(createProgram(), 'invalid', { message: `Unknown capability: ${cap}` }) as StorageProgram<Result>;
        }
      }
    }

    const id = nextId();
    const defaultConfig = config || { temperature: 0.7, top_p: 1.0, max_tokens: 4096, stop_sequences: [] };

    let p = createProgram();
    p = put(p, 'provider', id, {
      id,
      provider_id: providerId,
      model_id: modelId,
      api_credentials: credentials,
      default_config: defaultConfig,
      capabilities: capabilities || [],
      pricing: { input_cost_per_token: 0.0, output_cost_per_token: 0.0, cached_cost_per_token: null },
      rate_limits: { requests_per_minute: 60, tokens_per_minute: 100000 },
      status: 'available',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { provider: id }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const messages = input.messages as Array<{ role: string; content: string }>;
    const config = input.config as Record<string, unknown> | null;

    if (!provider) {
      return complete(createProgram(), 'unavailable', { message: 'Provider ID is required' }) as StorageProgram<Result>;
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return complete(createProgram(), 'unavailable', { message: 'Messages are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'unavailable', { message: 'Provider not registered' }),
      (() => {
        let b = createProgram();
        b = get(b, 'provider', provider, 'prov');
        return completeFrom(b, 'ok', (bindings) => {
          const prov = bindings.prov as Record<string, unknown>;
          const pricing = prov.pricing as Record<string, unknown>;
          const promptTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
          const completionTokens = Math.ceil(promptTokens * 0.5);
          const inputCost = (pricing.input_cost_per_token as number) * promptTokens;
          const outputCost = (pricing.output_cost_per_token as number) * completionTokens;

          return {
            content: `Generated response for ${messages.length} messages`,
            model: prov.model_id as string,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            finish_reason: 'stop',
            cost: inputCost + outputCost,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  stream(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const messages = input.messages as Array<{ role: string; content: string }>;

    if (!provider) {
      return complete(createProgram(), 'unavailable', { message: 'Provider ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'unavailable', { message: 'Provider unreachable' }),
      (() => {
        const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return complete(createProgram(), 'ok', { stream_id: streamId });
      })(),
    ) as StorageProgram<Result>;
  },

  embed(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const texts = input.texts as string[];

    if (!provider) {
      return complete(createProgram(), 'error', { message: 'Provider ID is required' }) as StorageProgram<Result>;
    }
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return complete(createProgram(), 'error', { message: 'Texts are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Embedding model unavailable' }),
      (() => {
        const dimensions = 1536;
        const vectors = texts.map(() => ({
          vector: Array.from({ length: dimensions }, () => Math.random() * 2 - 1),
          dimensions,
        }));
        return complete(createProgram(), 'ok', { vectors });
      })(),
    ) as StorageProgram<Result>;
  },

  countTokens(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const content = input.content as string;

    if (!provider) {
      return complete(createProgram(), 'error', { message: 'Provider ID is required' }) as StorageProgram<Result>;
    }
    if (!content) {
      return complete(createProgram(), 'error', { message: 'Content is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Tokenizer unavailable for this provider' }),
      (() => {
        // Approximate BPE token count: ~4 chars per token
        const count = Math.ceil(content.length / 4);
        return complete(createProgram(), 'ok', { count, tokenizer: 'approximate_bpe' });
      })(),
    ) as StorageProgram<Result>;
  },

  healthCheck(input: Record<string, unknown>) {
    const provider = input.provider as string;

    if (!provider) {
      return complete(createProgram(), 'unavailable', { message: 'Provider ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'unavailable', { message: 'Not responding' }),
      (() => {
        const latencyMs = Math.floor(Math.random() * 100) + 10;
        let b = createProgram();
        b = get(b, 'provider', provider, 'prov');
        b = putFrom(b, 'provider', provider, (bindings) => {
          const prov = bindings.prov as Record<string, unknown>;
          return { ...prov, status: 'available' };
        });
        return complete(b, 'ok', { status: 'available', latency_ms: latencyMs });
      })(),
    ) as StorageProgram<Result>;
  },

  updateConfig(input: Record<string, unknown>) {
    const provider = input.provider as string;
    const config = input.config as Record<string, unknown>;

    if (!provider) {
      return complete(createProgram(), 'notfound', { message: 'Provider not registered' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', provider, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Provider not registered' }),
      (() => {
        let b = createProgram();
        b = get(b, 'provider', provider, 'prov');
        b = putFrom(b, 'provider', provider, (bindings) => {
          const prov = bindings.prov as Record<string, unknown>;
          return { ...prov, default_config: config };
        });
        return complete(b, 'ok', { provider });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const llmProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetLLMProvider(): void {
  idCounter = 0;
}
