// ============================================================
// Integration Tests — All Framework Targets (Clef Surface)
//
// Validates the Clef Surface
// adapter pipeline across all framework targets: React, Vue,
// Svelte, Solid, Ink, and Vanilla. Tests adapter registration,
// mount/unmount lifecycle, sync file structure, generated code,
// and concept file structure (syntax-level, since Clef Surface adapter
// concepts use a simplified invariant syntax not yet handled
// by the runtime parser).
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../runtime/index.js';
import { frameworkadapterHandler } from '../generated/surface/typescript/frameworkadapter.impl.js';

const Clef Surface_RENDER_DIR = resolve(__dirname, '..', 'surface', 'kits', 'surface-render');
const Clef Surface_CORE_DIR = resolve(__dirname, '..', 'surface', 'kits', 'surface-core');
const Clef Surface_THEME_DIR = resolve(__dirname, '..', 'surface', 'kits', 'surface-theme');
const Clef Surface_COMPONENT_DIR = resolve(__dirname, '..', 'surface', 'kits', 'surface-component');
const Clef Surface_INTEGRATION_DIR = resolve(__dirname, '..', 'surface', 'kits', 'surface-integration');

// All framework adapter concepts
const frameworkAdapters = [
  { name: 'react-adapter', displayName: 'ReactAdapter', framework: 'react' },
  { name: 'vue-adapter', displayName: 'VueAdapter', framework: 'vue' },
  { name: 'svelte-adapter', displayName: 'SvelteAdapter', framework: 'svelte' },
  { name: 'solid-adapter', displayName: 'SolidAdapter', framework: 'solid' },
  { name: 'vanilla-adapter', displayName: 'VanillaAdapter', framework: 'vanilla' },
  { name: 'ink-adapter', displayName: 'InkAdapter', framework: 'ink' },
];

// ============================================================
// 1. Adapter Concept File Structure (syntax-level validation)
// ============================================================

describe('Framework Target Integration — Concept File Structure', () => {
  for (const adapter of frameworkAdapters) {
    it(`${adapter.displayName} concept file exists and has correct structure`, () => {
      const path = resolve(Clef Surface_RENDER_DIR, `${adapter.name}.concept`);
      expect(existsSync(path)).toBe(true);

      const source = readFileSync(path, 'utf-8');
      // Verify concept structure via text analysis
      expect(source).toContain(`concept ${adapter.displayName}`);
      expect(source).toContain('action normalize(');
      expect(source).toContain('-> ok(');
      expect(source).toContain('-> error(');
      expect(source).toContain('state {');
      expect(source).toContain('outputs:');
      expect(source).toContain('invariant {');
    });
  }

  it('FrameworkAdapter (registry) concept file has register, mount, unmount actions', () => {
    const source = readFileSync(resolve(Clef Surface_RENDER_DIR, 'framework-adapter.concept'), 'utf-8');
    expect(source).toContain('concept FrameworkAdapter');
    expect(source).toContain('action register(');
    expect(source).toContain('action mount(');
    expect(source).toContain('action unmount(');
    expect(source).toContain('action normalize(');
    expect(source).toContain('action render(');
    expect(source).toContain('capabilities {');
  });

  it('Surface concept file exists and has correct structure', () => {
    const source = readFileSync(resolve(Clef Surface_RENDER_DIR, 'surface.concept'), 'utf-8');
    expect(source).toContain('concept Surface');
    expect(source).toContain('actions {');
  });

  it('Viewport concept file exists and has correct structure', () => {
    const source = readFileSync(resolve(Clef Surface_RENDER_DIR, 'viewport.concept'), 'utf-8');
    expect(source).toContain('concept Viewport');
    expect(source).toContain('actions {');
  });

  it('Layout concept file exists and has correct structure', () => {
    const source = readFileSync(resolve(Clef Surface_RENDER_DIR, 'layout.concept'), 'utf-8');
    expect(source).toContain('concept Layout');
    expect(source).toContain('actions {');
  });

  it('all adapter concepts have identical action signatures', () => {
    for (const adapter of frameworkAdapters) {
      const source = readFileSync(resolve(Clef Surface_RENDER_DIR, `${adapter.name}.concept`), 'utf-8');
      // All adapters should have normalize(adapter: A, props: String)
      expect(source).toContain('action normalize(adapter: A, props: String)');
      // All should have ok and error variants
      expect(source).toContain('-> ok(adapter: A, normalized: String)');
      expect(source).toContain('-> error(message: String)');
    }
  });

  it('all adapter concepts have a type parameter [A]', () => {
    for (const adapter of frameworkAdapters) {
      const source = readFileSync(resolve(Clef Surface_RENDER_DIR, `${adapter.name}.concept`), 'utf-8');
      expect(source).toMatch(/concept \w+Adapter \[A\]/);
    }
  });
});

// ============================================================
// 2. FrameworkAdapter Registration Lifecycle
// ============================================================

describe('Framework Target Integration — Adapter Lifecycle', () => {
  for (const adapter of frameworkAdapters) {
    it(`registers ${adapter.framework} adapter successfully`, async () => {
      const storage = createInMemoryStorage();
      const result = await frameworkadapterHandler.register(
        { renderer: `renderer-${adapter.framework}`, framework: adapter.framework, version: '1.0' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.renderer).toBe(`renderer-${adapter.framework}`);
    });
  }

  it('prevents duplicate framework registration', async () => {
    const storage = createInMemoryStorage();

    await frameworkadapterHandler.register(
      { renderer: 'renderer-react-1', framework: 'react', version: '19' },
      storage,
    );

    const result = await frameworkadapterHandler.register(
      { renderer: 'renderer-react-2', framework: 'react', version: '19' },
      storage,
    );

    expect(result.variant).toBe('duplicate');
  });

  it('mount and unmount lifecycle works for each framework', async () => {
    for (const adapter of frameworkAdapters) {
      const storage = createInMemoryStorage();
      const rendererId = `renderer-${adapter.framework}-lifecycle`;

      // Register
      const registerResult = await frameworkadapterHandler.register(
        { renderer: rendererId, framework: adapter.framework, version: '1.0' },
        storage,
      );
      expect(registerResult.variant).toBe('ok');

      // Mount
      const mountResult = await frameworkadapterHandler.mount(
        { renderer: rendererId, machine: 'dialog-001', target: '#app' },
        storage,
      );
      expect(mountResult.variant).toBe('ok');

      // Unmount
      const unmountResult = await frameworkadapterHandler.unmount(
        { renderer: rendererId, target: '#app' },
        storage,
      );
      expect(unmountResult.variant).toBe('ok');

      // Unregister
      const unregisterResult = await frameworkadapterHandler.unregister(
        { renderer: rendererId },
        storage,
      );
      expect(unregisterResult.variant).toBe('ok');
    }
  });

  it('mount fails for unregistered renderer', async () => {
    const storage = createInMemoryStorage();
    const result = await frameworkadapterHandler.mount(
      { renderer: 'nonexistent', machine: 'dialog-001', target: '#app' },
      storage,
    );

    expect(result.variant).toBe('error');
  });

  it('unmount returns notfound for non-mounted target', async () => {
    const storage = createInMemoryStorage();

    await frameworkadapterHandler.register(
      { renderer: 'r-test', framework: 'react', version: '19' },
      storage,
    );

    const result = await frameworkadapterHandler.unmount(
      { renderer: 'r-test', target: '#nonexistent' },
      storage,
    );

    expect(result.variant).toBe('notfound');
  });

  it('unregister returns notfound for unknown renderer', async () => {
    const storage = createInMemoryStorage();
    const result = await frameworkadapterHandler.unregister(
      { renderer: 'nonexistent' },
      storage,
    );

    expect(result.variant).toBe('notfound');
  });
});

// ============================================================
// 3. Multiple Framework Adapters Coexist
// ============================================================

describe('Framework Target Integration — Multi-Framework Coexistence', () => {
  it('can register all six framework adapters in the same storage', async () => {
    const storage = createInMemoryStorage();

    for (const adapter of frameworkAdapters) {
      const result = await frameworkadapterHandler.register(
        { renderer: `r-${adapter.framework}`, framework: adapter.framework, version: '1.0' },
        storage,
      );
      expect(result.variant, `Registration of ${adapter.framework} should succeed`).toBe('ok');
    }

    const allAdapters = await storage.find('adapter');
    expect(allAdapters).toHaveLength(frameworkAdapters.length);
  });

  it('each framework can be independently mounted and unmounted', async () => {
    const storage = createInMemoryStorage();

    for (const adapter of frameworkAdapters) {
      await frameworkadapterHandler.register(
        { renderer: `r-${adapter.framework}`, framework: adapter.framework, version: '1.0' },
        storage,
      );
    }

    for (let i = 0; i < frameworkAdapters.length; i++) {
      const adapter = frameworkAdapters[i];
      const result = await frameworkadapterHandler.mount(
        { renderer: `r-${adapter.framework}`, machine: `machine-${i}`, target: `#target-${i}` },
        storage,
      );
      expect(result.variant).toBe('ok');
    }

    for (let i = 0; i < 2; i++) {
      const adapter = frameworkAdapters[i];
      const result = await frameworkadapterHandler.unmount(
        { renderer: `r-${adapter.framework}`, target: `#target-${i}` },
        storage,
      );
      expect(result.variant).toBe('ok');
    }

    const allAdapters = await storage.find('adapter');
    const mountedAdapters = allAdapters.filter(
      a => (a as Record<string, unknown>).status === 'mounted',
    );
    expect(mountedAdapters).toHaveLength(frameworkAdapters.length - 2);
  });
});

// ============================================================
// 4. Adapter Pipeline Sync File Structure
// ============================================================

describe('Framework Target Integration — Adapter Pipeline Syncs', () => {
  const adapterPipelinePath = resolve(Clef Surface_RENDER_DIR, 'syncs', 'adapter-pipeline.sync');

  it('adapter pipeline sync file exists', () => {
    expect(existsSync(adapterPipelinePath)).toBe(true);
  });

  it('has sync declarations for all six framework adapters', () => {
    const source = readFileSync(adapterPipelinePath, 'utf-8');

    expect(source).toContain('ReactAdapter/normalize');
    expect(source).toContain('SolidAdapter/normalize');
    expect(source).toContain('VueAdapter/normalize');
    expect(source).toContain('SvelteAdapter/normalize');
    expect(source).toContain('InkAdapter/normalize');
    expect(source).toContain('VanillaAdapter/normalize');
  });

  it('each adapter has both Machine and Renderer trigger syncs', () => {
    const source = readFileSync(adapterPipelinePath, 'utf-8');
    const frameworks = ['React', 'Solid', 'Vue', 'Svelte', 'Ink', 'Vanilla'];

    for (const fw of frameworks) {
      expect(
        source.includes(`Normalize${fw}FromMachine`),
        `${fw} should have Machine trigger sync`,
      ).toBe(true);
      expect(
        source.includes(`Normalize${fw}FromRenderer`),
        `${fw} should have Renderer trigger sync`,
      ).toBe(true);
    }
  });

  it('all adapter pipeline syncs have eager annotation', () => {
    const source = readFileSync(adapterPipelinePath, 'utf-8');
    // Count sync declarations vs eager annotations
    const syncDecls = source.match(/^sync \w+/gm) || [];
    const eagerAnnotations = source.match(/\[eager\]/g) || [];
    expect(eagerAnnotations.length).toBe(syncDecls.length);
  });

  it('all adapter syncs have a where clause querying FrameworkAdapter', () => {
    const source = readFileSync(adapterPipelinePath, 'utf-8');
    // Each sync should reference FrameworkAdapter in its where clause
    const fwAdapterRefs = source.match(/FrameworkAdapter:/g) || [];
    const syncDecls = source.match(/^sync \w+/gm) || [];
    expect(fwAdapterRefs.length).toBe(syncDecls.length);
  });

  it('has exactly 30 sync declarations (2 per framework × 15 frameworks)', () => {
    const source = readFileSync(adapterPipelinePath, 'utf-8');
    const syncDecls = source.match(/^sync \w+/gm) || [];
    expect(syncDecls.length).toBe(30);
  });
});

// ============================================================
// 5. Clef Surface Integration Sync File Structure
// ============================================================

describe('Framework Target Integration — Clef Surface Integration Syncs', () => {
  const integrationSyncDir = resolve(Clef Surface_INTEGRATION_DIR, 'syncs');

  const integrationSyncs = [
    'view-embed-creates-surface',
    'parsed-content-to-richtext',
    'intent-enriches-ui',
    'view-drives-layout',
    'workflow-state-to-signal',
    'schema-def-drives-ui',
    'validation-result-to-form',
    'eventbus-feeds-signals',
    'layout-component-via-widget',
    'view-fields-drive-uischema',
    'form-validates-via-validator',
    'schema-apply-drives-binding',
    'notification-to-toast',
  ];

  for (const syncName of integrationSyncs) {
    it(`integration sync file exists: ${syncName}`, () => {
      const path = resolve(integrationSyncDir, `${syncName}.sync`);
      expect(existsSync(path)).toBe(true);
    });
  }

  for (const syncName of integrationSyncs) {
    it(`integration sync ${syncName} has valid structure`, () => {
      const source = readFileSync(resolve(integrationSyncDir, `${syncName}.sync`), 'utf-8');

      // Should have at least one sync declaration
      expect(source).toMatch(/^sync \w+/m);
      // Should have when and then clauses
      expect(source).toContain('when {');
      expect(source).toContain('then {');
    });
  }
});

// ============================================================
// 6. Clef Surface Render Kit Additional Syncs
// ============================================================

describe('Framework Target Integration — Render Kit Syncs', () => {
  const renderSyncDir = resolve(Clef Surface_RENDER_DIR, 'syncs');

  const renderSyncs = [
    'attach-adapter-to-surface',
    'resize-triggers-viewport',
    'viewport-triggers-layout',
  ];

  for (const syncName of renderSyncs) {
    it(`render suite sync file exists: ${syncName}`, () => {
      const path = resolve(renderSyncDir, `${syncName}.sync`);
      expect(existsSync(path)).toBe(true);
    });
  }

  for (const syncName of renderSyncs) {
    it(`render suite sync ${syncName} has valid structure`, () => {
      const source = readFileSync(resolve(renderSyncDir, `${syncName}.sync`), 'utf-8');
      expect(source).toMatch(/^sync \w+/m);
      expect(source).toContain('when {');
      expect(source).toContain('then {');
    });
  }
});

// ============================================================
// 7. Generated TypeScript Code Verification
// ============================================================

describe('Framework Target Integration — Generated Code', () => {
  const generatedDir = resolve(__dirname, '..', 'generated', 'surface', 'typescript');

  // Verify generated files exist for framework adapter
  it('generated FrameworkAdapter implementation files exist', () => {
    expect(existsSync(resolve(generatedDir, 'frameworkadapter.handler.ts'))).toBe(true);
    expect(existsSync(resolve(generatedDir, 'frameworkadapter.handler.ts'))).toBe(true);
    expect(existsSync(resolve(generatedDir, 'frameworkadapter.types.ts'))).toBe(true);
    expect(existsSync(resolve(generatedDir, 'frameworkadapter.adapter.ts'))).toBe(true);
    expect(existsSync(resolve(generatedDir, 'frameworkadapter.test.ts'))).toBe(true);
  });

  // Verify core Clef Surface concepts have generated code
  const surfaceConcepts = [
    'anatomy', 'binding', 'designtoken', 'element', 'elevation',
    'layout', 'machine', 'motion', 'palette', 'signal', 'slot',
    'surface', 'theme', 'typography', 'uischema', 'viewport', 'widget',
  ];

  for (const concept of surfaceConcepts) {
    it(`generated code exists for Clef Surface concept: ${concept}`, () => {
      expect(existsSync(resolve(generatedDir, `${concept}.handler.ts`))).toBe(true);
      expect(existsSync(resolve(generatedDir, `${concept}.handler.ts`))).toBe(true);
      expect(existsSync(resolve(generatedDir, `${concept}.types.ts`))).toBe(true);
    });
  }
});

// ============================================================
// 8. Clef Surface Kit Completeness
// ============================================================

describe('Framework Target Integration — Clef Surface Kit Completeness', () => {
  it('surface-core has exactly 5 concept files', () => {
    const concepts = ['design-token', 'binding', 'signal', 'ui-schema', 'element'];
    for (const name of concepts) {
      expect(existsSync(resolve(Clef Surface_CORE_DIR, `${name}.concept`))).toBe(true);
    }
  });

  it('surface-theme has exactly 5 concept files', () => {
    const concepts = ['typography', 'palette', 'elevation', 'theme', 'motion'];
    for (const name of concepts) {
      expect(existsSync(resolve(Clef Surface_THEME_DIR, `${name}.concept`))).toBe(true);
    }
  });

  it('surface-component has exactly 6 concept files', () => {
    const concepts = ['machine', 'slot', 'widget', 'affordance', 'interactor', 'widget-resolver'];
    for (const name of concepts) {
      expect(existsSync(resolve(Clef Surface_COMPONENT_DIR, `${name}.concept`))).toBe(true);
    }
  });

  it('surface-render has exactly 10 concept files (6 adapters + 4 infrastructure)', () => {
    const concepts = [
      'react-adapter', 'vue-adapter', 'svelte-adapter', 'solid-adapter',
      'vanilla-adapter', 'ink-adapter',
      'framework-adapter', 'surface', 'viewport', 'layout',
    ];
    for (const name of concepts) {
      expect(existsSync(resolve(Clef Surface_RENDER_DIR, `${name}.concept`))).toBe(true);
    }
  });

  it('surface-integration has exactly 13 sync files', () => {
    const syncs = [
      'view-embed-creates-surface', 'parsed-content-to-richtext', 'intent-enriches-ui',
      'view-drives-layout', 'workflow-state-to-signal', 'schema-def-drives-ui',
      'validation-result-to-form', 'eventbus-feeds-signals', 'layout-component-via-widget',
      'view-fields-drive-uischema', 'form-validates-via-validator', 'schema-apply-drives-binding',
      'notification-to-toast',
    ];
    for (const name of syncs) {
      expect(existsSync(resolve(Clef Surface_INTEGRATION_DIR, 'syncs', `${name}.sync`))).toBe(true);
    }
  });
});
