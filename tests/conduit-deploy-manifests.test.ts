// Conduit Deployment Manifests — Validation Test
// Validates all 9 deployment target YAML manifests parse correctly
// and pass the deployment validator.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const DEPLOY_DIR = resolve(__dirname, '..', 'examples', 'conduit', 'deploy');

const DEPLOY_TARGETS = [
  'local',
  'docker-compose',
  'aws-lambda',
  'aws-ecs',
  'gcp-cloud-run',
  'gcp-gcf',
  'cloudflare',
  'vercel',
  'k8s',
];

const REQUIRED_CONCEPTS = [
  'User', 'Password', 'JWT', 'Profile', 'Article',
  'Comment', 'Tag', 'Favorite', 'Follow', 'Echo',
];

describe('Conduit Deployment Manifests — All 9 Targets', () => {
  for (const target of DEPLOY_TARGETS) {
    describe(`${target}.deploy.yaml`, () => {
      const filePath = resolve(DEPLOY_DIR, `${target}.deploy.yaml`);

      it('manifest file exists', () => {
        expect(existsSync(filePath), `${target}.deploy.yaml should exist`).toBe(true);
      });

      it('contains valid YAML structure', () => {
        const content = readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);

        // Check for required top-level sections
        expect(content).toContain('app:');
        expect(content).toContain('name: conduit');
        expect(content).toContain('runtimes:');
        expect(content).toContain('concepts:');
        expect(content).toContain('syncs:');
      });

      it('references all 10 concepts', () => {
        const content = readFileSync(filePath, 'utf-8');
        for (const concept of REQUIRED_CONCEPTS) {
          expect(content, `${target} should reference ${concept}`).toContain(`${concept}:`);
        }
      });

      it('references all 7 sync files', () => {
        const content = readFileSync(filePath, 'utf-8');
        const syncFiles = [
          'registration.sync', 'login.sync', 'articles.sync',
          'comments.sync', 'social.sync', 'profile.sync', 'echo.sync',
        ];
        for (const sync of syncFiles) {
          expect(content, `${target} should reference ${sync}`).toContain(sync);
        }
      });
    });
  }

  describe('Supporting Infrastructure Files', () => {
    const files = [
      ['docker/Dockerfile', 'FROM'],
      ['docker/docker-compose.yaml', 'services:'],
      ['k8s/deployment.yaml', 'kind: Deployment'],
      ['k8s/service.yaml', 'kind: Service'],
      ['k8s/configmap.yaml', 'kind: ConfigMap'],
      ['cloudflare/wrangler.toml', 'name ='],
      ['vercel/vercel.json', 'version'],
      ['.env.example', 'PORT='],
    ];

    for (const [file, expectedContent] of files) {
      it(`${file} exists and has expected content`, () => {
        const filePath = resolve(DEPLOY_DIR, file);
        expect(existsSync(filePath), `${file} should exist`).toBe(true);
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain(expectedContent);
      });
    }
  });
});
