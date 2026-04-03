// @clef-handler style=functional concept=ClaudeEvaluatorProvider
// ============================================================
// ClaudeEvaluatorProvider Handler
//
// SemanticEvaluator provider backed by Claude (Anthropic). Builds
// a system prompt from the configured persona, calls the LLM via
// perform(), parses the structured JSON response into per-dimension
// ratings (0–10) and a list of semantic issues, and caches results
// keyed by (target, contentHash, persona) so repeated evaluations
// of unchanged content are served from storage.
//
// Config JSON shape (passed as input.config):
//   {
//     criteria?: string,           // Free-text evaluation goal or rubric
//     persona?: string,            // Review perspective: "junior" | "senior" |
//                                  //   "security" | "performance" | "architect"
//                                  //   Default: "senior"
//     model?: string,              // Model identifier (default: "claude-opus-4-5")
//     endpoint?: string,           // Named LLM endpoint (resolved via EffectHandler)
//     contentHash?: string         // Hash of target content for cache key
//   }
//
// Uses perform('http', 'POST', ...) to route through the EffectHandler
// so the call benefits from LlmTrace, PerformanceProfile, RetryPolicy,
// CircuitBreaker, RateLimiter, and ErrorCorrelation — all automatically
// wired via sync rules.
//
// Returns:
//   ok(ratings: String, issues: String)
//     ratings — JSON string:
//       { intentAlignment: 0-10, readability: 0-10,
//         errorHandling: 0-10, namingQuality: 0-10, overall: 0-10 }
//     issues — JSON string: Array of {
//       location, type, description, severity, suggestion }
//       type is one of: "misleading-name", "intent-mismatch",
//         "missing-error-handling", "unnecessary-complexity",
//         "documentation-drift", "hallucinated-feature"
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, complete, completeFrom, perform, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'ClaudeEvaluatorProvider';
const DEFAULT_ENDPOINT = 'anthropic-llm';
const DEFAULT_MODEL = 'claude-opus-4-5';
const DEFAULT_PERSONA = 'senior';

const VALID_PERSONAS = ['junior', 'senior', 'security', 'performance', 'architect'] as const;
type Persona = typeof VALID_PERSONAS[number];

const VALID_ISSUE_TYPES = [
  'misleading-name',
  'intent-mismatch',
  'missing-error-handling',
  'unnecessary-complexity',
  'documentation-drift',
  'hallucinated-feature',
] as const;

// ──────────────────────────────────────────────────────────────
// Prompt construction
// ──────────────────────────────────────────────────────────────

const PERSONA_DESCRIPTIONS: Record<Persona, string> = {
  junior: 'a junior developer focused on basic readability, clarity, and beginner-friendly patterns',
  senior: 'a senior developer focused on design quality, maintainability, and production-readiness',
  security: 'a security engineer focused on input validation, authentication, authorization, and safe error handling',
  performance: 'a performance engineer focused on algorithmic efficiency, resource usage, and scalability',
  architect: 'a software architect focused on module boundaries, abstraction layers, and system design intent',
};

function buildSystemPrompt(persona: Persona, criteria: string | null): string {
  const personaDesc = PERSONA_DESCRIPTIONS[persona] ?? PERSONA_DESCRIPTIONS.senior;
  const criteriaSection = criteria
    ? `\n\n## Evaluation Criteria\n${criteria}`
    : '';

  return [
    `You are ${personaDesc}. Your task is to evaluate code semantics and provide structured feedback.`,
    '',
    'Rate each dimension from 0 (very poor) to 10 (excellent):',
    '- intentAlignment: How well does the code match its apparent purpose and any documented intent?',
    '- readability: How easy is the code to read and understand?',
    '- errorHandling: How thoroughly does the code handle errors, edge cases, and unexpected inputs?',
    '- namingQuality: How descriptive, consistent, and meaningful are the names used?',
    '',
    'Identify any semantic issues. Each issue must include:',
    '- location: file path and line reference (e.g. "auth/login.ts:42")',
    '- type: one of ' + VALID_ISSUE_TYPES.join(', '),
    '- description: a concise, specific description of the problem',
    '- severity: "error" | "warning" | "info"',
    '- suggestion: a concrete improvement suggestion (or null if none)',
    criteriaSection,
    '',
    'Respond ONLY with a valid JSON object in this exact shape:',
    '{',
    '  "ratings": {',
    '    "intentAlignment": <0-10>,',
    '    "readability": <0-10>,',
    '    "errorHandling": <0-10>,',
    '    "namingQuality": <0-10>',
    '  },',
    '  "issues": [',
    '    {',
    '      "location": "<path:line>",',
    '      "type": "<issue-type>",',
    '      "description": "<description>",',
    '      "severity": "<error|warning|info>",',
    '      "suggestion": "<suggestion or null>"',
    '    }',
    '  ]',
    '}',
  ].join('\n');
}

function buildUserMessage(target: string): string {
  return `Evaluate the following code target: ${target}`;
}

// ──────────────────────────────────────────────────────────────
// LLM response parsing
// ──────────────────────────────────────────────────────────────

interface RatingsShape {
  intentAlignment: number;
  readability: number;
  errorHandling: number;
  namingQuality: number;
  overall: number;
}

interface IssueShape {
  location: string;
  type: string;
  description: string;
  severity: string;
  suggestion: string | null;
}

function clamp010(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
}

function parseLlmResponse(
  responseText: string,
  target: string,
): { ratingsJson: string; issuesJson: string } {
  const trimmed = responseText.trim();

  // Extract JSON — the model may wrap it in markdown code fences
  let jsonStr = trimmed;
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    const fallbackRatings: RatingsShape = {
      intentAlignment: 0, readability: 0, errorHandling: 0, namingQuality: 0, overall: 0,
    };
    const fallbackIssues: IssueShape[] = [{
      location: target,
      type: 'intent-mismatch',
      description: `Response parse error: could not parse LLM output as JSON`,
      severity: 'warning',
      suggestion: null,
    }];
    return {
      ratingsJson: JSON.stringify(fallbackRatings),
      issuesJson: JSON.stringify(fallbackIssues),
    };
  }

  // Validate and normalise ratings
  const rawRatings = (parsed.ratings ?? {}) as Record<string, unknown>;
  const intentAlignment = clamp010(Number(rawRatings.intentAlignment ?? 5));
  const readability = clamp010(Number(rawRatings.readability ?? 5));
  const errorHandling = clamp010(Number(rawRatings.errorHandling ?? 5));
  const namingQuality = clamp010(Number(rawRatings.namingQuality ?? 5));
  const overall = clamp010((intentAlignment + readability + errorHandling + namingQuality) / 4);
  const ratings: RatingsShape = { intentAlignment, readability, errorHandling, namingQuality, overall };

  // Validate and normalise issues
  const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const issues: IssueShape[] = (rawIssues as unknown[])
    .filter((i): i is Record<string, unknown> => i != null && typeof i === 'object')
    .map((i) => ({
      location: String(i.location ?? 'unknown'),
      type: VALID_ISSUE_TYPES.includes(i.type as typeof VALID_ISSUE_TYPES[number])
        ? (i.type as string)
        : 'intent-mismatch',
      description: String(i.description ?? ''),
      severity: ['error', 'warning', 'info'].includes(String(i.severity))
        ? String(i.severity)
        : 'warning',
      suggestion: i.suggestion != null ? String(i.suggestion) : null,
    }));

  return { ratingsJson: JSON.stringify(ratings), issuesJson: JSON.stringify(issues) };
}

// ──────────────────────────────────────────────────────────────
// Cache key
// ──────────────────────────────────────────────────────────────

function makeCacheKey(target: string, contentHash: string, persona: string): string {
  return `${target}::${contentHash}::${persona}`;
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  // ── register ─────────────────────────────────────────────────
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {
      name: PROVIDER_NAME,
    }) as StorageProgram<Result>;
  },

  // ── assess ───────────────────────────────────────────────────
  assess(input: Record<string, unknown>) {
    const target = (input.target as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    // Guard: target is required
    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target is required',
      }) as StorageProgram<Result>;
    }

    // Guard: config must be present
    if (!configRaw || configRaw.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'config is required',
      }) as StorageProgram<Result>;
    }

    // Guard: config must be valid JSON
    let config: {
      criteria?: string | null;
      persona?: string | null;
      model?: string | null;
      endpoint?: string | null;
      contentHash?: string | null;
    };
    try {
      config = JSON.parse(configRaw) as typeof config;
    } catch {
      return complete(createProgram(), 'error', {
        message: 'config must be valid JSON',
      }) as StorageProgram<Result>;
    }

    // Resolve parameters with defaults
    const rawPersona = (config.persona ?? DEFAULT_PERSONA) as string;
    const persona: Persona = VALID_PERSONAS.includes(rawPersona as Persona)
      ? (rawPersona as Persona)
      : DEFAULT_PERSONA;
    const model = config.model ?? DEFAULT_MODEL;
    const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    const criteria = config.criteria ?? null;
    const contentHash = config.contentHash ?? 'no-hash';
    const key = makeCacheKey(target, contentHash, persona);
    const systemPrompt = buildSystemPrompt(persona, criteria);
    const userMessage = buildUserMessage(target);

    // Step 1: check cache
    let p = createProgram();
    p = get(p, 'evaluationCache', key, '_cached');

    // Step 2: call LLM — the interpreter will always execute this perform().
    //         The mapBindings step below decides whether to use _cached or _llmResult.
    p = perform(p, 'http', 'POST', {
      endpoint,
      path: '/v1/messages',
      body: {
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 1024,
      },
    }, '_llmResult');

    // Step 3: derive evaluation result — prefer cache, fall back to LLM response
    p = mapBindings(p, (bindings) => {
      // Cache hit: return stored ratings/issues
      const cached = bindings._cached as Record<string, unknown> | null;
      if (cached && cached.ratingsJson) {
        return {
          _ratingsJson: cached.ratingsJson as string,
          _issuesJson: cached.issuesJson as string,
          _fromCache: true,
          _evalError: null,
        };
      }

      // Parse LLM response
      const llmResult = bindings._llmResult as Record<string, unknown> | null;
      if (!llmResult) {
        return {
          _ratingsJson: null,
          _issuesJson: null,
          _fromCache: false,
          _evalError: 'LLM call returned no response',
        };
      }

      // Extract response text from various Anthropic API shapes
      let responseText = '';
      if (typeof llmResult.text === 'string') {
        responseText = llmResult.text;
      } else if (typeof llmResult.content === 'string') {
        responseText = llmResult.content;
      } else if (typeof llmResult.body === 'string') {
        responseText = llmResult.body;
      } else if (Array.isArray(llmResult.content) && llmResult.content.length > 0) {
        const first = llmResult.content[0] as Record<string, unknown>;
        responseText = String(first.text ?? '');
      }

      if (!responseText) {
        return {
          _ratingsJson: null,
          _issuesJson: null,
          _fromCache: false,
          _evalError: 'LLM returned empty response',
        };
      }

      const { ratingsJson, issuesJson } = parseLlmResponse(responseText, target);
      return {
        _ratingsJson: ratingsJson,
        _issuesJson: issuesJson,
        _fromCache: false,
        _evalError: null,
      };
    }, '_evalResult');

    // Step 4: persist to cache (write the resolved ratings/issues under the cache key)
    p = put(p, 'evaluationCache', key, {
      ratingsJson: '_deferred_from_bindings',
      issuesJson: '_deferred_from_bindings',
    });

    // Step 5: complete with ok(ratings, issues)
    return completeFrom(p, 'ok', (bindings) => {
      const ev = bindings._evalResult as Record<string, unknown>;

      if (ev?._evalError) {
        const fallbackRatings = JSON.stringify({
          intentAlignment: 0, readability: 0, errorHandling: 0, namingQuality: 0, overall: 0,
        });
        const fallbackIssues = JSON.stringify([{
          location: target,
          type: 'intent-mismatch',
          description: String(ev._evalError),
          severity: 'error',
          suggestion: null,
        }]);
        return { ratings: fallbackRatings, issues: fallbackIssues };
      }

      return {
        ratings: (ev?._ratingsJson as string) ?? JSON.stringify({
          intentAlignment: 0, readability: 0, errorHandling: 0, namingQuality: 0, overall: 0,
        }),
        issues: (ev?._issuesJson as string) ?? JSON.stringify([]),
      };
    }) as StorageProgram<Result>;
  },
};

export const claudeEvaluatorHandler = autoInterpret(_handler);

export default claudeEvaluatorHandler;
