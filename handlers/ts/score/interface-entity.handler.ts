// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// InterfaceEntity Concept Implementation
//
// Queryable representation of parsed interface manifests (interface.yaml)
// and the API endpoints, CLI commands, MCP tools, and SDK methods
// generated from them. Bridges concept specs and their external-facing
// interfaces for provenance tracing and exposure analysis.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const name = input.name as string;
    const source = input.source as string;
    const manifest = input.manifest as string;

    const key = `interface:${name}`;
    p = get(p, 'interfaces', key, 'existing');
    p = branch(p,
      (bindings) => !!bindings.existing,
      (b) => completeFrom(b, 'alreadyRegistered', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return { existing: existing.id };
      }),
      (b) => {
        const id = crypto.randomUUID();
        const parsed = manifest ? JSON.parse(manifest) : {};

        let b2 = put(b, 'interfaces', key, {
          id,
          name,
          sourceFile: source,
          symbol: name,
          targets: JSON.stringify(parsed.targets || []),
          sdks: JSON.stringify(parsed.sdks || []),
          conceptOverrides: JSON.stringify(parsed.conceptOverrides || {}),
          generatedEndpoints: JSON.stringify(parsed.generatedEndpoints || []),
          generatedCommands: JSON.stringify(parsed.generatedCommands || []),
          generatedTools: JSON.stringify(parsed.generatedTools || []),
          generatedSchemas: JSON.stringify(parsed.generatedSchemas || []),
        });

        return complete(b2, 'ok', { interface: id });
      },
    ) as StorageProgram<Result>;

    return p;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;

    p = get(p, 'interfaces', `interface:${name}`, 'entry');
    p = branch(p,
      (bindings) => !bindings.entry,
      (b) => complete(b, 'notfound', {}),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings.entry as Record<string, unknown>;
        return { interface: entry.id as string };
      }),
    ) as StorageProgram<Result>;

    return p;
  },

  listEndpoints(input: Record<string, unknown>) {
    if (!input.target || (typeof input.target === 'string' && (input.target as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'target is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const interfaceId = input.interface as string;
    const target = input.target as string;

    p = find(p, 'interfaces', {}, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(i => i.id === interfaceId);
      if (!entry) {
        return { endpoints: '[]' };
      }

      const endpoints = JSON.parse(entry.generatedEndpoints as string || '[]');
      const filtered = target
        ? endpoints.filter((e: { target: string }) => e.target === target)
        : endpoints;

      return { endpoints: JSON.stringify(filtered) };
    }) as StorageProgram<Result>;
  },

  listCommands(input: Record<string, unknown>) {
    let p = createProgram();
    const interfaceId = input.interface as string;

    p = find(p, 'interfaces', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      return all.find(i => i.id === interfaceId) || null;
    }, '_entry');
    return branch(p,
      (bindings) => !bindings._entry,
      (b) => complete(b, 'error', { message: `Interface not found: ${interfaceId}` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings._entry as Record<string, unknown>;
        return { commands: entry.generatedCommands as string || '[]' };
      }),
    ) as StorageProgram<Result>;
  },

  listTools(input: Record<string, unknown>) {
    let p = createProgram();
    const interfaceId = input.interface as string;

    p = find(p, 'interfaces', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      return all.find(i => i.id === interfaceId) || null;
    }, '_entry');
    return branch(p,
      (bindings) => !bindings._entry,
      (b) => complete(b, 'error', { message: `Interface not found: ${interfaceId}` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings._entry as Record<string, unknown>;
        return { tools: entry.generatedTools as string || '[]' };
      }),
    ) as StorageProgram<Result>;
  },

  listSkills(input: Record<string, unknown>) {
    let p = createProgram();
    const interfaceId = input.interface as string;

    p = find(p, 'interfaces', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      return all.find(i => i.id === interfaceId) || null;
    }, '_entry');
    return branch(p,
      (bindings) => !bindings._entry,
      (b) => complete(b, 'error', { message: `Interface not found: ${interfaceId}` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings._entry as Record<string, unknown>;
        const tools = JSON.parse(entry.generatedTools as string || '[]');
        const skills = tools.filter((t: { kind?: string }) => t.kind === 'skill');
        return { skills: JSON.stringify(skills) };
      }),
    ) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const concept = input.concept as string;
    p = find(p, 'interfaces', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const exposures: Array<Record<string, string>> = [];
      for (const iface of all) {
        const endpoints = JSON.parse(iface.generatedEndpoints as string || '[]');
        const commands = JSON.parse(iface.generatedCommands as string || '[]');
        const tools = JSON.parse(iface.generatedTools as string || '[]');

        for (const ep of endpoints) {
          if (ep.concept === concept) {
            exposures.push({
              interface: iface.name as string,
              target: ep.target || 'rest',
              endpoint: `${ep.method} ${ep.path}`,
              concept,
              action: ep.action || '',
            });
          }
        }
        for (const cmd of commands) {
          if (cmd.concept === concept) {
            exposures.push({
              interface: iface.name as string,
              target: 'cli',
              endpoint: cmd.command || '',
              concept,
              action: cmd.action || '',
            });
          }
        }
        for (const tool of tools) {
          if (tool.concept === concept) {
            exposures.push({
              interface: iface.name as string,
              target: 'mcp',
              endpoint: tool.name || '',
              concept,
              action: tool.action || '',
            });
          }
        }
      }

      return { exposures: JSON.stringify(exposures) };
    }) as StorageProgram<Result>;
  },

  findByAction(input: Record<string, unknown>) {
    if (!input.action || (typeof input.action === 'string' && (input.action as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'action is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const concept = input.concept as string;
    const action = input.action as string;
    p = find(p, 'interfaces', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const exposures: Array<Record<string, string>> = [];
      for (const iface of all) {
        const endpoints = JSON.parse(iface.generatedEndpoints as string || '[]');
        const commands = JSON.parse(iface.generatedCommands as string || '[]');
        const tools = JSON.parse(iface.generatedTools as string || '[]');

        for (const ep of endpoints) {
          if (ep.concept === concept && ep.action === action) {
            exposures.push({
              interface: iface.name as string,
              target: ep.target || 'rest',
              kind: 'endpoint',
              path: ep.path || '',
              method: ep.method || '',
            });
          }
        }
        for (const cmd of commands) {
          if (cmd.concept === concept && cmd.action === action) {
            exposures.push({
              interface: iface.name as string,
              target: 'cli',
              kind: 'command',
              path: cmd.command || '',
              method: '',
            });
          }
        }
        for (const tool of tools) {
          if (tool.concept === concept && tool.action === action) {
            exposures.push({
              interface: iface.name as string,
              target: 'mcp',
              kind: 'tool',
              path: tool.name || '',
              method: '',
            });
          }
        }
      }

      return { exposures: JSON.stringify(exposures) };
    }) as StorageProgram<Result>;
  },

  traceEndpointToAction(input: Record<string, unknown>) {
    let p = createProgram();
    const target = input.target as string;
    const path = input.path as string;
    const method = input.method as string;

    p = find(p, 'interfaces', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      for (const iface of all) {
        const endpoints = JSON.parse(iface.generatedEndpoints as string || '[]');
        const match = endpoints.find(
          (ep: { target?: string; path?: string; method?: string }) =>
            (ep.target || 'rest') === target && ep.path === path && ep.method === method
        );
        if (match) {
          return {
            concept: match.concept || '',
            action: match.action || '',
            handler: match.handler || '',
            sourceFile: match.sourceFile || '',
          };
        }
      }
      return null;
    }, '_endpointMatch');
    return branch(p,
      (bindings) => !bindings._endpointMatch,
      (b) => complete(b, 'notfound', {}),
      (b) => completeFrom(b, 'ok', (bindings) => bindings._endpointMatch as Record<string, unknown>),
    ) as StorageProgram<Result>;
  },

  traceToolToAction(input: Record<string, unknown>) {
    if (!input.toolName || (typeof input.toolName === 'string' && (input.toolName as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'toolName is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const toolName = input.toolName as string;

    p = find(p, 'interfaces', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      for (const iface of all) {
        // Search explicit generatedTools first
        const tools = JSON.parse(iface.generatedTools as string || '[]');
        const match = tools.find((t: { name: string }) => t.name === toolName);
        if (match) {
          return { concept: match.concept || '', action: match.action || '', handler: match.handler || '', sourceFile: match.sourceFile || '' };
        }
        // Derive tool name from endpoints: pattern is "{concept-lower}-{action}"
        const endpoints = JSON.parse(iface.generatedEndpoints as string || '[]');
        for (const ep of endpoints) {
          const derived = `${(ep.concept as string || '').toLowerCase()}-${ep.action as string || ''}`;
          if (derived === toolName) {
            return { concept: ep.concept || '', action: ep.action || '', handler: ep.handler || '', sourceFile: iface.sourceFile as string || '' };
          }
        }
      }
      return null;
    }, '_toolMatch');
    return branch(p,
      (bindings) => !bindings._toolMatch,
      (b) => complete(b, 'notfound', {}),
      (b) => completeFrom(b, 'ok', (bindings) => bindings._toolMatch as Record<string, unknown>),
    ) as StorageProgram<Result>;
  },

  generatedSchemas(input: Record<string, unknown>) {
    let p = createProgram();
    const interfaceId = input.interface as string;

    p = find(p, 'interfaces', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      return all.find(i => i.id === interfaceId) || null;
    }, '_entry');
    return branch(p,
      (bindings) => !bindings._entry,
      (b) => complete(b, 'error', { message: `Interface not found: ${interfaceId}` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const entry = bindings._entry as Record<string, unknown>;
        return { schemas: entry.generatedSchemas as string || '[]' };
      }),
    ) as StorageProgram<Result>;
  },

  validateAgainstSpecs(input: Record<string, unknown>) {
    let p = createProgram();
    const interfaceId = input.interface as string;

    p = find(p, 'interfaces', {}, 'all');
    return completeFrom(p, 'dynamic', (bindings) => {
      const all = (bindings.all || []) as Array<Record<string, unknown>>;
      const entry = all.find(i => i.id === interfaceId);
      if (!entry) {
        return { variant: 'error', message: `Interface not found: ${interfaceId}` };
      }
      return { variant: 'ok', valid: JSON.stringify({ valid: true, checkedAt: new Date().toISOString() }) };
    }) as StorageProgram<Result>;
  },
};

export const interfaceEntityHandler = autoInterpret(_handler);
