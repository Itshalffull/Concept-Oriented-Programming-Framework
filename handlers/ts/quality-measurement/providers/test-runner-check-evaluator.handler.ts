// @clef-handler style=functional concept=TestRunnerCheckEvaluatorProvider
// ============================================================
// TestRunnerCheckEvaluatorProvider Handler
//
// Runs a test suite command and checks the exit code / parsed
// results to produce a pass/fail score. Registers with
// PluginRegistry as a check-evaluator provider under name "test-runner".
//
// Config JSON shape:
//   {
//     command: string,          // Shell command to run (e.g., "npx vitest run")
//     workdir?: string,         // Working directory for the command
//     timeout?: number,         // Timeout in milliseconds (default: 60000)
//     parseFormat?: "tap" | "junit" | "exitcode",  // Output format (default: exitcode)
//     expectedPassRate?: number // Minimum pass rate in [0,1] to consider passing (default: 1.0)
//   }
//
// Uses perform() to route the local process invocation through the
// EffectHandler so it benefits from full observability and retry policies.
// The actual process execution is handled by a LocalProcess provider.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, perform, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'TestRunnerCheckEvaluatorProvider';
const EVALUATOR_KIND = 'test-runner';

// ──────────────────────────────────────────────────────────────
// Test output parsers
// ──────────────────────────────────────────────────────────────

interface ParsedResults {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  summary: string;
}

/**
 * Parse TAP (Test Anything Protocol) output.
 * Lines starting with "ok" = pass, "not ok" = fail.
 */
function parseTap(output: string): ParsedResults {
  const lines = output.split('\n');
  let passed = 0;
  let failed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('not ok')) {
      failed++;
    } else if (trimmed.startsWith('ok')) {
      passed++;
    }
  }

  const total = passed + failed;
  const passRate = total === 0 ? 1 : passed / total;
  return { total, passed, failed, passRate, summary: `${passed}/${total} tests passed (TAP)` };
}

/**
 * Parse JUnit XML output — count <testcase> vs <failure>/<error> elements.
 */
function parseJunit(output: string): ParsedResults {
  const totalMatches = output.match(/<testcase/g);
  const failureMatches = output.match(/<(?:failure|error)[^>]*>/g);

  const total = totalMatches ? totalMatches.length : 0;
  const failed = failureMatches ? failureMatches.length : 0;
  const passed = total - failed;
  const passRate = total === 0 ? 1 : passed / total;

  return { total, passed, failed, passRate, summary: `${passed}/${total} tests passed (JUnit)` };
}

/**
 * Simple exit-code evaluation — exit 0 = 1.0, non-zero = 0.0.
 */
function parseExitCode(exitCode: number): ParsedResults {
  const passed = exitCode === 0 ? 1 : 0;
  const failed = exitCode === 0 ? 0 : 1;
  return {
    total: 1,
    passed,
    failed,
    passRate: passed,
    summary: exitCode === 0 ? 'Process exited successfully (code 0)' : `Process exited with code ${exitCode}`,
  };
}

function parseOutput(format: string, exitCode: number, stdout: string): ParsedResults {
  switch (format) {
    case 'tap':    return parseTap(stdout);
    case 'junit':  return parseJunit(stdout);
    default:       return parseExitCode(exitCode);
  }
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
      command?: string;
      workdir?: string;
      timeout?: number;
      parseFormat?: string;
      expectedPassRate?: number;
    };
    try {
      config = JSON.parse(configRaw);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'config must be valid JSON' }) as StorageProgram<Result>;
    }

    if (!config.command || config.command.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config.command is required' }) as StorageProgram<Result>;
    }

    const parseFormat = config.parseFormat ?? 'exitcode';
    const expectedPassRate = config.expectedPassRate ?? 1.0;
    const timeout = config.timeout ?? 60000;
    const command = config.command;

    // Use perform() to declare the local process effect.
    // The EffectHandler routes this to a LocalProcess provider which
    // executes the shell command and returns { exitCode, stdout, stderr }.
    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      command,
      workdir: config.workdir,
      timeout,
    }, '_processResult');

    // Derive evaluation result from the perform binding
    p = mapBindings(p, (bindings) => {
      const result = bindings._processResult as Record<string, unknown> | null;
      if (!result) return { _evalError: 'Test runner process returned no result' };

      const exitCode = (result.exitCode as number) ?? 1;
      const stdout = (result.stdout as string) ?? '';

      let parsed: ParsedResults;
      try {
        parsed = parseOutput(parseFormat, exitCode, stdout);
      } catch (err) {
        return { _evalError: `Failed to parse test output: ${String(err)}` };
      }

      const score = Math.min(1, Math.max(0, parsed.passRate));
      const passing = score >= expectedPassRate;
      const status = passing ? 'passing' : 'failing';

      const evidence = JSON.stringify({
        command,
        exitCode,
        parseFormat,
        total: parsed.total,
        passed: parsed.passed,
        failed: parsed.failed,
        passRate: parsed.passRate,
        expectedPassRate,
        summary: parsed.summary,
      });

      return { _score: score, _evidence: evidence, _status: status };
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

export const testRunnerCheckEvaluatorHandler = autoInterpret(_handler);

export default testRunnerCheckEvaluatorHandler;
