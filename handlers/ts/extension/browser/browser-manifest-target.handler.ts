// @clef-handler style=functional
// BrowserManifestTarget Concept Implementation
// Manifest.json generation coordination for browser extensions.
// Routes to per-browser providers (Chrome, Firefox, Safari, Edge) via the
// browser discriminator parameter.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `manifest-target-${++idCounter}`;
}

const SUPPORTED_BROWSERS = ['chrome', 'firefox', 'safari', 'edge'];

function generateManifestForBrowser(sourceManifest: Record<string, unknown>, browser: string): string {
  const base = {
    manifest_version: browser === 'firefox' ? 2 : 3,
    name: sourceManifest.name || 'Extension',
    version: sourceManifest.version || '1.0.0',
    description: sourceManifest.description || '',
  };

  switch (browser.toLowerCase()) {
    case 'chrome':
    case 'edge':
      return JSON.stringify({ ...base, manifest_version: 3, action: {} });
    case 'firefox':
      return JSON.stringify({ ...base, manifest_version: 2, browser_action: {} });
    case 'safari':
      return JSON.stringify({ ...base, manifest_version: 3, action: {}, safari_version: '14.0' });
    default:
      return JSON.stringify(base);
  }
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'BrowserManifestTarget' }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const manifest = input.manifest as string;
    const browser = input.browser as string;

    if (!manifest || manifest.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'Source manifest is incomplete or malformed.' }) as StorageProgram<Result>;
    }
    if (!browser || browser.trim() === '') {
      return complete(createProgram(), 'unsupported', { browser: '' }) as StorageProgram<Result>;
    }
    if (!SUPPORTED_BROWSERS.includes(browser.toLowerCase())) {
      return complete(createProgram(), 'unsupported', { browser }) as StorageProgram<Result>;
    }

    // Parse source manifest
    let parsedManifest: Record<string, unknown> = {};
    try {
      parsedManifest = JSON.parse(manifest);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'Source manifest is incomplete or malformed: invalid JSON.' }) as StorageProgram<Result>;
    }

    if (!parsedManifest.name) {
      return complete(createProgram(), 'invalid', { message: 'Source manifest is incomplete or malformed: name is required.' }) as StorageProgram<Result>;
    }

    const output = generateManifestForBrowser(parsedManifest, browser);
    const manifestVersion = browser === 'firefox' ? 2 : 3;
    const id = nextId();

    let p = createProgram();
    p = put(p, 'manifestTarget', id, {
      id, browser, manifestVersion, output, sourceManifest: manifest,
    });
    return complete(p, 'ok', { target: id, output }) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const target = input.target as string;

    let p = createProgram();
    p = get(p, 'manifestTarget', target, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        // Basic validation: check the output is valid JSON with required fields
        let valid = true;
        let warnings: string[] = [];
        try {
          const parsed = JSON.parse(record.output as string);
          if (!parsed.name) { valid = false; warnings.push('Missing required field: name'); }
          if (!parsed.version) { valid = false; warnings.push('Missing required field: version'); }
          if (!parsed.manifest_version) { valid = false; warnings.push('Missing required field: manifest_version'); }
        } catch {
          valid = false;
          warnings.push('Generated manifest is not valid JSON');
        }
        return { valid, warnings: JSON.stringify(warnings) };
      }),
      (b) => complete(b, 'notfound', { message: 'No target with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    const target = input.target as string;
    const previousOutput = (input.previousOutput as string | undefined) ?? '{}';

    let p = createProgram();
    p = get(p, 'manifestTarget', target, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const currentOutput = record.output as string;
        // Simple diff: list keys that differ
        let current: Record<string, unknown> = {};
        let previous: Record<string, unknown> = {};
        try { current = JSON.parse(currentOutput); } catch { current = {}; }
        try { previous = JSON.parse(previousOutput); } catch { previous = {}; }

        const changes: Array<{ key: string; old: unknown; new: unknown }> = [];
        const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
        for (const key of allKeys) {
          if (JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
            changes.push({ key, old: previous[key], new: current[key] });
          }
        }
        return { changes: JSON.stringify(changes) };
      }),
      (b) => complete(b, 'notfound', { message: 'No target with the given identifier.' }),
    ) as StorageProgram<Result>;
  },
};

export const browserManifestTargetHandler = autoInterpret(_handler);
