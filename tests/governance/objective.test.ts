// ============================================================
// Objective Concept Conformance Tests
//
// Tests for governance objectives: creation, progress tracking,
// evaluation, and cancellation.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { objectiveHandler } from '../../handlers/ts/app/governance/objective.handler.js';

describe('Objective Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates an objective', async () => {
      const result = await objectiveHandler.create({
        title: 'Increase participation', description: 'Get more members voting',
        targetDate: '2026-12-31', owner: 'alice',
      }, storage);
      expect(result.variant).toBe('created');
      expect(result.objective).toBeDefined();
    });
  });

  describe('updateProgress', () => {
    it('updates progress on a metric', async () => {
      const obj = await objectiveHandler.create({
        title: 'Test', description: 'Desc', targetDate: '2026-12-31', owner: 'alice',
      }, storage);
      const result = await objectiveHandler.updateProgress({
        objective: obj.objective, metricRef: 'participation', currentValue: 75,
      }, storage);
      expect(result.variant).toBe('updated');
    });
  });

  describe('evaluate', () => {
    it('evaluates an objective', async () => {
      const obj = await objectiveHandler.create({
        title: 'Eval test', description: 'Desc', targetDate: '2026-12-31', owner: 'alice',
      }, storage);
      const result = await objectiveHandler.evaluate({ objective: obj.objective }, storage);
      expect(['achieved', 'missed']).toContain(result.variant);
    });
  });

  describe('cancel', () => {
    it('cancels an objective', async () => {
      const obj = await objectiveHandler.create({
        title: 'Cancel test', description: 'Desc', targetDate: '2026-12-31', owner: 'bob',
      }, storage);
      const result = await objectiveHandler.cancel({
        objective: obj.objective, reason: 'No longer relevant',
      }, storage);
      expect(result.variant).toBe('cancelled');
    });
  });
});
