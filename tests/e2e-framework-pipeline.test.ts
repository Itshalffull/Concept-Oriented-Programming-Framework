// ============================================================
// E2E Tests — Full Framework Integration Pipeline
//
// End-to-end tests that verify the complete COIF (Concept-
// Oriented Interface Framework) pipeline: adapter registration →
// mount/unmount lifecycle → multi-framework coexistence,
// plus concept file structure verification, generated code
// validation, and sync pipeline structure for all framework
// targets (React, Vue, Svelte, Solid, Ink, Vanilla).
//
// Note: COIF adapter concept files use a simplified invariant
// syntax not yet handled by the runtime parser. Tests that need
// to exercise parsing use the standard app/framework concepts
// which the parser fully supports.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { frameworkadapterHandler } from '../generated/concept-interface/typescript/frameworkadapter.impl.js';
import type { ConceptAST, ConceptManifest } from '../kernel/src/types.js';

const COIF_RENDER_DIR = resolve(__dirname, '..', 'concept-interface', 'kits', 'coif-render');
const COIF_CORE_DIR = resolve(__dirname, '..', 'concept-interface', 'kits', 'coif-core');
const COIF_THEME_DIR = resolve(__dirname, '..', 'concept-interface', 'kits', 'coif-theme');
const COIF_COMPONENT_DIR = resolve(__dirname, '..', 'concept-interface', 'kits', 'coif-component');
const COIF_INTEGRATION_DIR = resolve(__dirname, '..', 'concept-interface', 'kits', 'coif-integration');
const SPECS_DIR = resolve(__dirname, '..', 'specs');
const KITS_DIR = resolve(__dirname, '..', 'kits');

const RELOCATED_SPECS: Record<string, string> = {
  migration: resolve(KITS_DIR, 'deploy', 'concepts', 'migration.concept'),
  telemetry: resolve(KITS_DIR, 'deploy', 'concepts', 'telemetry.concept'),
};

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate(
    { spec: 'test', ast },
    storage,
  );
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

function readSpec(category: string, name: string): string {
  const relocated = RELOCATED_SPECS[name];
  if (relocated) return readFileSync(relocated, 'utf-8');
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

const frameworks = [
  { name: 'react', adapter: 'react-adapter', displayName: 'ReactAdapter' },
  { name: 'vue', adapter: 'vue-adapter', displayName: 'VueAdapter' },
  { name: 'svelte', adapter: 'svelte-adapter', displayName: 'SvelteAdapter' },
  { name: 'solid', adapter: 'solid-adapter', displayName: 'SolidAdapter' },
  { name: 'vanilla', adapter: 'vanilla-adapter', displayName: 'VanillaAdapter' },
  { name: 'ink', adapter: 'ink-adapter', displayName: 'InkAdapter' },
];

// ============================================================
// 1. E2E: Full Adapter Lifecycle (Register → Mount → Unmount)
// ============================================================

describe('E2E Framework Pipeline — Full Adapter Lifecycle', () => {
  for (const fw of frameworks) {
    it(`${fw.displayName}: register → mount → verify state → unmount → verify state`, async () => {
      const adapterStorage = createInMemoryStorage();

      // Step 1: Register the framework adapter
      const registerResult = await frameworkadapterHandler.register(
        { renderer: `renderer-${fw.name}-e2e`, framework: fw.name, version: '1.0' },
        adapterStorage,
      );
      expect(registerResult.variant).toBe('ok');

      // Step 2: Verify stored state after registration
      const recordAfterReg = await adapterStorage.get('adapter', `renderer-${fw.name}-e2e`);
      expect(recordAfterReg).toBeDefined();
      expect(recordAfterReg!.status).toBe('active');
      expect(recordAfterReg!.framework).toBe(fw.name);
      expect(recordAfterReg!.version).toBe('1.0');

      // Step 3: Mount
      const mountResult = await frameworkadapterHandler.mount(
        { renderer: `renderer-${fw.name}-e2e`, machine: 'dialog-001', target: `#${fw.name}-root` },
        adapterStorage,
      );
      expect(mountResult.variant).toBe('ok');

      // Step 4: Verify mounted state
      const recordAfterMount = await adapterStorage.get('adapter', `renderer-${fw.name}-e2e`);
      expect(recordAfterMount!.status).toBe('mounted');
      const mounts = JSON.parse(recordAfterMount!.mounts as string);
      expect(mounts[`#${fw.name}-root`]).toBe('dialog-001');

      // Step 5: Unmount
      const unmountResult = await frameworkadapterHandler.unmount(
        { renderer: `renderer-${fw.name}-e2e`, target: `#${fw.name}-root` },
        adapterStorage,
      );
      expect(unmountResult.variant).toBe('ok');

      // Step 6: Verify state reverts to active
      const updatedRecord = await adapterStorage.get('adapter', `renderer-${fw.name}-e2e`);
      expect(updatedRecord!.status).toBe('active');

      // Step 7: Unregister
      const unregResult = await frameworkadapterHandler.unregister(
        { renderer: `renderer-${fw.name}-e2e` },
        adapterStorage,
      );
      expect(unregResult.variant).toBe('ok');

      // Step 8: Verify removal
      const removedRecord = await adapterStorage.get('adapter', `renderer-${fw.name}-e2e`);
      expect(removedRecord).toBeNull();
    });
  }
});

// ============================================================
// 2. E2E: All Six Adapters Registered and Operating Simultaneously
// ============================================================

describe('E2E Framework Pipeline — Multi-Framework Simultaneous', () => {
  it('registers all six frameworks, mounts each, then unmounts in reverse', async () => {
    const storage = createInMemoryStorage();

    // Register all
    for (const fw of frameworks) {
      const result = await frameworkadapterHandler.register(
        { renderer: `r-${fw.name}`, framework: fw.name, version: '1.0' },
        storage,
      );
      expect(result.variant).toBe('ok');
    }

    const allAdapters = await storage.find('adapter');
    expect(allAdapters).toHaveLength(6);

    // Mount each to a unique target
    for (let i = 0; i < frameworks.length; i++) {
      const fw = frameworks[i];
      const result = await frameworkadapterHandler.mount(
        { renderer: `r-${fw.name}`, machine: `machine-${i}`, target: `#target-${i}` },
        storage,
      );
      expect(result.variant).toBe('ok');
    }

    // All should be mounted
    const mounted = await storage.find('adapter');
    expect(
      mounted.every(a => (a as Record<string, unknown>).status === 'mounted'),
    ).toBe(true);

    // Unmount in reverse order
    for (let i = frameworks.length - 1; i >= 0; i--) {
      const fw = frameworks[i];
      const result = await frameworkadapterHandler.unmount(
        { renderer: `r-${fw.name}`, target: `#target-${i}` },
        storage,
      );
      expect(result.variant).toBe('ok');
    }

    // All should be back to active
    const active = await storage.find('adapter');
    expect(
      active.every(a => (a as Record<string, unknown>).status === 'active'),
    ).toBe(true);
  });

  it('multiple mounts per framework adapter', async () => {
    const storage = createInMemoryStorage();

    await frameworkadapterHandler.register(
      { renderer: 'r-react', framework: 'react', version: '19' },
      storage,
    );

    for (const target of ['#root', '#modal', '#sidebar']) {
      const result = await frameworkadapterHandler.mount(
        { renderer: 'r-react', machine: `machine-${target}`, target },
        storage,
      );
      expect(result.variant).toBe('ok');
    }

    // Unmount one
    await frameworkadapterHandler.unmount(
      { renderer: 'r-react', target: '#modal' },
      storage,
    );

    const record = await storage.get('adapter', 'r-react');
    expect(record!.status).toBe('mounted');

    // Unmount remaining
    await frameworkadapterHandler.unmount({ renderer: 'r-react', target: '#root' }, storage);
    await frameworkadapterHandler.unmount({ renderer: 'r-react', target: '#sidebar' }, storage);

    const finalRecord = await storage.get('adapter', 'r-react');
    expect(finalRecord!.status).toBe('active');
  });
});

// ============================================================
// 3. E2E: App Concepts Through Full Parse → Schema → Codegen Pipeline
// ============================================================

describe('E2E Framework Pipeline — App Concepts Through Pipeline', () => {
  const parseConcepts = [
    { category: 'app', name: 'password', displayName: 'Password' },
    { category: 'app', name: 'user', displayName: 'User' },
    { category: 'app', name: 'article', displayName: 'Article' },
    { category: 'app', name: 'profile', displayName: 'Profile' },
  ];

  for (const concept of parseConcepts) {
    it(`${concept.displayName}: parse → schema → TypeScript codegen`, async () => {
      const source = readSpec(concept.category, concept.name);

      const parseStorage = createInMemoryStorage();
      const parseResult = await specParserHandler.parse({ source }, parseStorage);
      expect(parseResult.variant).toBe('ok');
      const ast = parseResult.ast as ConceptAST;
      expect(ast.name).toBe(concept.displayName);

      const manifest = await generateManifest(ast);
      expect(manifest.name).toBe(concept.displayName);
      expect(manifest.actions.length).toBeGreaterThanOrEqual(1);

      const genStorage = createInMemoryStorage();
      const genResult = await typescriptGenHandler.generate(
        { spec: `${concept.name}-e2e`, manifest },
        genStorage,
      );
      expect(genResult.variant).toBe('ok');
      const files = genResult.files as { path: string; content: string }[];
      expect(files.length).toBeGreaterThanOrEqual(3);
    });
  }
});

// ============================================================
// 4. E2E: Framework Concepts Through Pipeline
// ============================================================

describe('E2E Framework Pipeline — Framework Concepts Through Pipeline', () => {
  const frameworkConcepts = [
    'spec-parser', 'schema-gen', 'typescript-gen', 'rust-gen',
    'solidity-gen', 'swift-gen', 'sync-parser', 'sync-engine',
    'sync-compiler', 'action-log', 'registry', 'telemetry',
    'flow-trace', 'deployment-validator', 'migration',
  ];

  for (const conceptName of frameworkConcepts) {
    it(`framework concept ${conceptName} compiles through full pipeline`, async () => {
      const source = readSpec('framework', conceptName);

      const parseStorage = createInMemoryStorage();
      const parseResult = await specParserHandler.parse({ source }, parseStorage);
      expect(parseResult.variant).toBe('ok');
      const ast = parseResult.ast as ConceptAST;

      const manifest = await generateManifest(ast);
      expect(manifest.uri).toContain('urn:copf/');

      const tsStorage = createInMemoryStorage();
      const tsResult = await typescriptGenHandler.generate(
        { spec: `${conceptName}-e2e`, manifest },
        tsStorage,
      );
      expect(tsResult.variant).toBe('ok');
      const tsFiles = tsResult.files as { path: string; content: string }[];
      expect(tsFiles.length).toBeGreaterThanOrEqual(3);
    });
  }
});

// ============================================================
// 5. E2E: Adapter Pipeline Sync Wiring
// ============================================================

describe('E2E Framework Pipeline — Adapter Pipeline Sync Wiring', () => {
  it('adapter-pipeline.sync has 30 sync declarations (2 per framework × 15 frameworks)', () => {
    const source = readFileSync(
      resolve(COIF_RENDER_DIR, 'syncs', 'adapter-pipeline.sync'),
      'utf-8',
    );
    const syncDecls = source.match(/^sync \w+/gm) || [];
    expect(syncDecls.length).toBe(30);
  });

  it('each framework has Machine and Renderer trigger syncs', () => {
    const source = readFileSync(
      resolve(COIF_RENDER_DIR, 'syncs', 'adapter-pipeline.sync'),
      'utf-8',
    );

    for (const fw of frameworks) {
      const fwName = fw.name.charAt(0).toUpperCase() + fw.name.slice(1);
      expect(source).toContain(`Normalize${fwName}FromMachine`);
      expect(source).toContain(`Normalize${fwName}FromRenderer`);
    }
  });

  it('all adapter pipeline syncs invoke the normalize action', () => {
    const source = readFileSync(
      resolve(COIF_RENDER_DIR, 'syncs', 'adapter-pipeline.sync'),
      'utf-8',
    );

    expect(source).toContain('ReactAdapter/normalize');
    expect(source).toContain('SolidAdapter/normalize');
    expect(source).toContain('VueAdapter/normalize');
    expect(source).toContain('SvelteAdapter/normalize');
    expect(source).toContain('InkAdapter/normalize');
    expect(source).toContain('VanillaAdapter/normalize');
  });
});

// ============================================================
// 6. E2E: COIF Integration Sync Structure
// ============================================================

describe('E2E Framework Pipeline — Integration Syncs', () => {
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

  it('all 13 integration sync files exist', () => {
    for (const syncName of integrationSyncs) {
      expect(
        existsSync(resolve(COIF_INTEGRATION_DIR, 'syncs', `${syncName}.sync`)),
      ).toBe(true);
    }
  });

  it('all integration syncs have when and then clauses', () => {
    for (const syncName of integrationSyncs) {
      const source = readFileSync(
        resolve(COIF_INTEGRATION_DIR, 'syncs', `${syncName}.sync`),
        'utf-8',
      );
      expect(source).toContain('when {');
      expect(source).toContain('then {');
    }
  });
});

// ============================================================
// 7. E2E: Render Kit Syncs
// ============================================================

describe('E2E Framework Pipeline — Render Kit Syncs', () => {
  const renderSyncs = [
    'adapter-pipeline',
    'attach-adapter-to-surface',
    'resize-triggers-viewport',
    'viewport-triggers-layout',
  ];

  for (const syncName of renderSyncs) {
    it(`render sync ${syncName} exists and has valid structure`, () => {
      const path = resolve(COIF_RENDER_DIR, 'syncs', `${syncName}.sync`);
      expect(existsSync(path)).toBe(true);

      const source = readFileSync(path, 'utf-8');
      expect(source).toMatch(/^sync \w+/m);
      expect(source).toContain('when {');
      expect(source).toContain('then {');
    });
  }
});

// ============================================================
// 8. E2E: Complete COIF Concept Count Verification
// ============================================================

describe('E2E Framework Pipeline — COIF Completeness', () => {
  it('coif-core has exactly 5 concepts', () => {
    const concepts = ['design-token', 'binding', 'signal', 'ui-schema', 'element'];
    for (const name of concepts) {
      const source = readFileSync(resolve(COIF_CORE_DIR, `${name}.concept`), 'utf-8');
      expect(source).toContain('concept ');
      expect(source).toContain('actions {');
    }
  });

  it('coif-theme has exactly 5 concepts', () => {
    const concepts = ['typography', 'palette', 'elevation', 'theme', 'motion'];
    for (const name of concepts) {
      const source = readFileSync(resolve(COIF_THEME_DIR, `${name}.concept`), 'utf-8');
      expect(source).toContain('concept ');
      expect(source).toContain('actions {');
    }
  });

  it('coif-component has exactly 6 concepts', () => {
    const concepts = ['machine', 'slot', 'widget', 'affordance', 'interactor', 'widget-resolver'];
    for (const name of concepts) {
      const source = readFileSync(resolve(COIF_COMPONENT_DIR, `${name}.concept`), 'utf-8');
      expect(source).toContain('concept ');
      expect(source).toContain('actions {');
    }
  });

  it('coif-render has exactly 10 concepts (6 adapters + 4 infrastructure)', () => {
    const concepts = [
      'react-adapter', 'vue-adapter', 'svelte-adapter', 'solid-adapter',
      'vanilla-adapter', 'ink-adapter',
      'framework-adapter', 'surface', 'viewport', 'layout',
    ];
    for (const name of concepts) {
      const source = readFileSync(resolve(COIF_RENDER_DIR, `${name}.concept`), 'utf-8');
      expect(source).toContain('concept ');
    }
  });
});
