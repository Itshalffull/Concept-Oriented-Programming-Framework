// Test Suite Deploy Manifests — Validation Test
//
// Validates that the 3 deploy manifests (local, docker-compose, remote)
// parse correctly and pass deployment validation per Section 8.1.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  parseDeploymentManifest,
  validateDeploymentManifest,
} from '../../../../handlers/ts/framework/deployment-validator.handler.js';

const DEPLOY_DIR = resolve(__dirname, '..', '..', 'deploy');

const DEPLOY_TARGETS = ['local', 'docker-compose', 'remote'];

const REQUIRED_CONCEPTS = [
  'Conformance',
  'ContractTest',
  'FlakyTest',
  'Snapshot',
  'TestSelection',
];

const REQUIRED_SYNCS = [
  'compare-snapshot-after-emit.sync',
  'regenerate-conformance-on-spec-change.sync',
  'analyze-tests-on-change.sync',
  'record-test-result.sync',
  'update-coverage-mappings.sync',
  'verify-conformance-after-build.sync',
  'verify-contracts-after-multi-build.sync',
  'check-quarantine-on-failure.sync',
  'run-selected-tests.sync',
  'check-contracts-before-deploy.sync',
  'check-conformance-before-deploy.sync',
];

const BUILD_LANGUAGES = ['typescript', 'rust', 'swift', 'solidity'];

describe('Test Suite Deploy Manifests — Validation', () => {
  for (const target of DEPLOY_TARGETS) {
    describe(`${target}.deploy.yaml`, () => {
      const filePath = resolve(DEPLOY_DIR, `${target}.deploy.yaml`);

      it('manifest file exists and is non-empty', () => {
        const content = readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
      });

      it('parses as valid YAML with required top-level keys', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        expect(raw).toHaveProperty('app');
        expect(raw).toHaveProperty('runtimes');
        expect(raw).toHaveProperty('concepts');
        expect(raw).toHaveProperty('syncs');
        expect(raw).toHaveProperty('build');
      });

      it('parseDeploymentManifest succeeds without exceptions', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        const manifest = parseDeploymentManifest(raw);

        expect(manifest.app.name).toBe('test');
        expect(manifest.app.version).toBe('0.1.0');
        expect(manifest.app.uri).toBe('urn:clef/test');
      });

      it('validateDeploymentManifest returns valid: true with no errors', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        const manifest = parseDeploymentManifest(raw);

        // Build syncConceptRefs — map each sync path to all concept names
        const syncConceptRefs: Record<string, string[]> = {};
        for (const sync of manifest.syncs) {
          syncConceptRefs[sync.path] = Object.keys(manifest.concepts);
        }

        // No special capability requirements for test concepts
        const conceptCapabilities: Record<string, string[]> = {};
        for (const name of Object.keys(manifest.concepts)) {
          conceptCapabilities[name] = [];
        }

        const result = validateDeploymentManifest(
          manifest,
          Object.keys(manifest.concepts).map(c => `urn:clef/test/${c}`),
          syncConceptRefs,
          conceptCapabilities,
        );

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.plan).not.toBeNull();
      });

      it('deployment plan has 5 concept placements', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        const manifest = parseDeploymentManifest(raw);

        const syncConceptRefs: Record<string, string[]> = {};
        for (const sync of manifest.syncs) {
          syncConceptRefs[sync.path] = Object.keys(manifest.concepts);
        }

        const conceptCapabilities: Record<string, string[]> = {};
        for (const name of Object.keys(manifest.concepts)) {
          conceptCapabilities[name] = [];
        }

        const result = validateDeploymentManifest(
          manifest,
          Object.keys(manifest.concepts).map(c => `urn:clef/test/${c}`),
          syncConceptRefs,
          conceptCapabilities,
        );

        expect(result.plan!.conceptPlacements).toHaveLength(5);
      });

      it('deployment plan has 11 sync assignments', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        const manifest = parseDeploymentManifest(raw);

        const syncConceptRefs: Record<string, string[]> = {};
        for (const sync of manifest.syncs) {
          syncConceptRefs[sync.path] = Object.keys(manifest.concepts);
        }

        const conceptCapabilities: Record<string, string[]> = {};
        for (const name of Object.keys(manifest.concepts)) {
          conceptCapabilities[name] = [];
        }

        const result = validateDeploymentManifest(
          manifest,
          Object.keys(manifest.concepts).map(c => `urn:clef/test/${c}`),
          syncConceptRefs,
          conceptCapabilities,
        );

        expect(result.plan!.syncAssignments).toHaveLength(11);
      });

      it('references all 5 concepts', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        const manifest = parseDeploymentManifest(raw);

        for (const concept of REQUIRED_CONCEPTS) {
          expect(
            manifest.concepts,
            `${target} should include concept ${concept}`,
          ).toHaveProperty(concept);
        }
      });

      it('references all 11 syncs', () => {
        const content = readFileSync(filePath, 'utf-8');
        for (const sync of REQUIRED_SYNCS) {
          expect(content, `${target} should reference ${sync}`).toContain(sync);
        }
      });

      it('build section is parsed with language configurations', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        const manifest = parseDeploymentManifest(raw);

        expect(manifest.build).toBeDefined();
        expect(manifest.build).toHaveProperty('typescript');
      });

      it('declares 4 language build configs', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        const manifest = parseDeploymentManifest(raw);

        const languages = Object.keys(manifest.build!);
        expect(languages).toHaveLength(4);
        for (const lang of BUILD_LANGUAGES) {
          expect(languages, `build should include ${lang}`).toContain(lang);
        }
      });

      it('each language has testRunner and testPath', () => {
        const content = readFileSync(filePath, 'utf-8');
        const raw = parseYaml(content);
        const manifest = parseDeploymentManifest(raw);

        for (const [language, config] of Object.entries(manifest.build!)) {
          expect(config.testRunner, `${language} should have testRunner`).toBeTruthy();
          expect(config.testPath, `${language} should have testPath`).toBeTruthy();
          expect(config.testTypes.length, `${language} should have testTypes`).toBeGreaterThan(0);
        }
      });
    });
  }

  describe('Supporting Infrastructure Files', () => {
    const files: [string, string][] = [
      ['docker-compose.yaml', 'services:'],
      ['Dockerfile', 'FROM'],
      ['.env.example', 'PORT='],
    ];

    for (const [file, expectedContent] of files) {
      it(`${file} exists and has expected content`, () => {
        const filePath = resolve(DEPLOY_DIR, file);
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain(expectedContent);
      });
    }
  });
});
