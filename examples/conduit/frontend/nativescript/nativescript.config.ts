// Conduit Example App -- NativeScript Configuration

import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'com.clef.conduit.nativescript',
  appPath: '.',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
  },
} as NativeScriptConfig;
