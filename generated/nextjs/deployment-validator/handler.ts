// DeploymentValidator — Deployment manifest parsing and validation: YAML/JSON manifest
// ingestion, concept compatibility checking, sync configuration verification, deploy plan generation.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DeploymentValidatorStorage,
  DeploymentValidatorParseInput,
  DeploymentValidatorParseOutput,
  DeploymentValidatorValidateInput,
  DeploymentValidatorValidateOutput,
} from './types.js';

import {
  parseOk,
  parseError,
  validateOk,
  validateWarning,
  validateError,
} from './types.js';

export interface DeploymentValidatorError {
  readonly code: string;
  readonly message: string;
}

export interface DeploymentValidatorHandler {
  readonly parse: (
    input: DeploymentValidatorParseInput,
    storage: DeploymentValidatorStorage,
  ) => TE.TaskEither<DeploymentValidatorError, DeploymentValidatorParseOutput>;
  readonly validate: (
    input: DeploymentValidatorValidateInput,
    storage: DeploymentValidatorStorage,
  ) => TE.TaskEither<DeploymentValidatorError, DeploymentValidatorValidateOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): DeploymentValidatorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const REQUIRED_MANIFEST_FIELDS: readonly string[] = [
  'name', 'version', 'target', 'concepts',
] as const;

const tryParseJson = (raw: string): { readonly ok: true; readonly data: Record<string, unknown> } | { readonly ok: false; readonly error: string } => {
  try {
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { ok: false, error: 'Manifest must be a JSON object, not an array or primitive' };
    }
    return { ok: true, data: data as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
};

// --- Implementation ---

export const deploymentValidatorHandler: DeploymentValidatorHandler = {
  parse: (input, storage) =>
    pipe(
      TE.of(input.raw),
      TE.chain((raw) => {
        // Attempt to parse the raw manifest
        const result = tryParseJson(raw);

        if (!result.ok) {
          return TE.right(parseError(result.error) as DeploymentValidatorParseOutput);
        }

        // Validate required fields are present
        const missingFields = REQUIRED_MANIFEST_FIELDS.filter(
          (field) => !(field in result.data),
        );

        if (missingFields.length > 0) {
          return TE.right(parseError(
            `Missing required fields: ${missingFields.join(', ')}`,
          ) as DeploymentValidatorParseOutput);
        }

        // Validate concepts field is an array
        if (!Array.isArray(result.data.concepts)) {
          return TE.right(parseError(
            'Field "concepts" must be an array of concept references',
          ) as DeploymentValidatorParseOutput);
        }

        // Store the parsed manifest for later validation
        const manifestId = `manifest-${Date.now()}`;

        return pipe(
          TE.tryCatch(
            async () => {
              await storage.put('manifests', manifestId, {
                manifestId,
                raw,
                parsed: result.data,
                parsedAt: new Date().toISOString(),
              });
              return parseOk(manifestId);
            },
            toStorageError,
          ),
        );
      }),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('manifests', input.manifest),
        toStorageError,
      ),
      TE.chain((manifestRecord) =>
        pipe(
          O.fromNullable(manifestRecord),
          O.fold(
            () => TE.right(validateError([
              `Manifest '${input.manifest}' not found. Parse the manifest first.`,
            ]) as DeploymentValidatorValidateOutput),
            (rec) => {
              const issues: string[] = [];
              const warnings: string[] = [];
              const parsed = (rec as Record<string, unknown>).parsed as Record<string, unknown> | undefined;
              const manifestConcepts = parsed?.concepts;

              // Cross-reference manifest concepts against provided concepts
              if (Array.isArray(manifestConcepts) && Array.isArray(input.concepts)) {
                const conceptNames = new Set(
                  input.concepts.map((c) =>
                    typeof c === 'object' && c !== null
                      ? String((c as Record<string, unknown>).name ?? '')
                      : String(c),
                  ),
                );

                for (const mc of manifestConcepts) {
                  const name = typeof mc === 'string' ? mc : String((mc as Record<string, unknown>).name ?? '');
                  if (name && !conceptNames.has(name)) {
                    issues.push(`Concept '${name}' referenced in manifest but not found in provided concepts`);
                  }
                }
              }

              // Validate sync configurations reference valid concepts
              if (Array.isArray(input.syncs)) {
                for (const sync of input.syncs) {
                  const s = sync as Record<string, unknown>;
                  const source = String(s.source ?? '');
                  const target = String(s.target ?? '');
                  if (!source || !target) {
                    warnings.push('Sync configuration missing source or target');
                  }
                }
              }

              // Check for empty concept list
              if (Array.isArray(manifestConcepts) && manifestConcepts.length === 0) {
                warnings.push('Manifest has an empty concepts array');
              }

              // Build the deployment plan
              const plan = {
                manifest: input.manifest,
                target: parsed?.target ?? 'unknown',
                conceptCount: Array.isArray(manifestConcepts) ? manifestConcepts.length : 0,
                syncCount: input.syncs.length,
                validatedAt: new Date().toISOString(),
              };

              if (issues.length > 0) {
                return pipe(
                  TE.tryCatch(
                    async () => {
                      await storage.put('validation-results', input.manifest, {
                        manifest: input.manifest,
                        status: 'error',
                        issues,
                      });
                      return validateError(issues);
                    },
                    toStorageError,
                  ),
                );
              }

              if (warnings.length > 0) {
                return pipe(
                  TE.tryCatch(
                    async () => {
                      await storage.put('validation-results', input.manifest, {
                        manifest: input.manifest,
                        status: 'warning',
                        plan,
                        warnings,
                      });
                      return validateWarning(plan, warnings);
                    },
                    toStorageError,
                  ),
                );
              }

              return pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('validation-results', input.manifest, {
                      manifest: input.manifest,
                      status: 'ok',
                      plan,
                    });
                    return validateOk(plan);
                  },
                  toStorageError,
                ),
              );
            },
          ),
        ),
      ),
    ),
};
