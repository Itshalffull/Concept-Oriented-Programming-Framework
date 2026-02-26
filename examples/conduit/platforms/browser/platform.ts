// Conduit Example App — Browser Platform Adapter
// Wires the BrowserAdapter concept to the React frontend.
// This is the default platform for web deployment.

import { createInMemoryStorage } from '../../../../runtime/adapters/storage.js';
import { browseradapterHandler } from '../../../../generated/surface/typescript/browseradapter.handler.js';

// Browser platform lifecycle
async function initBrowserPlatform() {
  const storage = createInMemoryStorage();

  // Initialize the BrowserAdapter concept
  const initResult = await browseradapterHandler.initialize(
    {
      platform: 'browser',
      capabilities: ['dom', 'fetch', 'localStorage', 'history', 'serviceWorker'],
      viewport: { width: window.innerWidth, height: window.innerHeight },
    },
    storage,
  );

  console.log('[BrowserAdapter] Initialized:', initResult.variant);

  // Handle viewport changes
  window.addEventListener('resize', async () => {
    await browseradapterHandler.onViewportChange(
      { width: window.innerWidth, height: window.innerHeight },
      storage,
    );
  });

  // Handle visibility changes
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      await browseradapterHandler.onSuspend({}, storage);
    } else {
      await browseradapterHandler.onResume({}, storage);
    }
  });

  // Handle navigation (back/forward)
  window.addEventListener('popstate', async () => {
    await browseradapterHandler.onNavigate(
      { url: window.location.hash.slice(1) || '/' },
      storage,
    );
  });

  console.log('[BrowserAdapter] Platform ready — loading React frontend');

  // Dynamically import and mount the React app
  const { mount } = await import('../../frontend/react/main.js');
  if (typeof mount === 'function') {
    mount(document.getElementById('app')!);
  }
}

initBrowserPlatform().catch(console.error);
