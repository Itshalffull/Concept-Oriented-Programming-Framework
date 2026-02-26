// Conduit Example App — Desktop Platform Adapter (Electron)
// Wraps the React frontend in an Electron desktop shell.
// Uses the DesktopAdapter concept for native window management.

import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { desktopadapterHandler } from '../../../../generated/surface/typescript/desktopadapter.handler.js';

// Electron main process setup
// In a real Electron app, this would use electron's BrowserWindow.
// Here we demonstrate the DesktopAdapter concept wiring.

async function initDesktopPlatform() {
  const storage = createInMemoryStorage();

  const initResult = await desktopadapterHandler.initialize(
    {
      platform: 'desktop',
      capabilities: ['window-management', 'file-system', 'notifications', 'tray', 'menu'],
      os: process.platform,
      arch: process.arch,
    },
    storage,
  );

  console.log('[DesktopAdapter] Initialized:', initResult.variant);

  // Create main window
  const windowResult = await desktopadapterHandler.createWindow(
    {
      title: 'Conduit — COPF Desktop',
      width: 1200,
      height: 800,
      url: 'http://localhost:3000',
    },
    storage,
  );

  console.log('[DesktopAdapter] Window created:', windowResult.variant);

  // In production, this would launch Electron:
  // const { app, BrowserWindow } = require('electron');
  // app.whenReady().then(() => {
  //   const win = new BrowserWindow({ width: 1200, height: 800 });
  //   win.loadURL('http://localhost:5173'); // Vite dev server for React frontend
  // });

  console.log('[DesktopAdapter] Desktop platform ready');
  console.log('  To run with Electron: npx electron .');
  console.log('  Ensure the React frontend is running on port 5173');
}

// Electron configuration
export const electronConfig = {
  main: 'main.js',
  name: 'Conduit Desktop',
  version: '0.1.0',
  window: {
    width: 1200,
    height: 800,
    title: 'Conduit — COPF Example App',
  },
};

initDesktopPlatform().catch(console.error);
