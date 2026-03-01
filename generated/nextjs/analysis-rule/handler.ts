// AnalysisRule concept handler — static analysis rule definition and evaluation.
// Supports creating rules with engine/severity/category and evaluating them against code.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AnalysisRuleStorage,
  AnalysisRuleCreateInput,
  AnalysisRuleCreateOutput,
  AnalysisRuleEvaluateInput,
  AnalysisRuleEvaluateOutput,
  AnalysisRuleEvaluateAllInput,
  AnalysisRuleEvaluateAllOutput,
  AnalysisRuleGetInput,
  AnalysisRuleGetOutput,
} from './types.js';

import {
  createOk,
  createInvalidSyntax,
  evaluateOk,
  evaluateNoFindings,
  evaluateEvaluationError,
  evaluateAllOk,
  getOk,
  getNotfound,
} from './types.js';

export interface AnalysisRuleError {
  readonly code: string;
  readonly message: string;
}

export interface AnalysisRuleHandler {
  readonly create: (input: AnalysisRuleCreateInput, storage: AnalysisRuleStorage) => TE.TaskEither<AnalysisRuleError, AnalysisRuleCreateOutput>;
  readonly evaluate: (input: AnalysisRuleEvaluateInput, storage: AnalysisRuleStorage) => TE.TaskEither<AnalysisRuleError, AnalysisRuleEvaluateOutput>;
  readonly evaluateAll: (input: AnalysisRuleEvaluateAllInput, storage: AnalysisRuleStorage) => TE.TaskEither<AnalysisRuleError, AnalysisRuleEvaluateAllOutput>;
  readonly get: (input: AnalysisRuleGetInput, storage: AnalysisRuleStorage) => TE.TaskEither<AnalysisRuleError, AnalysisRuleGetOutput>;
}

// --- Pure helpers ---

const toStorageError = (error: unknown): AnalysisRuleError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''));

const VALID_SEVERITIES: readonly string[] = ['error', 'warning', 'info', 'hint'];

const isValidSource = (source: string, engine: string): boolean => {
  if (engine === 'regex') {
    try { new RegExp(source); return true; } catch { return false; }
  }
  return source.trim().length > 0;
};

// --- Implementation ---

export const analysisRuleHandler: AnalysisRuleHandler = {
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!isValidSource(input.source, input.engine)) {
            return createInvalidSyntax(`Invalid ${input.engine} pattern: ${input.source}`);
          }
          const ruleId = `rule::${input.name}`;
          await storage.put('analysisrule', ruleId, {
            name: input.name,
            engine: input.engine,
            source: input.source,
            severity: VALID_SEVERITIES.includes(input.severity) ? input.severity : 'warning',
            category: input.category,
            createdAt: new Date().toISOString(),
          });
          return createOk(ruleId);
        },
        toStorageError,
      ),
    ),

  evaluate: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('analysisrule', input.rule), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(evaluateEvaluationError(`Rule '${input.rule}' not found`)),
            (rule) =>
              TE.tryCatch(
                async () => {
                  const engine = str(rule['engine']);
                  const source = str(rule['source']);
                  const files = await storage.find('file');
                  const findings: { readonly file: string; readonly line: number; readonly message: string }[] = [];

                  if (engine === 'regex') {
                    const regex = new RegExp(source, 'g');
                    for (const f of files) {
                      const content = str(f['content']);
                      const lines = content.split('\n');
                      for (let i = 0; i < lines.length; i++) {
                        regex.lastIndex = 0;
                        if (regex.test(lines[i])) {
                          findings.push({
                            file: str(f['path']),
                            line: i + 1,
                            message: `${str(rule['name'])}: pattern matched`,
                          });
                        }
                      }
                    }
                  }

                  if (findings.length === 0) return evaluateNoFindings();
                  return evaluateOk(JSON.stringify(findings));
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  evaluateAll: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const rules = await storage.find('analysisrule', { category: input.category });
          const allResults: { readonly rule: string; readonly findingCount: number }[] = [];

          for (const rule of rules) {
            const engine = str(rule['engine']);
            const source = str(rule['source']);
            let findingCount = 0;

            if (engine === 'regex') {
              const regex = new RegExp(source, 'g');
              const files = await storage.find('file');
              for (const f of files) {
                const content = str(f['content']);
                const lines = content.split('\n');
                for (const line of lines) {
                  regex.lastIndex = 0;
                  if (regex.test(line)) findingCount++;
                }
              }
            }

            allResults.push({ rule: str(rule['name']), findingCount });
          }

          return evaluateAllOk(JSON.stringify(allResults));
        },
        toStorageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(() => storage.get('analysisrule', input.rule), toStorageError),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  input.rule,
                  str(found['name']),
                  str(found['engine']),
                  str(found['severity']),
                  str(found['category']),
                ),
              ),
          ),
        ),
      ),
    ),
};
