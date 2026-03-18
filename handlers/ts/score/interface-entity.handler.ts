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
    const name = input.name as string;
    const source = input.source as string;
    const manifest = input.manifest as string;

    const key = `interface:${name}`;
    const existing = await storage.get('interfaces', key);
    if (existing) {
      return { variant: 'alreadyRegistered', existing: existing.id };
    }

    const id = crypto.randomUUID();
    const parsed = manifest ? JSON.parse(manifest) : {};

    await storage.put('interfaces', key, {
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

    return { variant: 'ok', interface: id };
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    const entry = await storage.get('interfaces', `interface:${name}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', interface: entry.id };
  },

  listEndpoints(input: Record<string, unknown>) {
    const interfaceId = input.interface as string;
    const target = input.target as string;

    const all = await storage.find('interfaces');
    const entry = all.find(i => i.id === interfaceId);
    if (!entry) {
      return { variant: 'ok', endpoints: '[]' };
    }

    const endpoints = JSON.parse(entry.generatedEndpoints as string || '[]');
    const filtered = target
      ? endpoints.filter((e: { target: string }) => e.target === target)
      : endpoints;

    return { variant: 'ok', endpoints: JSON.stringify(filtered) };
  },

  listCommands(input: Record<string, unknown>) {
    const interfaceId = input.interface as string;

    const all = await storage.find('interfaces');
    const entry = all.find(i => i.id === interfaceId);
    if (!entry) {
      return { variant: 'ok', commands: '[]' };
    }

    return { variant: 'ok', commands: entry.generatedCommands as string || '[]' };
  },

  listTools(input: Record<string, unknown>) {
    const interfaceId = input.interface as string;

    const all = await storage.find('interfaces');
    const entry = all.find(i => i.id === interfaceId);
    if (!entry) {
      return { variant: 'ok', tools: '[]' };
    }

    return { variant: 'ok', tools: entry.generatedTools as string || '[]' };
  },

  listSkills(input: Record<string, unknown>) {
    const interfaceId = input.interface as string;

    const all = await storage.find('interfaces');
    const entry = all.find(i => i.id === interfaceId);
    if (!entry) {
      return { variant: 'ok', skills: '[]' };
    }

    // Skills are a subset of tools targeting AI coding assistants
    const tools = JSON.parse(entry.generatedTools as string || '[]');
    const skills = tools.filter((t: { kind?: string }) => t.kind === 'skill');

    return { variant: 'ok', skills: JSON.stringify(skills) };
  },

  findByConcept(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const all = await storage.find('interfaces');

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

    return { variant: 'ok', exposures: JSON.stringify(exposures) };
  },

  findByAction(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const action = input.action as string;
    const all = await storage.find('interfaces');

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

    return { variant: 'ok', exposures: JSON.stringify(exposures) };
  },

  traceEndpointToAction(input: Record<string, unknown>) {
    const target = input.target as string;
    const path = input.path as string;
    const method = input.method as string;

    const all = await storage.find('interfaces');

    for (const iface of all) {
      const endpoints = JSON.parse(iface.generatedEndpoints as string || '[]');
      const match = endpoints.find(
        (ep: { target?: string; path?: string; method?: string }) =>
          (ep.target || 'rest') === target && ep.path === path && ep.method === method
      );
      if (match) {
        return {
          variant: 'ok',
          concept: match.concept || '',
          action: match.action || '',
          handler: match.handler || '',
          sourceFile: match.sourceFile || '',
        };
      }
    }

    return { variant: 'notfound' };
  },

  traceToolToAction(input: Record<string, unknown>) {
    const toolName = input.toolName as string;

    const all = await storage.find('interfaces');

    for (const iface of all) {
      const tools = JSON.parse(iface.generatedTools as string || '[]');
      const match = tools.find((t: { name: string }) => t.name === toolName);
      if (match) {
        return {
          variant: 'ok',
          concept: match.concept || '',
          action: match.action || '',
          handler: match.handler || '',
          sourceFile: match.sourceFile || '',
        };
      }
    }

    return { variant: 'notfound' };
  },

  generatedSchemas(input: Record<string, unknown>) {
    const interfaceId = input.interface as string;

    const all = await storage.find('interfaces');
    const entry = all.find(i => i.id === interfaceId);
    if (!entry) {
      return { variant: 'ok', schemas: '[]' };
    }

    return { variant: 'ok', schemas: entry.generatedSchemas as string || '[]' };
  },

  validateAgainstSpecs(input: Record<string, unknown>) {
    const interfaceId = input.interface as string;

    const all = await storage.find('interfaces');
    const entry = all.find(i => i.id === interfaceId);
    if (!entry) {
      return { variant: 'ok', valid: JSON.stringify({ valid: true }) };
    }

    // TODO: Cross-reference ConceptEntities to validate all referenced concepts exist
    return { variant: 'ok', valid: JSON.stringify({ valid: true, checkedAt: new Date().toISOString() }) };
  },
};

export const interfaceEntityHandler = autoInterpret(_handler);
