// @migrated dsl-constructs 2026-03-18
// ============================================================
// TransportAdapterScaffoldGen — Transport adapter scaffold generator
// See architecture doc Section 9, Section 9.2
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toKebab(name: string): string { return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase(); }

function buildTransportAdapter(input: Record<string, unknown>): string {
  const name = (input.name as string) || 'MyTransport';
  const protocol = (input.protocol as string) || 'http';
  return [`// ${name} — ${protocol} transport adapter`, '', `export class ${name} {`, `  // TODO: Implement ${protocol} transport`, '', '  async invoke(concept: string, action: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {', `    throw new Error('${protocol} transport not implemented');`, '  }', '', '  async health(): Promise<{ ok: boolean; latencyMs: number }> {', '    return { ok: false, latencyMs: 0 };', '  }', '}', ''].join('\n');
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'TransportAdapterScaffoldGen', inputKind: 'TransportConfig', outputKind: 'TransportAdapter', capabilities: JSON.stringify(['http', 'websocket', 'worker', 'in-process']) }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const name = (input.name as string) || 'MyTransport';
    if (!name || typeof name !== 'string') { const p = createProgram(); return complete(p, 'error', { message: 'Adapter name is required' }) as StorageProgram<Result>; }
    try {
      const kebab = toKebab(name);
      const adapterCode = buildTransportAdapter(input);
      const files = [{ path: `${kebab}-transport.stub.ts`, content: adapterCode }];
      const p = createProgram();
      return complete(p, 'ok', { files, filesGenerated: files.length }) as StorageProgram<Result>;
    } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); const p = createProgram(); return complete(p, 'error', { message }) as StorageProgram<Result>; }
  },

  preview(input: Record<string, unknown>) { return _handler.generate(input); },
};

export const transportAdapterScaffoldGenHandler = autoInterpret(_handler);
