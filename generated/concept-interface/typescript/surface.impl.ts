// ============================================================
// Surface Concept Implementation
//
// Deployment target management. Tracks surfaces where UI can be
// rendered (browser DOM, terminal, React Native, etc.), attaches
// renderers, handles resize events, and manages surface lifecycle.
// Relation: 'surface' keyed by surface (F).
// ============================================================

import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'surface';

const VALID_KINDS = [
  'browser-dom',
  'terminal',
  'react-native',
  'webview',
  'ssr',
  'static-html',
];

/** Auto-detect capabilities based on surface kind. */
function detectCapabilities(kind: string): string[] {
  switch (kind) {
    case 'browser-dom':
      return ['interactive', 'mouse', 'keyboard', 'touch', 'resize', 'animation'];
    case 'terminal':
      return ['interactive', 'keyboard', 'resize', 'text-only'];
    case 'react-native':
      return ['interactive', 'touch', 'gesture', 'resize', 'animation'];
    case 'webview':
      return ['interactive', 'mouse', 'keyboard', 'touch', 'resize'];
    case 'ssr':
      return ['static', 'streaming'];
    case 'static-html':
      return ['static'];
    default:
      return [];
  }
}

export const surfaceHandler: ConceptHandler = {
  /**
   * create(surface, kind, mountPoint)
   *   -> ok(surface) | unsupported(message)
   *
   * Creates a new surface with the given kind and mount point.
   * Validates that the kind is one of the supported surface types
   * and auto-detects capabilities from the kind.
   */
  async create(input, storage) {
    const surface = input.surface as string;
    const kind = input.kind as string;
    const mountPoint = (input.mountPoint as string | null) ?? null;

    if (!VALID_KINDS.includes(kind)) {
      return {
        variant: 'unsupported',
        message: `Surface kind "${kind}" is not supported. Valid kinds: ${VALID_KINDS.join(', ')}`,
      };
    }

    const capabilities = detectCapabilities(kind);

    await storage.put(RELATION, surface, {
      surface,
      kind,
      mountPoint,
      capabilities: JSON.stringify(capabilities),
      status: 'created',
      config: '{}',
      renderer: null,
      width: 0,
      height: 0,
    });

    return { variant: 'ok', surface };
  },

  /**
   * attach(surface, renderer) -> ok(surface) | incompatible(message)
   *
   * Attaches a renderer to this surface. Stores the renderer reference
   * on the surface record.
   */
  async attach(input, storage) {
    const surface = input.surface as string;
    const renderer = input.renderer as string;

    const record = await storage.get(RELATION, surface);
    if (!record) {
      return {
        variant: 'incompatible',
        message: `Surface "${surface}" not found`,
      };
    }

    await storage.put(RELATION, surface, {
      ...record,
      renderer,
      status: 'attached',
    });

    return { variant: 'ok', surface };
  },

  /**
   * resize(surface, width, height) -> ok(surface) | notfound(message)
   *
   * Updates the dimensions of an existing surface.
   */
  async resize(input, storage) {
    const surface = input.surface as string;
    const width = input.width as number;
    const height = input.height as number;

    const record = await storage.get(RELATION, surface);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Surface "${surface}" not found`,
      };
    }

    await storage.put(RELATION, surface, {
      ...record,
      width,
      height,
    });

    return { variant: 'ok', surface };
  },

  /**
   * destroy(surface) -> ok(surface) | notfound(message)
   *
   * Destroys a surface, removing it from storage entirely.
   */
  async destroy(input, storage) {
    const surface = input.surface as string;

    const record = await storage.get(RELATION, surface);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Surface "${surface}" not found`,
      };
    }

    await storage.del(RELATION, surface);

    return { variant: 'ok', surface };
  },
};
