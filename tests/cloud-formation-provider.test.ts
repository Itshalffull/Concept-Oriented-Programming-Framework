// ============================================================
// CloudFormationProvider Handler Tests
//
// Generate and apply AWS CloudFormation templates from Clef
// deploy plans.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  cloudFormationProviderHandler,
  resetCloudFormationProviderCounter,
} from '../handlers/ts/cloud-formation-provider.handler.js';

describe('CloudFormationProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetCloudFormationProviderCounter();
  });

  describe('generate', () => {
    it('generates a CloudFormation template', async () => {
      const result = await cloudFormationProviderHandler.generate!(
        { plan: 'myapp' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.stack).toBe('cloud-formation-provider-1');
      expect(result.files).toContain('clef-myapp-template.yaml');
    });

    it('stores stack metadata in storage', async () => {
      await cloudFormationProviderHandler.generate!(
        { plan: 'staging' },
        storage,
      );
      const stored = await storage.get('cloud-formation-provider', 'cloud-formation-provider-1');
      expect(stored).not.toBeNull();
      expect(stored!.stackName).toBe('clef-staging');
      expect(stored!.stackStatus).toBe('NOT_CREATED');
      expect(stored!.region).toBe('us-east-1');
    });

    it('generates valid CloudFormation template JSON', async () => {
      await cloudFormationProviderHandler.generate!(
        { plan: 'test' },
        storage,
      );
      const stored = await storage.get('cloud-formation-provider', 'cloud-formation-provider-1');
      const template = JSON.parse(stored!.templateContent as string);
      expect(template.AWSTemplateFormatVersion).toBe('2010-09-09');
      expect(template.Resources.CopfResourceGroup).toBeDefined();
    });
  });

  describe('preview', () => {
    it('creates a change set for an existing stack', async () => {
      await cloudFormationProviderHandler.generate!(
        { plan: 'test' },
        storage,
      );
      const result = await cloudFormationProviderHandler.preview!(
        { stack: 'cloud-formation-provider-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.changeSetId).toBeDefined();
      expect(result.toCreate).toBe(1);
      expect(result.toUpdate).toBe(0);
      expect(result.toDelete).toBe(0);
    });

    it('returns changeSetEmpty for non-existent stack', async () => {
      const result = await cloudFormationProviderHandler.preview!(
        { stack: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('changeSetEmpty');
    });
  });

  describe('apply', () => {
    it('applies the stack and transitions to CREATE_COMPLETE', async () => {
      await cloudFormationProviderHandler.generate!(
        { plan: 'test' },
        storage,
      );
      const result = await cloudFormationProviderHandler.apply!(
        { stack: 'cloud-formation-provider-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.stackId).toBeDefined();
      expect(result.created).toContain('CopfResourceGroup');

      // Verify status update
      const stored = await storage.get('cloud-formation-provider', 'cloud-formation-provider-1');
      expect(stored!.stackStatus).toBe('CREATE_COMPLETE');
    });

    it('returns rollbackComplete for non-existent stack', async () => {
      const result = await cloudFormationProviderHandler.apply!(
        { stack: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('rollbackComplete');
    });
  });

  describe('teardown', () => {
    it('tears down a stack and deletes resources', async () => {
      await cloudFormationProviderHandler.generate!(
        { plan: 'test' },
        storage,
      );
      const result = await cloudFormationProviderHandler.teardown!(
        { stack: 'cloud-formation-provider-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.destroyed).toContain('CopfResourceGroup');

      // Verify deletion
      const stored = await storage.get('cloud-formation-provider', 'cloud-formation-provider-1');
      expect(stored).toBeNull();
    });

    it('returns deletionFailed for non-existent stack', async () => {
      const result = await cloudFormationProviderHandler.teardown!(
        { stack: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('deletionFailed');
    });
  });
});
