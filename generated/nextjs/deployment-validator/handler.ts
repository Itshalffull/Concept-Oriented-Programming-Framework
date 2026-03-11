import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DeploymentValidatorStorage, DeploymentValidatorParseInput, DeploymentValidatorParseOutput, DeploymentValidatorValidateInput, DeploymentValidatorValidateOutput } from './types.js';
import { parseOk, parseError, validateOk, validateError } from './types.js';

export interface DeploymentValidatorError { readonly code: string; readonly message: string; }
export interface DeploymentValidatorHandler {
  readonly parse: (input: DeploymentValidatorParseInput, storage: DeploymentValidatorStorage) => TE.TaskEither<DeploymentValidatorError, DeploymentValidatorParseOutput>;
  readonly validate: (input: DeploymentValidatorValidateInput, storage: DeploymentValidatorStorage) => TE.TaskEither<DeploymentValidatorError, DeploymentValidatorValidateOutput>;
}

let _manifestCounter = 0;
const err = (error: unknown): DeploymentValidatorError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const deploymentValidatorHandler: DeploymentValidatorHandler = {
  parse: (input, storage) => pipe(TE.tryCatch(async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.raw);
    } catch (e) {
      return parseError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    // Accept either flat format {name, version, target, concepts} or app-structured format {app, runtimes, concepts, syncs}
    const hasFlat = 'name' in parsed && 'version' in parsed && 'target' in parsed && 'concepts' in parsed;
    const hasApp = 'app' in parsed;
    if (!hasFlat && !hasApp) {
      const missing: string[] = [];
      for (const field of ['name', 'version', 'target', 'concepts']) {
        if (!(field in parsed)) missing.push(field);
      }
      return parseError(`Missing required fields: ${missing.join(', ')}`);
    }
    _manifestCounter++;
    const manifest = `manifest-${_manifestCounter}`;
    await storage.put('manifests', manifest, { manifest, raw: input.raw, format: hasFlat ? 'flat' : 'app', ...parsed });
    return parseOk(manifest);
  }, err)),
  validate: (input, storage) => pipe(TE.tryCatch(async () => {
    const manifest = await storage.get('manifests', input.manifest);
    if (!manifest) return validateError(['Manifest not found']);
    // Flat-format manifests with all required fields are valid
    if (manifest.format === 'flat') {
      return validateOk({ manifest: input.manifest });
    }
    // App-structured manifests require additional validation — report missing deployment target
    const issues: string[] = [];
    if (!manifest.target) issues.push('Missing deployment target');
    if (issues.length > 0) return validateError(issues);
    return validateOk({ manifest: input.manifest });
  }, err)),
};
