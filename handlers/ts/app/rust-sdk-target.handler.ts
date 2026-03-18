// @migrated dsl-constructs 2026-03-18
// RustSdkTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _rustSdkTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const crateName = (parsedConfig.crateName as string) || 'clef-sdk';
    const edition = (parsedConfig.edition as string) || '2021';

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '_');

    const files = [
      `src/lib.rs`,
      `src/client.rs`,
      `src/types.rs`,
      `Cargo.toml`,
    ];

    const crateId = `rust-sdk-${conceptName}-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'crate', crateId, {
      crateId,
      crateName,
      edition,
      projection,
      config,
      files: JSON.stringify(files),
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      crate: crateId,
      files,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const rustSdkTargetHandler = autoInterpret(_rustSdkTargetHandler);

