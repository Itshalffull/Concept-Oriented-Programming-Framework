// @clef-handler style=functional concept=QueryExecution
// QueryExecution Concept Implementation — Functional (StorageProgram) style
//
// Registry and dispatcher for query execution providers. Manages named provider
// registrations with kind-based routing and capability declarations through sync
// wiring. Actual execution dispatch returns a placeholder result since external
// backend modules are injected via syncs, not imported directly.
// See architecture doc Section 10.1 (ConceptManifest IR) for query patterns.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  registerKind(input: Record<string, unknown>) {
    const kind = input.kind as string;

    if (!kind || (typeof kind === 'string' && kind.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { kind }),
      (b) => {
        const b2 = put(b, 'registeredKind', kind, { kind });
        return complete(b2, 'ok', { kind });
      },
    ) as StorageProgram<Result>;
  },

  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const kind = input.kind as string;
    const capabilitiesRaw = input.capabilities as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Validate capabilities JSON before storage operations
    let parsedCapabilities: string[];
    try {
      const parsed = JSON.parse(typeof capabilitiesRaw === 'string' ? capabilitiesRaw : '[]');
      if (!Array.isArray(parsed)) {
        return complete(createProgram(), 'error', { message: 'capabilities must be a JSON array' }) as StorageProgram<Result>;
      }
      parsedCapabilities = parsed;
    } catch {
      return complete(createProgram(), 'error', { message: 'capabilities is not valid JSON' }) as StorageProgram<Result>;
    }

    const caps = parsedCapabilities;

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'kindRecord');
    p = get(p, 'provider', name, 'existing');

    return branch(p,
      (b) => b.kindRecord == null,
      (b) => complete(b, 'error', { message: `Kind "${kind}" has not been registered` }),
      (b) => branch(b,
        (bb) => bb.existing != null,
        (bb) => completeFrom(bb, 'duplicate', (bindings) => ({
          provider: (bindings.existing as Record<string, unknown>).name as string,
        })),
        (bb) => {
          const b2 = put(bb, 'provider', name, { name, kind, capabilities: caps });
          return complete(b2, 'ok', { provider: name });
        },
      ),
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const program = input.program as string;

    if (!kind || (typeof kind === 'string' && kind.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'kindRecord');

    return branch(p,
      (b) => b.kindRecord == null,
      (b) => complete(b, 'error', { message: `Kind "${kind}" is not registered` }),
      (b) => {
        // Validate the program is parseable JSON before dispatch
        const p2 = mapBindings(b, (_bindings) => {
          try {
            JSON.parse(typeof program === 'string' ? program : '{}');
            return { ok: true };
          } catch {
            return { ok: false, message: 'program is not valid JSON' };
          }
        }, '_parseCheck');

        return branch(p2,
          (bb) => !(bb._parseCheck as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._parseCheck as { ok: false; message: string }).message,
          })),
          (bb) => {
            // Placeholder dispatch — actual execution is performed by registered
            // backend providers injected via syncs, not imported directly.
            return complete(bb, 'ok', {
              rows: '[]',
              metadata: JSON.stringify({ kind, dispatched: true }),
            });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  planPushdown(input: Record<string, unknown>) {
    const providerName = input.provider as string;
    const programRaw = input.program as string;

    if (!providerName || (typeof providerName === 'string' && providerName.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', providerName, 'providerRecord');

    return branch(p,
      (b) => b.providerRecord == null,
      (b) => complete(b, 'error', { message: `No provider registered with name "${providerName}"` }),
      (b) => {
        const p2 = mapBindings(b, (_bindings) => {
          try {
            const parsed = JSON.parse(typeof programRaw === 'string' ? programRaw : '{}') as Record<string, unknown>;
            return { ok: true, parsed };
          } catch {
            return { ok: false, message: 'program is not valid JSON' };
          }
        }, '_parseResult');

        return branch(p2,
          (bb) => !(bb._parseResult as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._parseResult as { ok: false; message: string }).message,
          })),
          (bb) => completeFrom(bb, 'ok', (bindings) => {
            const record = bindings.providerRecord as Record<string, unknown>;
            const caps = (record.capabilities ?? []) as string[];
            const capSet = new Set(caps);
            const parsed = (bindings._parseResult as { ok: true; parsed: Record<string, unknown> }).parsed;
            const instructions = (parsed.instructions ?? []) as Array<Record<string, unknown>>;

            const pushdownInstructions = instructions.filter(instr =>
              capSet.has((instr.type as string) ?? ''),
            );
            const residualInstructions = instructions.filter(instr =>
              !capSet.has((instr.type as string) ?? ''),
            );

            return {
              pushdown: JSON.stringify({ instructions: pushdownInstructions }),
              residual: JSON.stringify({ instructions: residualInstructions }),
            };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'provider', {}, 'allProviders');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allProviders ?? []) as Array<Record<string, unknown>>;
      const providers = all.map(r => ({
        name: r.name,
        kind: r.kind,
        capabilities: r.capabilities,
      }));
      return { providers: JSON.stringify(providers) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'provider', name, 'providerRecord');

    return branch(p,
      (b) => b.providerRecord == null,
      (b) => complete(b, 'notfound', { message: `No provider registered with name "${name}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.providerRecord as Record<string, unknown>;
        return {
          provider: record.name as string,
          kind: record.kind as string,
          capabilities: JSON.stringify(record.capabilities ?? []),
        };
      }),
    ) as StorageProgram<Result>;
  },
};

export const queryExecutionHandler = autoInterpret(_handler);
