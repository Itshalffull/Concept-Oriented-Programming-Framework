// ============================================================
// copf impact <source-path>
//
// Shows what generated output files would be affected if a
// source file changes. Uses Emitter/affected to reverse-lookup
// the source map.
//
// See copf-generation-kit.md Part 6.
// ============================================================

import { resolve, relative } from 'path';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { emitterHandler } from '../../../../implementations/typescript/framework/emitter.impl.js';

export async function impactCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const sourcePath = positional[0];
  if (!sourcePath) {
    console.error('Usage: copf impact <source-path>');
    console.error('\nShow what generated files would be affected if a source file changes.');
    console.error('\nExample:');
    console.error('  copf impact ./specs/password.concept');
    process.exit(1);
  }

  const projectDir = resolve(process.cwd());
  const resolvedPath = resolve(projectDir, sourcePath);
  const relPath = relative(projectDir, resolvedPath);
  const emitStorage = createInMemoryStorage();

  const result = await emitterHandler.affected(
    { sourcePath: relPath },
    emitStorage,
  );

  const outputs = (result.outputs as string[]) || [];

  if (outputs.length === 0) {
    console.log(`No generated files reference source: ${relPath}`);
    console.log('\nNote: Source tracing requires files to be written with');
    console.log('the sources parameter via Emitter/write or Emitter/writeBatch.');
    return;
  }

  console.log(`Affected outputs for ${relPath}:\n`);
  for (const output of outputs) {
    console.log(`  ${relative(projectDir, output)}`);
  }
  console.log(`\n${outputs.length} file(s) would be affected.`);
}
