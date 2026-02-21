// Conduit Platform Adapters — All 5 Platforms Test
// Validates that all platform adapter concepts can normalize
// platform-specific props and handle lifecycle events.

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Import generated platform adapter handlers
import { browseradapterHandler } from '../generated/concept-interface/typescript/browseradapter.impl.js';
import { mobileadapterHandler } from '../generated/concept-interface/typescript/mobileadapter.impl.js';
import { desktopadapterHandler } from '../generated/concept-interface/typescript/desktopadapter.impl.js';
import { watchadapterHandler } from '../generated/concept-interface/typescript/watchadapter.impl.js';
import { terminaladapterHandler } from '../generated/concept-interface/typescript/terminaladapter.impl.js';

describe('Conduit Platform Adapters — All 5 Platforms', () => {
  describe('BrowserAdapter', () => {
    it('normalizes navigation props for browser', async () => {
      const storage = createInMemoryStorage();
      const result = await browseradapterHandler.normalize(
        { adapter: 'browser-nav', props: JSON.stringify({ type: 'navigation', destination: 'home' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.platform).toBe('browser');
      expect(normalized.action).toBe('pushState');
      expect(normalized.destination).toBe('home');
    });

    it('normalizes viewport/zone props for browser', async () => {
      const storage = createInMemoryStorage();
      const result = await browseradapterHandler.normalize(
        { adapter: 'browser-zone', props: JSON.stringify({ type: 'zone', role: 'navigated', zone: 'primary' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.action).toBe('mountZone');
      expect(normalized.domTarget).toBe('main-content');
    });
  });

  describe('MobileAdapter', () => {
    it('normalizes navigation props for mobile (stack push)', async () => {
      const storage = createInMemoryStorage();
      const result = await mobileadapterHandler.normalize(
        { adapter: 'mobile-nav', props: JSON.stringify({ type: 'navigation', destination: 'article', stackBehavior: 'push' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.platform).toBe('mobile');
      expect(normalized.action).toBe('navigation.push');
      expect(normalized.screen).toBe('article');
    });

    it('normalizes tab switch for mobile', async () => {
      const storage = createInMemoryStorage();
      const result = await mobileadapterHandler.normalize(
        { adapter: 'mobile-tab', props: JSON.stringify({ type: 'navigation', destination: 'feed', tabGroup: 'main' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.action).toBe('switchTab');
      expect(normalized.tab).toBe('main');
    });
  });

  describe('DesktopAdapter', () => {
    it('normalizes navigation props for desktop (focus window)', async () => {
      const storage = createInMemoryStorage();
      const result = await desktopadapterHandler.normalize(
        { adapter: 'desktop-nav', props: JSON.stringify({ type: 'navigation', destination: 'settings', windowConfig: { reuse: true } }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.platform).toBe('desktop');
      expect(normalized.action).toBe('focusWindow');
    });

    it('normalizes new window creation for desktop', async () => {
      const storage = createInMemoryStorage();
      const result = await desktopadapterHandler.normalize(
        { adapter: 'desktop-win', props: JSON.stringify({ type: 'navigation', destination: 'editor', windowConfig: { reuse: false, width: 1200, height: 800 } }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.action).toBe('createWindow');
      expect(normalized.width).toBe(1200);
    });
  });

  describe('WatchAdapter', () => {
    it('normalizes navigation props for watch (push page)', async () => {
      const storage = createInMemoryStorage();
      const result = await watchadapterHandler.normalize(
        { adapter: 'watch-nav', props: JSON.stringify({ type: 'navigation', destination: 'notifications' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.platform).toBe('watch');
      expect(normalized.action).toBe('pushPage');
      expect(normalized.fullScreen).toBe(true);
    });

    it('normalizes overlay as haptic alert for watch', async () => {
      const storage = createInMemoryStorage();
      const result = await watchadapterHandler.normalize(
        { adapter: 'watch-alert', props: JSON.stringify({ type: 'overlay', overlay: 'alert' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.action).toBe('hapticAlert');
      expect(normalized.hapticType).toBe('notification');
    });
  });

  describe('TerminalAdapter', () => {
    it('normalizes navigation props for terminal (switch screen)', async () => {
      const storage = createInMemoryStorage();
      const result = await terminaladapterHandler.normalize(
        { adapter: 'term-nav', props: JSON.stringify({ type: 'navigation', destination: 'articles' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.platform).toBe('terminal');
      expect(normalized.action).toBe('switchScreen');
      expect(normalized.clearBuffer).toBe(true);
    });

    it('normalizes escape event for terminal', async () => {
      const storage = createInMemoryStorage();
      const result = await terminaladapterHandler.normalize(
        { adapter: 'term-event', props: JSON.stringify({ type: 'event', event: 'escape' }) },
        storage,
      );
      expect(result.variant).toBe('ok');
      const normalized = JSON.parse(result.normalized as string);
      expect(normalized.action).toBe('navigateBack');
      expect(normalized.source).toBe('escape');
    });
  });

  describe('Platform Shell Files', () => {
    const platformDir = resolve(__dirname, '..', 'examples', 'conduit', 'platforms');

    const shells = [
      ['browser/platform.ts', 'BrowserAdapter'],
      ['terminal/cli.ts', 'TerminalAdapter'],
      ['desktop/main.ts', 'DesktopAdapter'],
      ['mobile/app.ts', 'MobileAdapter'],
      ['watch/app.ts', 'WatchAdapter'],
    ];

    for (const [file, adapterName] of shells) {
      it(`${file} exists and references ${adapterName}`, () => {
        const path = resolve(platformDir, file);
        expect(existsSync(path), `${file} should exist`).toBe(true);
      });
    }
  });
});
