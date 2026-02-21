// Conduit Example App — Mobile Platform Adapter
// Wires the MobileAdapter concept for iOS/Android deployment.
// Works with React Native, NativeScript, or any mobile framework.

import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { mobileadapterHandler } from '../../../../generated/concept-interface/typescript/mobileadapter.impl.js';

async function initMobilePlatform() {
  const storage = createInMemoryStorage();

  const initResult = await mobileadapterHandler.initialize(
    {
      platform: 'mobile',
      capabilities: ['touch', 'camera', 'gps', 'push-notifications', 'biometrics', 'haptics'],
      os: 'ios', // or 'android'
      screenSize: { width: 390, height: 844 }, // iPhone 14 dimensions
      safeArea: { top: 47, bottom: 34, left: 0, right: 0 },
    },
    storage,
  );

  console.log('[MobileAdapter] Initialized:', initResult.variant);

  // Handle app lifecycle events
  const lifecycleEvents = {
    async onForeground() {
      await mobileadapterHandler.onResume({}, storage);
    },
    async onBackground() {
      await mobileadapterHandler.onSuspend({}, storage);
    },
    async onOrientationChange(orientation: 'portrait' | 'landscape') {
      await mobileadapterHandler.onViewportChange(
        { orientation, width: orientation === 'portrait' ? 390 : 844, height: orientation === 'portrait' ? 844 : 390 },
        storage,
      );
    },
    async onPushNotification(payload: Record<string, unknown>) {
      await mobileadapterHandler.onNotification({ payload }, storage);
    },
  };

  console.log('[MobileAdapter] Mobile platform ready');
  console.log('  Lifecycle events registered');
  console.log('  To run: use React Native (frontend/react-native/) or NativeScript (frontend/nativescript/)');

  return lifecycleEvents;
}

export { initMobilePlatform };

// Run directly for testing
initMobilePlatform().catch(console.error);
