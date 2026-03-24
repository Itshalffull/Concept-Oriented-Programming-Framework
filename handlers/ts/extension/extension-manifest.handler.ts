// @clef-handler style=functional
// ExtensionManifest Concept Implementation
// Universal extension declaration: identity, entry points, required permissions,
// capabilities, contribution point registrations, and dependencies.
// Host-agnostic — the same manifest describes an extension regardless of deployment target.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ext-manifest-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  // register() with no args = concept name registration
  // register(name, version, ...) = spec action to register a manifest
  register(input: Record<string, unknown>) {
    // If called with no meaningful args, return concept name
    if (!input.name && !input.version) {
      return complete(createProgram(), 'ok', { name: 'ExtensionManifest' }) as StorageProgram<Result>;
    }

    const name = input.name as string;
    const version = input.version as string;
    const author = (input.author as string | undefined) ?? '';
    const entryPoints = (input.entryPoints as string | undefined) ?? '{}';
    const permissions = (input.permissions as string | undefined) ?? '[]';
    const capabilities = (input.capabilities as string | undefined) ?? '[]';

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!version || version.trim() === '') {
      return complete(createProgram(), 'error', { message: 'version is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'extensionManifest', { name, version }, 'existing');
    p = mapBindings(p, (b) => ((b.existing as unknown[]) || []).length > 0 ? (b.existing as unknown[])[0] : null, '_found');
    return branch(p, '_found',
      (b) => complete(b, 'ok', { message: 'A manifest with the same name and version already exists.' }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'extensionManifest', id, {
          id, name, version, author, entryPoints, permissions, capabilities,
          contributions: '[]',
          dependencies: '[]',
        });
        return complete(b2, 'ok', { manifest: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const manifest = input.manifest as string;

    let p = createProgram();
    p = get(p, 'extensionManifest', manifest, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          name: record.name as string,
          version: record.version as string,
          author: record.author as string,
          entryPoints: record.entryPoints as string,
          permissions: record.permissions as string,
          capabilities: record.capabilities as string,
        };
      }),
      (b) => complete(b, 'notfound', { message: 'No manifest registered with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const manifest = input.manifest as string;
    const fields = input.fields as string;

    // Validate fields is valid JSON
    let parsedFields: Record<string, unknown> = {};
    try {
      parsedFields = JSON.parse(fields);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'The update payload failed schema validation: invalid JSON.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'extensionManifest', manifest, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'extensionManifest', manifest, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, ...parsedFields };
        });
        return complete(b2, 'ok', { manifest });
      },
      (b) => complete(b, 'notfound', { message: 'No manifest registered with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  export(input: Record<string, unknown>) {
    const manifest = input.manifest as string;
    const hostType = input.hostType as string;

    if (!hostType || hostType.trim() === '') {
      return complete(createProgram(), 'error', { message: 'hostType is required' }) as StorageProgram<Result>;
    }

    const supportedHosts = ['browser', 'vscode', 'jetbrains', 'chrome', 'firefox', 'safari', 'edge'];

    let p = createProgram();
    p = get(p, 'extensionManifest', manifest, 'record');
    return branch(p, 'record',
      (b) => {
        if (!supportedHosts.includes(hostType.toLowerCase())) {
          return complete(b, 'unsupported', { hostType });
        }
        return completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const output = JSON.stringify({ hostType, ...record });
          return { manifest, output };
        });
      },
      (b) => complete(b, 'notfound', { message: 'No manifest registered with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  listDependencies(input: Record<string, unknown>) {
    const manifest = input.manifest as string;

    let p = createProgram();
    p = get(p, 'extensionManifest', manifest, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return { dependencies: record.dependencies as string };
      }),
      (b) => complete(b, 'notfound', { message: 'No manifest registered with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  checkCompatibility(input: Record<string, unknown>) {
    const manifest = input.manifest as string;
    const hostType = input.hostType as string;

    let p = createProgram();
    p = get(p, 'extensionManifest', manifest, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const supportedHosts = ['browser', 'vscode', 'jetbrains', 'chrome', 'firefox', 'safari', 'edge'];
        const compatible = supportedHosts.includes(hostType.toLowerCase());
        const issues = compatible ? '[]' : JSON.stringify([`hostType '${hostType}' is not supported`]);
        return { compatible, issues };
      }),
      (b) => complete(b, 'notfound', { message: 'No manifest registered with the given identifier.' }),
    ) as StorageProgram<Result>;
  },
};

export const extensionManifestHandler = autoInterpret(_handler);
