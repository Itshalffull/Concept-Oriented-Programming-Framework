// ============================================================
// Scaffold Generator Tests
//
// Validates that all scaffold generators implement the
// ConceptHandler pattern with register() and generate() actions,
// produce correctly structured output files, and handle edge cases.
//
// See architecture doc:
//   - Section 7: Suite manifests
//   - Section 10.1: ConceptManifest as language-neutral IR
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';

import { suiteScaffoldGenHandler } from '../handlers/ts/framework/suite-scaffold-gen.handler.js';
import { deployScaffoldGenHandler } from '../handlers/ts/framework/deploy-scaffold-gen.handler.js';
import { interfaceScaffoldGenHandler } from '../handlers/ts/framework/interface-scaffold-gen.handler.js';
import { conceptScaffoldGenHandler } from '../handlers/ts/framework/concept-scaffold-gen.handler.js';
import { syncScaffoldGenHandler } from '../handlers/ts/framework/sync-scaffold-gen.handler.js';
import { handlerScaffoldGenHandler } from '../handlers/ts/framework/handler-scaffold-gen.handler.js';
import { storageAdapterScaffoldGenHandler } from '../handlers/ts/framework/storage-adapter-scaffold-gen.handler.js';
import { transportAdapterScaffoldGenHandler } from '../handlers/ts/framework/transport-adapter-scaffold-gen.handler.js';
import { surfaceComponentScaffoldGenHandler } from '../handlers/ts/framework/surface-component-scaffold-gen.handler.js';
import { surfaceThemeScaffoldGenHandler } from '../handlers/ts/framework/surface-theme-scaffold-gen.handler.js';

const storage = createInMemoryStorage();

// ── Registration Tests ──────────────────────────────────────

describe('Scaffold Generator Registration', () => {
  const generators = [
    { name: 'SuiteScaffoldGen', handler: suiteScaffoldGenHandler },
    { name: 'DeployScaffoldGen', handler: deployScaffoldGenHandler },
    { name: 'InterfaceScaffoldGen', handler: interfaceScaffoldGenHandler },
    { name: 'ConceptScaffoldGen', handler: conceptScaffoldGenHandler },
    { name: 'SyncScaffoldGen', handler: syncScaffoldGenHandler },
    { name: 'HandlerScaffoldGen', handler: handlerScaffoldGenHandler },
    { name: 'StorageAdapterScaffoldGen', handler: storageAdapterScaffoldGenHandler },
    { name: 'TransportAdapterScaffoldGen', handler: transportAdapterScaffoldGenHandler },
    { name: 'SurfaceComponentScaffoldGen', handler: surfaceComponentScaffoldGenHandler },
    { name: 'SurfaceThemeScaffoldGen', handler: surfaceThemeScaffoldGenHandler },
  ];

  for (const { name, handler } of generators) {
    it(`${name} should have register() action`, () => {
      expect(handler.register).toBeDefined();
      expect(typeof handler.register).toBe('function');
    });

    it(`${name} should have generate() action`, () => {
      expect(handler.generate).toBeDefined();
      expect(typeof handler.generate).toBe('function');
    });

    it(`${name} register() should return valid metadata`, async () => {
      const result = await handler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe(name);
      expect(result.inputKind).toBeTruthy();
      expect(result.outputKind).toBeTruthy();
      expect(result.capabilities).toBeTruthy();

      const capabilities = JSON.parse(result.capabilities as string);
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);
    });
  }

  it('all generators should have unique names', async () => {
    const names = new Set<string>();
    for (const { handler } of generators) {
      const result = await handler.register!({}, storage);
      expect(names.has(result.name as string)).toBe(false);
      names.add(result.name as string);
    }
    expect(names.size).toBe(generators.length);
  });

  it('all generators should have unique outputKinds', async () => {
    const kinds = new Set<string>();
    for (const { handler } of generators) {
      const result = await handler.register!({}, storage);
      expect(kinds.has(result.outputKind as string)).toBe(false);
      kinds.add(result.outputKind as string);
    }
    expect(kinds.size).toBe(generators.length);
  });
});

// ── Suite Scaffold Generator ──────────────────────────────────

describe('SuiteScaffoldGen', () => {
  it('should generate suite.yaml with basic inputs', async () => {
    const result = await suiteScaffoldGenHandler.generate!(
      { name: 'auth', description: 'Authentication kit' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBeGreaterThanOrEqual(2); // suite.yaml + syncs/.gitkeep

    const kitYaml = files.find(f => f.path.endsWith('suite.yaml'));
    expect(kitYaml).toBeDefined();
    expect(kitYaml!.content).toContain('name: auth');
    expect(kitYaml!.content).toContain('Authentication kit');
  });

  it('should generate concept stubs for listed concepts', async () => {
    const result = await suiteScaffoldGenHandler.generate!(
      { name: 'auth', concepts: ['User', 'Session', 'JWT'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;

    const conceptFiles = files.filter(f => f.path.endsWith('.concept'));
    expect(conceptFiles.length).toBe(3);

    const userConcept = conceptFiles.find(f => f.path.includes('user'));
    expect(userConcept).toBeDefined();
    expect(userConcept!.content).toContain('concept User [T]');
  });

  it('should generate syncs grouped by tier', async () => {
    const result = await suiteScaffoldGenHandler.generate!(
      {
        name: 'auth',
        syncs: [
          { name: 'ValidateToken', tier: 'required' },
          { name: 'RefreshExpired', tier: 'recommended' },
        ],
      },
      storage,
    );
    const files = result.files as Array<{ path: string; content: string }>;
    const kitYaml = files.find(f => f.path.endsWith('suite.yaml'));
    expect(kitYaml!.content).toContain('required:');
    expect(kitYaml!.content).toContain('ValidateToken');
    expect(kitYaml!.content).toContain('recommended:');
    expect(kitYaml!.content).toContain('RefreshExpired');
  });
});

// ── Deploy Scaffold Generator ───────────────────────────────

describe('DeployScaffoldGen', () => {
  it('should generate deploy.yaml with basic inputs', async () => {
    const result = await deployScaffoldGenHandler.generate!(
      { appName: 'conduit' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBe(1);

    const deployYaml = files[0]!;
    expect(deployYaml.path).toContain('deploy.yaml');
    expect(deployYaml.content).toContain('name: conduit');
    expect(deployYaml.content).toContain('runtimes:');
    expect(deployYaml.content).toContain('infrastructure:');
  });

  it('should include custom runtimes', async () => {
    const result = await deployScaffoldGenHandler.generate!(
      {
        appName: 'my-app',
        runtimes: [
          { name: 'api', type: 'node', transport: 'http', storage: 'postgresql' },
          { name: 'worker', type: 'node', transport: 'sqs', storage: 'redis' },
        ],
      },
      storage,
    );
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files[0]!.content).toContain('api:');
    expect(files[0]!.content).toContain('worker:');
    expect(files[0]!.content).toContain('postgresql:');
    expect(files[0]!.content).toContain('redis:');
  });

  it('should include concept assignments', async () => {
    const result = await deployScaffoldGenHandler.generate!(
      {
        appName: 'my-app',
        runtimes: [{ name: 'main', type: 'node', transport: 'http', storage: 'sqlite' }],
        concepts: [
          { name: 'User', runtime: 'main' },
          { name: 'Article', runtime: 'main' },
        ],
      },
      storage,
    );
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files[0]!.content).toContain('User:');
    expect(files[0]!.content).toContain('Article:');
    expect(files[0]!.content).toContain('runtime: main');
  });
});

// ── Interface Scaffold Generator ────────────────────────────

describe('InterfaceScaffoldGen', () => {
  it('should generate interface.yaml with targets and SDKs', async () => {
    const result = await interfaceScaffoldGenHandler.generate!(
      {
        name: 'conduit-api',
        targets: ['rest', 'graphql'],
        sdks: ['typescript', 'python'],
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBe(1);

    const yaml = files[0]!.content;
    expect(yaml).toContain('name: conduit-api');
    expect(yaml).toContain('rest:');
    expect(yaml).toContain('graphql:');
    expect(yaml).toContain('typescript:');
    expect(yaml).toContain('python:');
    expect(yaml).toContain('openapi: true');
  });

  it('should include per-concept overrides', async () => {
    const result = await interfaceScaffoldGenHandler.generate!(
      {
        name: 'api',
        targets: ['rest'],
        concepts: ['User', 'Article'],
      },
      storage,
    );
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files[0]!.content).toContain('User:');
    expect(files[0]!.content).toContain('Article:');
    expect(files[0]!.content).toContain('/api/users');
    expect(files[0]!.content).toContain('/api/articles');
  });

  it('should support all target types', async () => {
    const result = await interfaceScaffoldGenHandler.generate!(
      {
        name: 'full-api',
        targets: ['rest', 'graphql', 'grpc', 'cli', 'mcp', 'claude-skills'],
      },
      storage,
    );
    const yaml = (result.files as Array<{ path: string; content: string }>)[0]!.content;
    expect(yaml).toContain('basePath: /api');
    expect(yaml).toContain('path: /graphql');
    expect(yaml).toContain('package: app.v1');
    expect(yaml).toContain('shell:');
    expect(yaml).toContain('transport: stdio');
    expect(yaml).toContain('progressive: true');
  });
});

// ── Concept Scaffold Generator ──────────────────────────────

describe('ConceptScaffoldGen', () => {
  it('should generate a .concept file with defaults', async () => {
    const result = await conceptScaffoldGenHandler.generate!(
      { name: 'Bookmark' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBe(1);
    expect(files[0]!.path).toBe('concepts/bookmark.concept');

    const content = files[0]!.content;
    expect(content).toContain('concept Bookmark [T]');
    expect(content).toContain('purpose {');
    expect(content).toContain('state {');
    expect(content).toContain('actions {');
    expect(content).toContain('register()');
  });

  it('should include custom state fields and actions', async () => {
    const result = await conceptScaffoldGenHandler.generate!(
      {
        name: 'Bookmark',
        typeParam: 'B',
        purpose: 'Manage user bookmarks.',
        stateFields: [
          { name: 'bookmarks', type: 'set B' },
          { name: 'url', type: 'String', mapping: true },
        ],
        actions: [
          {
            name: 'add',
            params: [{ name: 'url', type: 'String' }],
            variants: [
              { name: 'ok', params: [{ name: 'bookmark', type: 'B' }], description: 'Bookmark added.' },
              { name: 'duplicate', params: [{ name: 'url', type: 'String' }], description: 'URL already bookmarked.' },
            ],
          },
        ],
      },
      storage,
    );
    const content = (result.files as Array<{ path: string; content: string }>)[0]!.content;
    expect(content).toContain('concept Bookmark [B]');
    expect(content).toContain('bookmarks: set B');
    expect(content).toContain('url: B -> String');
    expect(content).toContain('action add(url: String)');
    expect(content).toContain('-> ok(bookmark: B)');
    expect(content).toContain('-> duplicate(url: String)');
  });
});

// ── Sync Scaffold Generator ─────────────────────────────────

describe('SyncScaffoldGen', () => {
  it('should generate a .sync file with defaults', async () => {
    const result = await syncScaffoldGenHandler.generate!(
      { name: 'BookmarkOnSave' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBe(1);
    expect(files[0]!.path).toBe('syncs/bookmark-on-save.sync');

    const content = files[0]!.content;
    expect(content).toContain('sync BookmarkOnSave');
    expect(content).toContain('when {');
    expect(content).toContain('then {');
  });

  it('should generate with custom trigger and effects', async () => {
    const result = await syncScaffoldGenHandler.generate!(
      {
        name: 'BookmarkOnSave',
        purpose: 'Auto-bookmark saved content.',
        trigger: {
          concept: 'ContentStorage',
          action: 'save',
          params: [{ field: 'content', var: '?c' }],
          variant: 'ok',
          resultParams: [{ field: 'id', var: '?id', value: '?id' }],
        },
        effects: [
          {
            concept: 'Bookmark',
            action: 'add',
            params: [{ field: 'url', value: '?c.url' }],
          },
        ],
      },
      storage,
    );
    const content = (result.files as Array<{ path: string; content: string }>)[0]!.content;
    expect(content).toContain('ContentStorage/save');
    expect(content).toContain('Bookmark/add');
  });
});

// ── Handler Scaffold Generator ──────────────────────────────

describe('HandlerScaffoldGen', () => {
  it('should generate an .handler.ts file', async () => {
    const result = await handlerScaffoldGenHandler.generate!(
      {
        conceptName: 'Bookmark',
        actions: [
          {
            name: 'add',
            params: [{ name: 'url', type: 'String' }],
            variants: [
              { name: 'ok', params: [{ name: 'bookmark', type: 'String' }] },
              { name: 'error', params: [{ name: 'message', type: 'String' }] },
            ],
          },
        ],
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBe(2); // impl + test

    const impl = files.find(f => f.path.endsWith('.handler.ts'));
    expect(impl).toBeDefined();
    expect(impl!.content).toContain('bookmarkHandler');
    expect(impl!.content).toContain('async register()');
    expect(impl!.content).toContain('async add(');
    expect(impl!.content).toContain("const url = input.url as string;");

    const test = files.find(f => f.path.endsWith('.test.ts'));
    expect(test).toBeDefined();
    expect(test!.content).toContain("describe('Bookmark handler'");
  });
});

// ── Storage Adapter Scaffold Generator ──────────────────────

describe('StorageAdapterScaffoldGen', () => {
  const backends = ['sqlite', 'postgresql', 'redis', 'dynamodb', 'memory'];

  for (const backend of backends) {
    it(`should generate ${backend} adapter`, async () => {
      const result = await storageAdapterScaffoldGenHandler.generate!(
        { name: `${backend.charAt(0).toUpperCase() + backend.slice(1)}Storage`, backend },
        storage,
      );
      expect(result.variant).toBe('ok');
      const files = result.files as Array<{ path: string; content: string }>;
      expect(files.length).toBe(1);

      const content = files[0]!.content;
      expect(content).toContain('implements ConceptStorage');
      expect(content).toContain('async put(');
      expect(content).toContain('async get(');
      expect(content).toContain('async find(');
      expect(content).toContain('async del(');
      expect(content).toContain('async delMany(');
    });
  }

  it('should reject invalid backend', async () => {
    const result = await storageAdapterScaffoldGenHandler.generate!(
      { name: 'BadStorage', backend: 'mongodb' },
      storage,
    );
    expect(result.variant).toBe('error');
    expect(result.message).toContain('Invalid backend');
  });
});

// ── Transport Adapter Scaffold Generator ────────────────────

describe('TransportAdapterScaffoldGen', () => {
  const protocols = ['http', 'websocket', 'worker', 'in-process'];

  for (const protocol of protocols) {
    it(`should generate ${protocol} adapter`, async () => {
      const name = `${protocol.charAt(0).toUpperCase() + protocol.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}Transport`;
      const result = await transportAdapterScaffoldGenHandler.generate!(
        { name, protocol },
        storage,
      );
      expect(result.variant).toBe('ok');
      const files = result.files as Array<{ path: string; content: string }>;
      expect(files.length).toBe(1);

      const content = files[0]!.content;
      expect(content).toContain('async invoke(');
      expect(content).toContain('async health(');
    });
  }
});

// ── Clef Surface Component Scaffold Generator ───────────────────────

describe('SurfaceComponentScaffoldGen', () => {
  it('should generate component scaffold with defaults', async () => {
    const result = await surfaceComponentScaffoldGenHandler.generate!(
      { name: 'Dialog' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBe(4); // widget, anatomy, suite.yaml, machine impl

    const widget = files.find(f => f.path.includes('widget.concept'));
    expect(widget).toBeDefined();
    expect(widget!.content).toContain('widget Dialog');

    const anatomy = files.find(f => f.path.includes('anatomy.concept'));
    expect(anatomy).toBeDefined();
    expect(anatomy!.content).toContain('anatomy Dialog');

    const kit = files.find(f => f.path.endsWith('suite.yaml'));
    expect(kit).toBeDefined();
    expect(kit!.content).toContain('name: surface-dialog');

    const machine = files.find(f => f.path.endsWith('.handler.ts'));
    expect(machine).toBeDefined();
    expect(machine!.content).toContain('async register()');
    expect(machine!.content).toContain('async spawn(');
    expect(machine!.content).toContain('async send(');
    expect(machine!.content).toContain('async connect(');
  });

  it('should include custom parts and states', async () => {
    const result = await surfaceComponentScaffoldGenHandler.generate!(
      {
        name: 'Tabs',
        parts: ['root', 'list', 'trigger', 'content', 'indicator'],
        states: ['idle', 'focused', 'selected'],
        events: ['focus', 'select', 'blur'],
      },
      storage,
    );
    const widget = (result.files as Array<{ path: string; content: string }>).find(f =>
      f.path.includes('widget.concept'),
    );
    expect(widget!.content).toContain('part root');
    expect(widget!.content).toContain('part list');
    expect(widget!.content).toContain('part indicator');
    expect(widget!.content).toContain('state idle');
    expect(widget!.content).toContain('state focused');
    expect(widget!.content).toContain('on select -> idle');
  });
});

// ── Clef Surface Theme Scaffold Generator ───────────────────────────

describe('SurfaceThemeScaffoldGen', () => {
  it('should generate theme scaffold with defaults', async () => {
    const result = await surfaceThemeScaffoldGenHandler.generate!(
      { name: 'ocean' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBe(7); // suite.yaml + light + dark + palette + typography + motion + elevation

    const kit = files.find(f => f.path.endsWith('suite.yaml'));
    expect(kit!.content).toContain('name: theme-ocean');

    const light = files.find(f => f.path.includes('light.json'));
    expect(light).toBeDefined();
    const lightData = JSON.parse(light!.content);
    expect(lightData.mode).toBe('light');

    const dark = files.find(f => f.path.includes('dark.json'));
    expect(dark).toBeDefined();
    const darkData = JSON.parse(dark!.content);
    expect(darkData.mode).toBe('dark');

    const palette = files.find(f => f.path.includes('palette.json'));
    expect(palette).toBeDefined();
    const paletteData = JSON.parse(palette!.content);
    expect(paletteData.palettes.primary).toBeDefined();
    expect(paletteData.contrast.minimumRatio).toBe(4.5);

    const typography = files.find(f => f.path.includes('typography.json'));
    expect(typography).toBeDefined();
    const typoData = JSON.parse(typography!.content);
    expect(typoData.fontFamilies.sans).toBeDefined();
    expect(typoData.presets['heading-1']).toBeDefined();

    const motion = files.find(f => f.path.includes('motion.json'));
    expect(motion).toBeDefined();
    const motionData = JSON.parse(motion!.content);
    expect(motionData.reducedMotion.respectPreference).toBe(true);

    const elevation = files.find(f => f.path.includes('elevation.json'));
    expect(elevation).toBeDefined();
    const elevationData = JSON.parse(elevation!.content);
    expect(elevationData.scale['0'].shadow).toBe('none');
  });

  it('should support light-only mode', async () => {
    const result = await surfaceThemeScaffoldGenHandler.generate!(
      { name: 'bright', mode: 'light' },
      storage,
    );
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.find(f => f.path.includes('light.json'))).toBeDefined();
    expect(files.find(f => f.path.includes('dark.json'))).toBeUndefined();
  });

  it('should accept custom typography settings', async () => {
    const result = await surfaceThemeScaffoldGenHandler.generate!(
      {
        name: 'custom',
        fontFamily: 'Inter, sans-serif',
        baseSize: 18,
        scale: 1.333,
      },
      storage,
    );
    const typography = (result.files as Array<{ path: string; content: string }>).find(f =>
      f.path.includes('typography.json'),
    );
    const data = JSON.parse(typography!.content);
    expect(data.fontFamilies.sans).toBe('Inter, sans-serif');
    expect(data.scale.ratio).toBe(1.333);
    expect(data.scale.base).toBe('18px');
  });
});
