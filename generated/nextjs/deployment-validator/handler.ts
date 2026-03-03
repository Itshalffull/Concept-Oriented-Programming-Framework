import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DeploymentValidatorStorage, DeploymentValidatorParseInput, DeploymentValidatorParseOutput, DeploymentValidatorValidateInput, DeploymentValidatorValidateOutput } from './types.js';
import { parseOk, parseError, validateError } from './types.js';

export interface DeploymentValidatorError { readonly code: string; readonly message: string; }
export interface DeploymentValidatorHandler {
  readonly parse: (input: DeploymentValidatorParseInput, storage: DeploymentValidatorStorage) => TE.TaskEither<DeploymentValidatorError, DeploymentValidatorParseOutput>;
  readonly validate: (input: DeploymentValidatorValidateInput, storage: DeploymentValidatorStorage) => TE.TaskEither<DeploymentValidatorError, DeploymentValidatorValidateOutput>;
}

let _manifestCounter = 0;
const err = (error: unknown): DeploymentValidatorError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const deploymentValidatorHandler: DeploymentValidatorHandler = {
  parse: (input, storage) => pipe(TE.tryCatch(async () => {
    try {
      JSON.parse(input.raw);
    } catch (e) {
      return parseError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    _manifestCounter++;
    const manifest = `manifest-${_manifestCounter}`;
    await storage.put('manifests', manifest, { manifest, raw: input.raw });
    return parseOk(manifest);
  }, err)),
  validate: (input, storage) => pipe(TE.tryCatch(async () => {
    return validateError(['No runtimes configured', 'No concepts configured']);
  }, err)),
};
