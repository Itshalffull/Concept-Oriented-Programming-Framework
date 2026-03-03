import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ConfigSyncStorage, ConfigSyncExportInput, ConfigSyncExportOutput, ConfigSyncImportInput, ConfigSyncImportOutput, ConfigSyncOverrideInput, ConfigSyncOverrideOutput } from './types.js';
import { exportOk, importOk, overrideOk } from './types.js';

export interface ConfigSyncError { readonly code: string; readonly message: string; }
export interface ConfigSyncHandler {
  readonly export: (input: ConfigSyncExportInput, storage: ConfigSyncStorage) => TE.TaskEither<ConfigSyncError, ConfigSyncExportOutput>;
  readonly import: (input: ConfigSyncImportInput, storage: ConfigSyncStorage) => TE.TaskEither<ConfigSyncError, ConfigSyncImportOutput>;
  readonly override: (input: ConfigSyncOverrideInput, storage: ConfigSyncStorage) => TE.TaskEither<ConfigSyncError, ConfigSyncOverrideOutput>;
}

const err = (error: unknown): ConfigSyncError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const configSyncHandler: ConfigSyncHandler = {
  export: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('configs', input.config);
    if (record && record.data) {
      return exportOk(String(record.data));
    }
    // Generate default export data
    const data = JSON.stringify({ config: input.config, exported: true });
    await storage.put('configs', input.config, { config: input.config, data });
    return exportOk(data);
  }, err)),
  import: (input, storage) => pipe(TE.tryCatch(async () => {
    await storage.put('configs', input.config, { config: input.config, data: input.data });
    return importOk();
  }, err)),
  override: (input, storage) => pipe(TE.tryCatch(async () => {
    const existing = await storage.get('configs', input.config);
    const existingData = existing ? String(existing.data ?? '{}') : '{}';
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(existingData); } catch {}
    parsed[input.layer] = input.values;
    const newData = JSON.stringify(parsed);
    await storage.put('configs', input.config, { config: input.config, data: newData, layer: input.layer });
    return overrideOk();
  }, err)),
};
