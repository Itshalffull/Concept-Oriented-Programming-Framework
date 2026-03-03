// ============================================================
// Content Entity Conformance Tests — Wave 3
//
// Validates that user-facing concepts (Workflow, View, Group,
// etc.) are properly synced as content/config entities with
// Tags, Properties, and Relations.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseSyncFile } from '../../../../handlers/ts/framework/sync-parser.handler.js';

const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

function readSync(subdir: string, name: string): string {
  const path = resolve(SYNCS_DIR, subdir, `${name}.sync`);
  expect(existsSync(path), `Sync file missing: ${path}`).toBe(true);
  return readFileSync(path, 'utf-8');
}

describe('Wave 3: Content Entity Syncs', () => {
  const contentSyncs = [
    'workflow-definition-as-entity',
    'workflow-state-as-content-attribute',
    'automation-rule-as-entity',
    'view-as-entity',
    'saved-query-as-entity',
    'template-as-content-entity',
    'daily-note-as-content-entity',
    'group-as-content-entity',
    'group-membership-as-relation',
    'flag-as-relation',
    'conversation-as-content-entity',
    'agent-memory-as-content-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of contentSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('content-entities', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('content entity structure', () => {
    it('WorkflowDefinitionAsEntity triggers on Workflow/defineState', () => {
      const source = readSync('content-entities', 'workflow-definition-as-entity');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      expect(mainSync.whenPatterns[0].concept).toBe('Workflow');
      expect(mainSync.whenPatterns[0].action).toBe('defineState');
    });

    it('WorkflowStateAsContentAttribute tracks transitions via Property/set', () => {
      const source = readSync('content-entities', 'workflow-state-as-content-attribute');
      const result = parseSyncFile(source);
      const propertySync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });

    it('AutomationRuleAsEntity creates triggered_by_concept Relation', () => {
      const source = readSync('content-entities', 'automation-rule-as-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('ViewAsEntity creates queries Relation to data source', () => {
      const source = readSync('content-entities', 'view-as-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('GroupMembershipAsRelation triggers on Group/addMember', () => {
      const source = readSync('content-entities', 'group-membership-as-relation');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      expect(mainSync.whenPatterns[0].concept).toBe('Group');
      expect(mainSync.whenPatterns[0].action).toBe('addMember');
    });

    it('FlagAsRelation triggers on Flag/flag', () => {
      const source = readSync('content-entities', 'flag-as-relation');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      expect(mainSync.whenPatterns[0].concept).toBe('Flag');
      expect(mainSync.whenPatterns[0].action).toBe('flag');
    });

    it('AgentMemoryAsContentEntity triggers on AgentMemory/remember', () => {
      const source = readSync('content-entities', 'agent-memory-as-content-entity');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      expect(mainSync.whenPatterns[0].concept).toBe('AgentMemory');
      expect(mainSync.whenPatterns[0].action).toBe('remember');
    });
  });

  describe('entity tagging', () => {
    const taggedSyncs = [
      'workflow-definition-as-entity',
      'automation-rule-as-entity',
      'view-as-entity',
      'saved-query-as-entity',
      'template-as-content-entity',
      'daily-note-as-content-entity',
      'group-as-content-entity',
      'conversation-as-content-entity',
      'agent-memory-as-content-entity',
    ];

    for (const name of taggedSyncs) {
      it(`${name} applies Tag/addTag`, () => {
        const source = readSync('content-entities', name);
        const result = parseSyncFile(source);
        const tagSync = result.syncs.find(s => s.thenActions.some(
          a => a.concept === 'Tag' && a.action === 'addTag',
        ));
        expect(tagSync, `${name} should have a Tag/addTag sync`).toBeDefined();
      });
    }
  });
});
