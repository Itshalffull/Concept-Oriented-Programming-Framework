// @clef-handler style=functional
// BrowserPermission Concept Implementation
// Browser-specific provider for ExtensionPermission. Maps abstract permission
// identifiers to browser API permissions with per-browser differences.
// Validates permission combinations and warns about store review implications.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Abstract permission → browser API permission mappings
const PERMISSION_MAP: Record<string, Record<string, string[]>> = {
  'tabs': {
    'chrome': ['tabs'],
    'firefox': ['tabs'],
    'safari': ['tabs'],
    'edge': ['tabs'],
  },
  'storage': {
    'chrome': ['storage'],
    'firefox': ['storage'],
    'safari': ['storage'],
    'edge': ['storage'],
  },
  'activeTab': {
    'chrome': ['activeTab'],
    'firefox': ['activeTab'],
    'safari': ['activeTab'],
    'edge': ['activeTab'],
  },
  'scripting': {
    'chrome': ['scripting'],
    'firefox': ['tabs', 'content_scripts'],
    'safari': ['scripting'],
    'edge': ['scripting'],
  },
  'webRequest': {
    'chrome': ['webRequest', 'webRequestBlocking'],
    'firefox': ['webRequest', 'webRequestBlocking'],
    'safari': ['webRequest'],
    'edge': ['webRequest', 'webRequestBlocking'],
  },
  'cookies': {
    'chrome': ['cookies'],
    'firefox': ['cookies'],
    'safari': ['cookies'],
    'edge': ['cookies'],
  },
};

// Permissions that trigger enhanced store review
const STORE_REVIEW_PERMISSIONS = ['webRequest', 'webRequestBlocking', '<all_urls>'];

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'BrowserPermission' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const permission = input.permission as string;
    const browser = input.browser as string;

    if (!permission || permission.trim() === '') {
      return complete(createProgram(), 'unsupported', { permission: '', browser }) as StorageProgram<Result>;
    }
    if (!browser || browser.trim() === '') {
      return complete(createProgram(), 'unsupported', { permission, browser: '' }) as StorageProgram<Result>;
    }

    const browserLower = browser.toLowerCase();
    const permMapping = PERMISSION_MAP[permission];

    if (!permMapping || !permMapping[browserLower]) {
      return complete(createProgram(), 'unsupported', { permission, browser }) as StorageProgram<Result>;
    }

    const browserPermissions = JSON.stringify(permMapping[browserLower]);
    const id = `perm-mapping-${permission}-${browserLower}`;

    let p = createProgram();
    p = put(p, 'permissionMapping', id, {
      id,
      abstractPermission: permission,
      browserPermissions,
      browser: browserLower,
      storeWarnings: '[]',
    });
    return complete(p, 'ok', { browserPermissions }) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const permissions = input.permissions as string;
    const browser = input.browser as string;

    let permList: string[] = [];
    try {
      permList = JSON.parse(permissions);
      if (!Array.isArray(permList)) permList = [permissions];
    } catch {
      permList = [permissions];
    }

    const browserLower = browser ? browser.toLowerCase() : '';
    const conflicts: string[] = [];
    let valid = true;

    // Check for known conflicts
    if (permList.includes('webRequest') && permList.includes('declarativeNetRequest')) {
      conflicts.push('webRequest and declarativeNetRequest cannot be used together in Manifest V3');
      valid = false;
    }

    let p = createProgram();
    return complete(p, 'ok', { valid, conflicts: JSON.stringify(conflicts) }) as StorageProgram<Result>;
  },

  listAvailable(input: Record<string, unknown>) {
    const browser = input.browser as string;

    if (!browser || browser.trim() === '') {
      return complete(createProgram(), 'ok', { permissions: '[]' }) as StorageProgram<Result>;
    }

    const browserLower = browser.toLowerCase();
    const availablePerms = Object.entries(PERMISSION_MAP)
      .filter(([, browserMap]) => browserMap[browserLower])
      .map(([permName, browserMap]) => ({
        name: permName,
        browserPermissions: browserMap[browserLower],
        requiresReview: STORE_REVIEW_PERMISSIONS.some((rp) => browserMap[browserLower]?.includes(rp)),
      }));

    let p = createProgram();
    return complete(p, 'ok', { permissions: JSON.stringify(availablePerms) }) as StorageProgram<Result>;
  },

  getStoreWarnings(input: Record<string, unknown>) {
    const permissions = input.permissions as string;
    const browser = input.browser as string;

    let permList: string[] = [];
    try {
      permList = JSON.parse(permissions);
      if (!Array.isArray(permList)) permList = [permissions];
    } catch {
      permList = [permissions];
    }

    const warnings: string[] = [];
    const browserLower = browser ? browser.toLowerCase() : '';

    for (const perm of permList) {
      const permMapping = PERMISSION_MAP[perm];
      if (permMapping && permMapping[browserLower]) {
        const browserPerms = permMapping[browserLower];
        for (const bp of browserPerms) {
          if (STORE_REVIEW_PERMISSIONS.includes(bp)) {
            warnings.push(`Permission '${bp}' triggers enhanced review in the ${browser} extension store.`);
          }
        }
      }
      // Direct check for <all_urls> host permission
      if (perm.includes('<all_urls>') || perm.includes('*://*/*')) {
        warnings.push(`Host permission '${perm}' triggers enhanced review in the ${browser} extension store.`);
      }
    }

    let p = createProgram();
    return complete(p, 'ok', { warnings: JSON.stringify(warnings) }) as StorageProgram<Result>;
  },
};

export const browserPermissionHandler = autoInterpret(_handler);
