// @clef-handler style=functional concept=LlmJudgeCheckEvaluatorProvider
// ============================================================
// LlmJudgeCheckEvaluatorProvider Handler
//
// Sends evaluation criteria and the step/process output to an LLM
// for judgment, then interprets the response as a pass/fail score.
// Registers with PluginRegistry as a check-evaluator provider
// under name "llm-judge".
//
// Config JSON shape:
//   {
//     criteria: string,          // The evaluation criteria / rubric
//     output: string,            // The step output to judge
//     model?: string,            // LLM model name (default: provider's default)
//     endpoint?: string,         // Named LLM endpoint (resolved via EffectHandler)
//     scoreKey?: string,         // JSON key in LLM response containing 0–1 score
//     passingThreshold?: number  // Minimum score to be "passing" (default: 0.7)
//   }
//
// Uses perform() to route the LLM call through the EffectHandler.
// The execution layer handles auth, retries, model selection, and
// full observability (LlmTrace, PerformanceProfile, ErrorCorrelation).
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, perform, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'LlmJudgeCheckEvaluatorProvider';
const EVALUATOR_KIND = 'llm-judge';
const DEFAULT_ENDPOINT = 'llm-provider';
const DEFAULT_PASSING_THRESHOLD = 0.7;

// ──────────────────────────────────────────────────────────────
// LLM response parsing
// ──────────────────────────────────────────────────────────────

/**
 * Extract a numeric score from an LLM response text.
 *
 * Tries the following strategies in order:
 * 1. If scoreKey is specified, look up that key in a JSON response object
 * 2. Parse the whole response as JSON and look for a "score"/"rating"/"verdict" key
 * 3. Extract the first number in [0, 1] range from the text
 * 4. Look for keywords: "pass"/"yes"/"approve" → 1.0, "fail"/"no"/"reject" → 0.0
 * 5. Fallback: return 0.5 (ambiguous)
 */
function extractScore(responseText: string, scoreKey?: string): { score: number; method: string } {
  const trimmed = responseText.trim();

  // Strategy 1: JSON with scoreKey
  if (scoreKey) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed[scoreKey] === 'number') {
        return { score: Math.min(1, Math.max(0, parsed[scoreKey] as number)), method: `json.${scoreKey}` };
      }
    } catch {
      // Not JSON — continue
    }
  }

  // Strategy 2: JSON with default "score"/"rating"/"verdict" key
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.score === 'number') {
      return { score: Math.min(1, Math.max(0, parsed.score as number)), method: 'json.score' };
    }
    if (parsed && typeof parsed.rating === 'number') {
      return { score: Math.min(1, Math.max(0, parsed.rating as number)), method: 'json.rating' };
    }
    if (parsed && typeof parsed.verdict === 'string') {
      const verdict = (parsed.verdict as string).toLowerCase();
      const score = (verdict === 'pass' || verdict === 'yes' || verdict === 'approve') ? 1.0 : 0.0;
      return { score, method: 'json.verdict' };
    }
  } catch {
    // Not JSON — continue
  }

  // Strategy 3: Extract first decimal/integer in [0, 1] range from the text
  const numMatches = trimmed.match(/\b(0(?:\.\d+)?|1(?:\.0+)?)\b/g);
  if (numMatches) {
    const candidates = numMatches.map(Number).filter(n => n >= 0 && n <= 1);
    if (candidates.length > 0) {
      return { score: candidates[0], method: 'text-number' };
    }
  }

  // Strategy 4: Keyword matching
  const lower = trimmed.toLowerCase();
  if (/\b(pass|yes|approved|approve|correct|excellent|good)\b/.test(lower)) {
    return { score: 1.0, method: 'keyword-positive' };
  }
  if (/\b(fail|no|rejected|reject|incorrect|poor|bad)\b/.test(lower)) {
    return { score: 0.0, method: 'keyword-negative' };
  }

  // Fallback: ambiguous response — treat as partial credit
  return { score: 0.5, method: 'fallback-ambiguous' };
}

// ──────────────────────────────────────────────────────────────
// Prompt construction
// ──────────────────────────────────────────────────────────────

function buildJudgmentPrompt(criteria: string, output: string): string {
  return [
    'You are a quality evaluator. Assess the following output against the provided criteria.',
    '',
    '## Evaluation Criteria',
    criteria,
    '',
    '## Output to Evaluate',
    output,
    '',
    '## Instructions',
    'Respond with a JSON object containing:',
    '  { "score": <number from 0 to 1>, "verdict": "pass" | "fail", "reasoning": "<brief explanation>" }',
    '',
    'A score of 1.0 means the output fully meets the criteria. 0.0 means it does not meet them at all.',
    'Be concise in your reasoning (1-2 sentences).',
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: PROVIDER_NAME,
      kind: EVALUATOR_KIND,
    }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const cv = (input.cv as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    if (!cv || cv.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'cv is required' }) as StorageProgram<Result>;
    }

    if (!configRaw || configRaw.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let config: {
      criteria?: string;
      output?: string;
      model?: string;
      endpoint?: string;
      scoreKey?: string;
      passingThreshold?: number;
    };
    try {
      config = JSON.parse(configRaw);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'config must be valid JSON' }) as StorageProgram<Result>;
    }

    if (!config.criteria || config.criteria.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config.criteria is required' }) as StorageProgram<Result>;
    }

    if (!config.output || config.output.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config.output is required' }) as StorageProgram<Result>;
    }

    const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    const passingThreshold = config.passingThreshold ?? DEFAULT_PASSING_THRESHOLD;
    const scoreKey = config.scoreKey;
    const criteria = config.criteria;
    const outputText = config.output;
    const model = config.model;
    const prompt = buildJudgmentPrompt(criteria, outputText);

    // Use perform() to declare the LLM transport effect.
    // The EffectHandler routes this to an LLM provider (OpenAI, Anthropic, etc.)
    // which handles auth, retries, model selection, and token budgeting.
    let p = createProgram();
    p = perform(p, 'http', 'POST', {
      endpoint,
      path: '/generate',
      body: {
        prompt,
        model,
        format: 'json',
        maxTokens: 256,
      },
    }, '_llmResponse');

    // Derive evaluation result from the LLM response binding
    p = mapBindings(p, (bindings) => {
      const llmResult = bindings._llmResponse as Record<string, unknown> | null;
      if (!llmResult) return { _evalError: 'LLM call returned no response' };

      const responseText = (llmResult.text as string) ??
        (llmResult.content as string) ??
        (llmResult.body as string) ?? '';

      if (!responseText) return { _evalError: 'LLM returned empty response' };

      let extracted: { score: number; method: string };
      try {
        extracted = extractScore(responseText, scoreKey);
      } catch (err) {
        return { _evalError: `Failed to parse LLM response: ${String(err)}` };
      }

      const passed = extracted.score >= passingThreshold;
      const status = passed ? 'passing' : 'failing';

      const evidence = JSON.stringify({
        criteria,
        score: extracted.score,
        scoreMethod: extracted.method,
        passingThreshold,
        llmResponse: responseText.slice(0, 500), // truncate for storage
        model: model ?? 'default',
      });

      return { _score: extracted.score, _evidence: evidence, _status: status };
    }, '_evalResult');

    return completeFrom(p, 'ok', (bindings) => {
      const evalResult = bindings._evalResult as Record<string, unknown>;
      if (evalResult._evalError) {
        return {
          score: 0,
          evidence: JSON.stringify({ error: evalResult._evalError }),
          status: 'error',
        };
      }
      return {
        score: evalResult._score as number,
        evidence: evalResult._evidence as string,
        status: evalResult._status as string,
      };
    }) as StorageProgram<Result>;
  },
};

export const llmJudgeCheckEvaluatorHandler = autoInterpret(_handler);

export default llmJudgeCheckEvaluatorHandler;
