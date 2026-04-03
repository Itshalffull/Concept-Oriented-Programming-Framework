// @clef-handler style=functional concept=ApiCallCheckEvaluatorProvider
// ============================================================
// ApiCallCheckEvaluatorProvider Handler
//
// Calls an external API endpoint and checks the response status/body
// to produce a pass/fail score. Registers with PluginRegistry as a
// check-evaluator provider under name "api-call".
//
// Config JSON shape:
//   {
//     endpoint: string,                  // Named endpoint (resolved via EffectHandler)
//     path: string,                      // URL path
//     method?: "GET" | "POST" | "PUT",   // HTTP method (default: GET)
//     body?: Record<string, unknown>,    // Request body (for POST/PUT)
//     headers?: Record<string, string>,  // Additional headers
//     expectStatus?: number,             // Expected HTTP status code (default: 200)
//     expectBodyPath?: string,           // JSONPath-like dotted path in response body
//     expectBodyValue?: unknown          // Expected value at bodyPath
//   }
//
// Uses perform() to route the HTTP call through the EffectHandler so
// it benefits from ConnectorCall tracking, RetryPolicy, CircuitBreaker,
// RateLimiter, and PerformanceProfile — all automatically via sync wiring.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, perform, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'ApiCallCheckEvaluatorProvider';
const EVALUATOR_KIND = 'api-call';

// ──────────────────────────────────────────────────────────────
// Response body path resolution
// ──────────────────────────────────────────────────────────────

/**
 * Walk a dotted path (e.g., "data.status.code") into a nested object.
 * Returns undefined if any segment is missing.
 */
function resolvePath(obj: unknown, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
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
      endpoint?: string;
      path?: string;
      method?: string;
      body?: Record<string, unknown>;
      headers?: Record<string, string>;
      expectStatus?: number;
      expectBodyPath?: string;
      expectBodyValue?: unknown;
    };
    try {
      config = JSON.parse(configRaw);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'config must be valid JSON' }) as StorageProgram<Result>;
    }

    if (!config.endpoint || config.endpoint.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config.endpoint is required' }) as StorageProgram<Result>;
    }

    if (!config.path || config.path.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config.path is required' }) as StorageProgram<Result>;
    }

    const method = (config.method ?? 'GET').toUpperCase();
    const expectStatus = config.expectStatus ?? 200;
    const expectBodyPath = config.expectBodyPath;
    const expectBodyValue = config.expectBodyValue;

    // Use perform() to declare the HTTP transport effect.
    // The EffectHandler resolves the endpoint name to an actual URL and
    // executes the call with all observability middleware applied.
    let p = createProgram();
    p = perform(p, 'http', method, {
      endpoint: config.endpoint,
      path: config.path,
      body: config.body,
      headers: config.headers,
    }, '_apiResponse');

    // Derive evaluation result from the bound response using mapBindings,
    // then complete with the computed score/evidence/status.
    p = mapBindings(p, (bindings) => {
      const response = bindings._apiResponse as Record<string, unknown> | null;
      if (!response) return { _evalError: 'API call returned no response' };

      const statusCode = (response.status as number) ?? 0;
      const responseBody = response.body;

      const statusPassed = statusCode === expectStatus;

      let bodyPassed = true;
      let bodyActual: unknown = undefined;
      if (expectBodyPath) {
        bodyActual = resolvePath(responseBody, expectBodyPath);
        bodyPassed = String(bodyActual) === String(expectBodyValue);
      }

      const passed = statusPassed && bodyPassed;
      const score = passed ? 1.0 : (statusPassed ? 0.5 : 0.0);
      const status = passed ? 'passing' : 'failing';

      const evidence = JSON.stringify({
        statusCode,
        expectStatus,
        statusPassed,
        ...(expectBodyPath ? { bodyPath: expectBodyPath, bodyActual, bodyExpected: expectBodyValue, bodyPassed } : {}),
        score,
      });

      return { _score: score, _evidence: evidence, _status: status };
    }, '_evalResult');

    return completeFrom(p, 'ok', (bindings) => {
      const evalResult = bindings._evalResult as Record<string, unknown>;
      if (evalResult._evalError) {
        // Surface error as variant — note: completeFrom always uses its declared variant.
        // Return a sentinel that the test can check, but we also need to branch.
        // Since we cannot switch variants in completeFrom, we use the 'ok' path and
        // include _evalError in evidence so the caller can detect it.
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

export const apiCallCheckEvaluatorHandler = autoInterpret(_handler);

export default apiCallCheckEvaluatorHandler;
