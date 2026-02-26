// ============================================================
// Integration Tests — All Platform Targets (COIF)
//
// Validates the platform adapter pipeline across all platform
// targets: Browser, Mobile, Desktop, Watch, and Terminal.
// Tests concept file structure, normalize action behavior,
// platform-specific mapping correctness, and sync file structure.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { browseradapterHandler } from '../generated/surface/typescript/browseradapter.impl.js';
import { mobileadapterHandler } from '../generated/surface/typescript/mobileadapter.impl.js';
import { desktopadapterHandler } from '../generated/surface/typescript/desktopadapter.impl.js';
import { watchadapterHandler } from '../generated/surface/typescript/watchadapter.impl.js';
import { terminaladapterHandler } from '../generated/surface/typescript/terminaladapter.impl.js';

const COIF_APP_DIR = resolve(__dirname, '..', 'surface', 'kits', 'coif-app');

// All platform adapter concepts
const platformAdapters = [
  { name: 'browser-adapter', displayName: 'BrowserAdapter', platform: 'browser' },
  { name: 'mobile-adapter', displayName: 'MobileAdapter', platform: 'mobile' },
  { name: 'desktop-adapter', displayName: 'DesktopAdapter', platform: 'desktop' },
  { name: 'watch-adapter', displayName: 'WatchAdapter', platform: 'watch' },
  { name: 'terminal-adapter', displayName: 'TerminalAdapter', platform: 'terminal' },
];

// Map platform to handler
const handlers: Record<string, { normalize: (input: Record<string, unknown>, storage: ReturnType<typeof createInMemoryStorage>) => Promise<Record<string, unknown>> }> = {
  browser: browseradapterHandler,
  mobile: mobileadapterHandler,
  desktop: desktopadapterHandler,
  watch: watchadapterHandler,
  terminal: terminaladapterHandler,
};

// ============================================================
// 1. Platform Adapter Concept File Structure
// ============================================================

describe('Platform Target Integration — Concept File Structure', () => {
  for (const adapter of platformAdapters) {
    it(`${adapter.displayName} concept file exists and has correct structure`, () => {
      const path = resolve(COIF_APP_DIR, `${adapter.name}.concept`);
      expect(existsSync(path)).toBe(true);

      const source = readFileSync(path, 'utf-8');
      expect(source).toContain(`concept ${adapter.displayName}`);
      expect(source).toContain('action normalize(');
      expect(source).toContain('-> ok(');
      expect(source).toContain('-> error(');
      expect(source).toContain('state {');
      expect(source).toContain('outputs:');
      expect(source).toContain('invariant {');
    });
  }

  it('all platform adapter concepts have identical action signatures', () => {
    for (const adapter of platformAdapters) {
      const source = readFileSync(resolve(COIF_APP_DIR, `${adapter.name}.concept`), 'utf-8');
      expect(source).toContain('action normalize(adapter: A, props: String)');
      expect(source).toContain('-> ok(adapter: A, normalized: String)');
      expect(source).toContain('-> error(message: String)');
    }
  });

  it('all platform adapter concepts have a type parameter [A]', () => {
    for (const adapter of platformAdapters) {
      const source = readFileSync(resolve(COIF_APP_DIR, `${adapter.name}.concept`), 'utf-8');
      expect(source).toMatch(/concept \w+Adapter \[A\]/);
    }
  });
});

// ============================================================
// 2. Normalize Action — Error Handling
// ============================================================

describe('Platform Target Integration — Normalize Error Handling', () => {
  for (const adapter of platformAdapters) {
    const handler = handlers[adapter.platform];

    it(`${adapter.displayName} returns error for empty props`, async () => {
      const storage = createInMemoryStorage();
      const result = await handler.normalize(
        { adapter: `adapter-${adapter.platform}`, props: '' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it(`${adapter.displayName} returns error for invalid JSON`, async () => {
      const storage = createInMemoryStorage();
      const result = await handler.normalize(
        { adapter: `adapter-${adapter.platform}`, props: '{not-json' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it(`${adapter.displayName} returns error for whitespace-only props`, async () => {
      const storage = createInMemoryStorage();
      const result = await handler.normalize(
        { adapter: `adapter-${adapter.platform}`, props: '   ' },
        storage,
      );
      expect(result.variant).toBe('error');
    });
  }
});

// ============================================================
// 3. Normalize Action — Navigation Mapping
// ============================================================

describe('Platform Target Integration — Navigation Mapping', () => {
  it('BrowserAdapter maps navigation to pushState with URL', async () => {
    const storage = createInMemoryStorage();
    const result = await browseradapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'navigation', destination: 'detail', urlPattern: '/articles/:id', params: { id: '42' } }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('pushState');
    expect(normalized.url).toBe('/articles/42');
    expect(normalized.platform).toBe('browser');
  });

  it('MobileAdapter maps navigation to stack push', async () => {
    const storage = createInMemoryStorage();
    const result = await mobileadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'navigation', destination: 'detail', stackBehavior: 'push' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('navigation.push');
    expect(normalized.screen).toBe('detail');
    expect(normalized.platform).toBe('mobile');
  });

  it('MobileAdapter maps tab navigation', async () => {
    const storage = createInMemoryStorage();
    const result = await mobileadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'navigation', destination: 'home', tabGroup: 'main' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('switchTab');
    expect(normalized.tab).toBe('main');
  });

  it('DesktopAdapter maps navigation to window focus', async () => {
    const storage = createInMemoryStorage();
    const result = await desktopadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'navigation', destination: 'settings' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('focusWindow');
    expect(normalized.window).toBe('settings');
    expect(normalized.platform).toBe('desktop');
  });

  it('DesktopAdapter maps navigation to new window when reuse is false', async () => {
    const storage = createInMemoryStorage();
    const result = await desktopadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'navigation', destination: 'editor', windowConfig: { reuse: false, width: 1024, height: 768 } }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('createWindow');
    expect(normalized.width).toBe(1024);
    expect(normalized.height).toBe(768);
  });

  it('WatchAdapter maps navigation to full-screen page push', async () => {
    const storage = createInMemoryStorage();
    const result = await watchadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'navigation', destination: 'workout' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('pushPage');
    expect(normalized.fullScreen).toBe(true);
    expect(normalized.autoSave).toBe(true);
    expect(normalized.platform).toBe('watch');
  });

  it('TerminalAdapter maps navigation to screen switch', async () => {
    const storage = createInMemoryStorage();
    const result = await terminaladapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'navigation', destination: 'help' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('switchScreen');
    expect(normalized.clearBuffer).toBe(true);
    expect(normalized.render).toBe(true);
    expect(normalized.platform).toBe('terminal');
  });
});

// ============================================================
// 4. Normalize Action — Zone Mapping
// ============================================================

describe('Platform Target Integration — Zone Mapping', () => {
  it('BrowserAdapter maps zones to DOM targets', async () => {
    const storage = createInMemoryStorage();
    const result = await browseradapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'zone', role: 'navigated', zone: 'main' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('mountZone');
    expect(normalized.domTarget).toBe('main-content');
  });

  it('BrowserAdapter maps persistent zone to sidebar', async () => {
    const storage = createInMemoryStorage();
    const result = await browseradapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'zone', role: 'persistent', zone: 'nav' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.domTarget).toBe('sidebar');
  });

  it('MobileAdapter maps zones to mobile targets', async () => {
    const storage = createInMemoryStorage();
    const result = await mobileadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'zone', role: 'persistent', zone: 'tabs' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.mobileTarget).toBe('bottom-tab-bar');
  });

  it('DesktopAdapter maps all zone roles', async () => {
    const storage = createInMemoryStorage();
    for (const [role, expected] of [['navigated', 'main-window'], ['persistent', 'panel'], ['transient', 'notification']]) {
      const result = await desktopadapterHandler.normalize(
        { adapter: 'a1', props: JSON.stringify({ type: 'zone', role, zone: 'z1' }) },
        storage,
      );
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.desktopTarget).toBe(expected);
    }
  });

  it('WatchAdapter only supports navigated zone, skips others', async () => {
    const storage = createInMemoryStorage();

    const okResult = await watchadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'zone', role: 'navigated', zone: 'main' }) },
      storage,
    );
    const okNormalized = JSON.parse(okResult.normalized as string);
    expect(okNormalized.action).toBe('mountZone');
    expect(okNormalized.watchTarget).toBe('full-screen');

    const skipResult = await watchadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'zone', role: 'persistent', zone: 'sidebar' }) },
      storage,
    );
    const skipNormalized = JSON.parse(skipResult.normalized as string);
    expect(skipNormalized.action).toBe('skipped');
  });

  it('TerminalAdapter maps navigated to main-buffer, persistent to status-line', async () => {
    const storage = createInMemoryStorage();

    const mainResult = await terminaladapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'zone', role: 'navigated', zone: 'content' }) },
      storage,
    );
    const mainNormalized = JSON.parse(mainResult.normalized as string);
    expect(mainNormalized.terminalTarget).toBe('main-buffer');

    const statusResult = await terminaladapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'zone', role: 'persistent', zone: 'status' }) },
      storage,
    );
    const statusNormalized = JSON.parse(statusResult.normalized as string);
    expect(statusNormalized.terminalTarget).toBe('status-line');
  });
});

// ============================================================
// 5. Normalize Action — Overlay Mapping
// ============================================================

describe('Platform Target Integration — Overlay Mapping', () => {
  it('BrowserAdapter maps overlay to portal', async () => {
    const storage = createInMemoryStorage();
    const result = await browseradapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'overlay', overlay: 'dialog' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('createPortal');
    expect(normalized.backdrop).toBe(true);
  });

  it('MobileAdapter maps overlay to modal sheet', async () => {
    const storage = createInMemoryStorage();
    const result = await mobileadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'overlay', overlay: 'confirm' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('presentModal');
    expect(normalized.presentation).toBe('modal-sheet');
    expect(normalized.gestureEnabled).toBe(true);
  });

  it('DesktopAdapter maps overlay to modal dialog', async () => {
    const storage = createInMemoryStorage();
    const result = await desktopadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'overlay', overlay: 'settings' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('showDialog');
    expect(normalized.modal).toBe(true);
    expect(normalized.escapeDismiss).toBe(true);
  });

  it('WatchAdapter maps overlay to haptic alert', async () => {
    const storage = createInMemoryStorage();
    const result = await watchadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'overlay', overlay: 'notification' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('hapticAlert');
    expect(normalized.hapticType).toBe('notification');
  });

  it('TerminalAdapter maps overlay to floating text box', async () => {
    const storage = createInMemoryStorage();
    const result = await terminaladapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'overlay', overlay: 'help' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('floatingBox');
    expect(normalized.border).toBe('single');
    expect(normalized.focusTrap).toBe(true);
  });
});

// ============================================================
// 6. Normalize Action — Event Mapping
// ============================================================

describe('Platform Target Integration — Event Mapping', () => {
  it('BrowserAdapter maps popstate to navigateBack', async () => {
    const storage = createInMemoryStorage();
    const result = await browseradapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'popstate' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('navigateBack');
    expect(normalized.source).toBe('popstate');
  });

  it('MobileAdapter maps hardware-back to navigateBack', async () => {
    const storage = createInMemoryStorage();
    const result = await mobileadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'hardware-back' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('navigateBack');
    expect(normalized.source).toBe('hardware-back');
  });

  it('MobileAdapter maps deep-link event', async () => {
    const storage = createInMemoryStorage();
    const result = await mobileadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'deep-link', url: 'myapp://profile/123' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('handleDeepLink');
    expect(normalized.url).toBe('myapp://profile/123');
  });

  it('DesktopAdapter maps keyboard shortcuts to navigateBack', async () => {
    const storage = createInMemoryStorage();
    const result = await desktopadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'cmd-[' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('navigateBack');
  });

  it('DesktopAdapter maps window-close to cleanup', async () => {
    const storage = createInMemoryStorage();
    const result = await desktopadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'window-close' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('cleanup');
  });

  it('WatchAdapter maps crown-press to navigateBack', async () => {
    const storage = createInMemoryStorage();
    const result = await watchadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'crown-press' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('navigateBack');
    expect(normalized.source).toBe('crown-press');
  });

  it('WatchAdapter maps wrist-raise to activate', async () => {
    const storage = createInMemoryStorage();
    const result = await watchadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'wrist-raise' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('activate');
  });

  it('TerminalAdapter maps escape to navigateBack', async () => {
    const storage = createInMemoryStorage();
    const result = await terminaladapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'escape' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('navigateBack');
  });

  it('TerminalAdapter maps ctrl-c to quit', async () => {
    const storage = createInMemoryStorage();
    const result = await terminaladapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'ctrl-c' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('quit');
  });

  it('all adapters ignore unknown events gracefully', async () => {
    for (const adapter of platformAdapters) {
      const handler = handlers[adapter.platform];
      const storage = createInMemoryStorage();
      const result = await handler.normalize(
        { adapter: 'a1', props: JSON.stringify({ type: 'event', event: 'unknown-event-xyz' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.action).toBe('ignored');
    }
  });
});

// ============================================================
// 7. Normalize Action — Replace Mapping
// ============================================================

describe('Platform Target Integration — Replace Mapping', () => {
  it('BrowserAdapter maps replace to replaceState', async () => {
    const storage = createInMemoryStorage();
    const result = await browseradapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'replace', destination: 'login' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('replaceState');
  });

  it('MobileAdapter maps replace to navigation.replace', async () => {
    const storage = createInMemoryStorage();
    const result = await mobileadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'replace', destination: 'auth' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('navigation.replace');
  });

  it('DesktopAdapter maps replace to replaceContent', async () => {
    const storage = createInMemoryStorage();
    const result = await desktopadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'replace', destination: 'editor' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('replaceContent');
  });

  it('WatchAdapter maps replace to replacePage', async () => {
    const storage = createInMemoryStorage();
    const result = await watchadapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'replace', destination: 'summary' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('replacePage');
  });

  it('TerminalAdapter maps replace to switchScreen without render', async () => {
    const storage = createInMemoryStorage();
    const result = await terminaladapterHandler.normalize(
      { adapter: 'a1', props: JSON.stringify({ type: 'replace', destination: 'config' }) },
      storage,
    );
    const normalized = JSON.parse(result.normalized as string);
    expect(normalized.action).toBe('switchScreen');
    expect(normalized.clearBuffer).toBe(true);
    expect(normalized.render).toBeUndefined();
  });
});

// ============================================================
// 8. Storage Persistence
// ============================================================

describe('Platform Target Integration — Storage Persistence', () => {
  for (const adapter of platformAdapters) {
    it(`${adapter.displayName} stores normalized output in storage`, async () => {
      const storage = createInMemoryStorage();
      const adapterId = `adapter-${adapter.platform}`;
      const handler = handlers[adapter.platform];

      await handler.normalize(
        { adapter: adapterId, props: JSON.stringify({ type: 'navigation', destination: 'test' }) },
        storage,
      );

      const stored = await storage.get('output', adapterId);
      expect(stored).toBeDefined();
      expect((stored as Record<string, unknown>).adapter).toBe(adapterId);
      expect((stored as Record<string, unknown>).outputs).toBeDefined();
    });
  }
});

// ============================================================
// 9. Platform-Specific Passthrough for Unknown Types
// ============================================================

describe('Platform Target Integration — Unknown Type Passthrough', () => {
  for (const adapter of platformAdapters) {
    it(`${adapter.displayName} passes through unknown types`, async () => {
      const storage = createInMemoryStorage();
      const handler = handlers[adapter.platform];
      const result = await handler.normalize(
        { adapter: 'a1', props: JSON.stringify({ type: 'custom-thing', foo: 'bar', count: 42 }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.type).toBe('custom-thing');
      expect(normalized.foo).toBe('bar');
      expect(normalized.count).toBe(42);
      expect(normalized.platform).toBe(adapter.platform);
    });
  }
});

// ============================================================
// 10. Platform Pipeline Sync File Structure
// ============================================================

describe('Platform Target Integration — Platform Pipeline Syncs', () => {
  const recommendedSyncDir = resolve(COIF_APP_DIR, 'syncs', 'recommended');
  const navigatorToPlatformPath = resolve(recommendedSyncDir, 'navigator-to-platform.sync');
  const platformEventToNavigatorPath = resolve(recommendedSyncDir, 'platform-event-to-navigator.sync');

  it('navigator-to-platform sync file exists', () => {
    expect(existsSync(navigatorToPlatformPath)).toBe(true);
  });

  it('platform-event-to-navigator sync file exists', () => {
    expect(existsSync(platformEventToNavigatorPath)).toBe(true);
  });

  it('navigator-to-platform references PlatformAdapter/mapNavigation', () => {
    const source = readFileSync(navigatorToPlatformPath, 'utf-8');
    expect(source).toContain('PlatformAdapter/mapNavigation');
  });

  it('platform-event-to-navigator references PlatformAdapter/handlePlatformEvent', () => {
    const source = readFileSync(platformEventToNavigatorPath, 'utf-8');
    expect(source).toContain('PlatformAdapter/handlePlatformEvent');
  });

  it('both platform pipeline syncs have eager annotation', () => {
    const navSource = readFileSync(navigatorToPlatformPath, 'utf-8');
    const eventSource = readFileSync(platformEventToNavigatorPath, 'utf-8');
    expect(navSource).toContain('[eager]');
    expect(eventSource).toContain('[eager]');
  });

  it('navigator-to-platform has a where clause querying PlatformAdapter', () => {
    const source = readFileSync(navigatorToPlatformPath, 'utf-8');
    expect(source).toContain('PlatformAdapter:');
  });
});

// ============================================================
// 11. Generated Implementation Files
// ============================================================

describe('Platform Target Integration — Generated Implementation Files', () => {
  const generatedDir = resolve(__dirname, '..', 'generated', 'surface', 'typescript');

  for (const adapter of platformAdapters) {
    const implName = adapter.displayName.toLowerCase();

    it(`generated ${adapter.displayName} implementation file exists`, () => {
      expect(existsSync(resolve(generatedDir, `${implName}.impl.ts`))).toBe(true);
    });

    it(`${adapter.displayName} implementation imports ConceptHandler`, () => {
      const source = readFileSync(resolve(generatedDir, `${implName}.impl.ts`), 'utf-8');
      expect(source).toContain('ConceptHandler');
      expect(source).toContain(`${implName}Handler`);
      expect(source).toContain('normalizeProps');
    });
  }
});
