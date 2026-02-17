// ============================================================
// Deployment Manifest Tests
//
// Validates deployment manifest parsing and validation rules
// from Section 8.1.
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseDeploymentManifest, validateDeploymentManifest } from '../implementations/typescript/framework/deployment-validator.impl.js';
import type {
  DeploymentManifest,
  ValidationResult,
} from '../implementations/typescript/framework/deployment-validator.impl.js';

// ============================================================
// Deployment Manifest — Parsing & Validation
// ============================================================

describe('Stage 5 — Deployment Manifest', () => {
  const validManifestData: Record<string, unknown> = {
    app: {
      name: 'conduit',
      version: '0.1.0',
      uri: 'urn:conduit',
    },
    runtimes: {
      server: {
        type: 'node',
        engine: true,
        transport: 'in-process',
      },
      ios: {
        type: 'swift',
        engine: true,
        transport: 'websocket',
        upstream: 'server',
      },
    },
    concepts: {
      Password: {
        spec: './specs/password.concept',
        implementations: [
          {
            language: 'typescript',
            path: './server/concepts/password',
            runtime: 'server',
            storage: 'sqlite',
            queryMode: 'graphql',
          },
        ],
      },
      Profile: {
        spec: './specs/profile.concept',
        implementations: [
          {
            language: 'typescript',
            path: './server/concepts/profile',
            runtime: 'server',
            storage: 'postgres',
            queryMode: 'graphql',
          },
          {
            language: 'swift',
            path: './ios/concepts/profile',
            runtime: 'ios',
            storage: 'coredata',
            queryMode: 'lite',
            cacheTtl: 10000,
          },
        ],
      },
    },
    syncs: [
      {
        path: './syncs/auth.sync',
        engine: 'server',
        annotations: ['eager'],
      },
      {
        path: './syncs/profile-sync.sync',
        engine: 'server',
        annotations: ['eventual'],
      },
    ],
  };

  it('parses a valid deployment manifest', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    expect(manifest.app.name).toBe('conduit');
    expect(manifest.app.version).toBe('0.1.0');
    expect(manifest.app.uri).toBe('urn:conduit');

    expect(Object.keys(manifest.runtimes)).toHaveLength(2);
    expect(manifest.runtimes.server.type).toBe('node');
    expect(manifest.runtimes.server.engine).toBe(true);
    expect(manifest.runtimes.ios.upstream).toBe('server');

    expect(Object.keys(manifest.concepts)).toHaveLength(2);
    expect(manifest.concepts.Password.implementations).toHaveLength(1);
    expect(manifest.concepts.Profile.implementations).toHaveLength(2);

    expect(manifest.syncs).toHaveLength(2);
  });

  it('validates a correct manifest', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    const result = validateDeploymentManifest(
      manifest,
      ['urn:app/Password', 'urn:app/Profile'],
      {
        './syncs/auth.sync': ['Password'],
        './syncs/profile-sync.sync': ['Profile'],
      },
      {
        Password: ['crypto'],
        Profile: [],
      },
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.plan).not.toBeNull();
  });

  it('produces a deployment plan with concept placements', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    const result = validateDeploymentManifest(
      manifest,
      ['urn:app/Password', 'urn:app/Profile'],
      {
        './syncs/auth.sync': ['Password'],
        './syncs/profile-sync.sync': ['Profile'],
      },
      { Password: ['crypto'], Profile: [] },
    );

    expect(result.plan!.conceptPlacements).toHaveLength(3); // Password(1) + Profile(2)

    const pwdPlacement = result.plan!.conceptPlacements.find(
      p => p.concept === 'Password',
    )!;
    expect(pwdPlacement.runtime).toBe('server');
    expect(pwdPlacement.language).toBe('typescript');
    expect(pwdPlacement.queryMode).toBe('graphql');

    const profilePlacements = result.plan!.conceptPlacements.filter(
      p => p.concept === 'Profile',
    );
    expect(profilePlacements).toHaveLength(2);
    expect(profilePlacements.map(p => p.language).sort()).toEqual(['swift', 'typescript']);
  });

  it('detects sync assignments and cross-runtime flags', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    const result = validateDeploymentManifest(
      manifest,
      ['urn:app/Password', 'urn:app/Profile'],
      {
        './syncs/auth.sync': ['Password'],
        './syncs/profile-sync.sync': ['Profile'],
      },
      { Password: ['crypto'], Profile: [] },
    );

    const authSync = result.plan!.syncAssignments.find(
      s => s.sync === './syncs/auth.sync',
    )!;
    expect(authSync.engine).toBe('server');
    expect(authSync.crossRuntime).toBe(false); // Password only on server

    const profileSync = result.plan!.syncAssignments.find(
      s => s.sync === './syncs/profile-sync.sync',
    )!;
    expect(profileSync.engine).toBe('server');
    expect(profileSync.crossRuntime).toBe(true); // Profile on server + ios
  });

  it('errors when sync references undefined concept', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    const result = validateDeploymentManifest(
      manifest,
      [],
      {
        './syncs/auth.sync': ['Password'],
        './syncs/missing.sync': ['NonExistent'],
      },
      {},
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('NonExistent'))).toBe(true);
  });

  it('errors when concept requires capability not provided by runtime', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        browser: { type: 'browser', engine: true, transport: 'in-process' },
      },
      concepts: {
        Password: {
          spec: './specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: './browser/password',
            runtime: 'browser',
            storage: 'localstorage',
            queryMode: 'lite',
          }],
        },
      },
      syncs: [],
    });

    const result = validateDeploymentManifest(
      manifest,
      ['urn:app/Password'],
      {},
      { Password: ['crypto'] }, // browser doesn't have crypto
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('crypto'))).toBe(true);
    expect(result.errors.some(e => e.includes('browser'))).toBe(true);
  });

  it('errors when sync assigned to non-engine runtime', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        worker: { type: 'node', engine: false, transport: 'worker' },
      },
      concepts: {},
      syncs: [{
        path: './syncs/test.sync',
        engine: 'worker',
        annotations: [],
      }],
    });

    const result = validateDeploymentManifest(manifest, [], {}, {});

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('engine: true'))).toBe(true);
  });

  it('warns about eager syncs spanning multiple runtimes', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    // auth sync references both Password (server) and Profile (server+ios)
    const result = validateDeploymentManifest(
      manifest,
      [],
      {
        './syncs/auth.sync': ['Password', 'Profile'],
      },
      { Password: ['crypto'], Profile: [] },
    );

    // Should warn about cross-runtime eager sync
    expect(result.warnings.some(w => w.includes('multiple runtimes'))).toBe(true);
  });

  it('errors on missing app fields', () => {
    expect(() => {
      parseDeploymentManifest({ app: { name: 'test' } } as any);
    }).toThrow('app.version');
  });

  it('errors when runtime references undefined upstream', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        ios: { type: 'swift', engine: true, transport: 'websocket', upstream: 'missing-server' },
      },
      concepts: {},
      syncs: [],
    });

    const result = validateDeploymentManifest(manifest, [], {}, {});

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('upstream'))).toBe(true);
  });
});
