// @migrated dsl-constructs 2026-03-18
// PySdkTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _pySdkTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const packageName = (parsedConfig.packageName as string) || 'clef_sdk';
    const asyncSupport = (parsedConfig.asyncSupport as boolean) ?? true;

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '_');
    const className = conceptName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

    const files = [
      `${packageName}/__init__.py`,
      `${packageName}/client.py`,
      `${packageName}/models.py`,
      `${packageName}/py.typed`,
      `pyproject.toml`,
    ];

    const packageId = `py-sdk-${conceptName}-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'package', packageId, {
      packageId,
      packageName,
      asyncSupport,
      projection,
      config,
      files: JSON.stringify(files),
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      package: packageId,
      files,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const pySdkTargetHandler = autoInterpret(_pySdkTargetHandler);

