// Conduit Example App — Watch Platform Adapter
// Wires the WatchAdapter concept for wearable deployment.
// Supports watchOS (WatchKit) and Wear OS (Wear Compose).

import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { watchadapterHandler } from '../../../../generated/surface/typescript/watchadapter.handler.js';

async function initWatchPlatform() {
  const storage = createInMemoryStorage();

  const initResult = await watchadapterHandler.initialize(
    {
      platform: 'watch',
      capabilities: ['complications', 'haptics', 'digital-crown', 'heart-rate', 'notifications'],
      os: 'watchos', // or 'wearos'
      screenSize: { width: 184, height: 224 }, // Apple Watch 45mm
      alwaysOnDisplay: true,
    },
    storage,
  );

  console.log('[WatchAdapter] Initialized:', initResult.variant);

  // Watch-specific interactions
  const watchEvents = {
    async onComplicationTap(complicationId: string) {
      await watchadapterHandler.onNavigate({ target: complicationId }, storage);
    },
    async onDigitalCrownRotation(delta: number) {
      await watchadapterHandler.onScroll({ delta }, storage);
    },
    async onWristRaise() {
      await watchadapterHandler.onResume({}, storage);
    },
    async onWristDown() {
      await watchadapterHandler.onSuspend({}, storage);
    },
    async onNotification(payload: Record<string, unknown>) {
      await watchadapterHandler.onNotification({ payload }, storage);
    },
  };

  console.log('[WatchAdapter] Watch platform ready');
  console.log('  Features: complications, article glances, favorite from wrist');
  console.log('  To run: use WatchKit (frontend/watchkit/) or Wear Compose (frontend/wear-compose/)');

  return watchEvents;
}

export { initWatchPlatform };

initWatchPlatform().catch(console.error);
