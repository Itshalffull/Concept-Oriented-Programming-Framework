// ============================================================
// LLM Extended Entity Conformance Tests
//
// Validates that extended LLM/agent concepts (AgentHandoff,
// AgentLoop, AgentRole, Blackboard, Constitution, StateGraph,
// DocumentChunk, Retriever, Adapter, etc.) are registered as
// config or content entities with proper Relations.
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

describe('LLM Extended Entity Syncs', () => {
  const llmExtendedSyncs = [
    'agent-handoff-as-content-entity',
    'agent-loop-as-content-entity',
    'agent-role-as-config-entity',
    'agent-team-as-config-entity',
    'blackboard-as-content-entity',
    'consensus-as-content-entity',
    'constitution-as-config-entity',
    'state-graph-as-config-entity',
    'model-router-as-config-entity',
    'semantic-router-as-config-entity',
    'assertion-as-config-entity',
    'few-shot-example-as-config-entity',
    'prompt-assembly-as-config-entity',
    'prompt-optimizer-as-content-entity',
    'llm-signature-as-config-entity',
    'document-chunk-as-content-entity',
    'retriever-as-config-entity',
    'vector-index-as-config-entity',
    'adapter-as-config-entity',
    'evaluation-dataset-as-content-entity',
    'training-run-as-content-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of llmExtendedSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('llm-extended', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('LLM extended entity structure', () => {
    it('DocumentChunkAsContentEntity creates chunk_of Relation', () => {
      const source = readSync('llm-extended', 'document-chunk-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('AdapterAsConfigEntity creates adapts Relation', () => {
      const source = readSync('llm-extended', 'adapter-as-config-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });
});
