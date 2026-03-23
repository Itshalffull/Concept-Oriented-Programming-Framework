// ============================================================
// LLM Agent Suite Tests
//
// Tests:
// 1. Core concept parsing: AgentLoop, StateGraph, AgentMemory,
//    ToolBinding, AgentTeam, AgentRole, Blackboard, AgentHandoff,
//    Consensus, Constitution
// 2. Strategy concept parsing: ReactStrategy, PlanAndExecuteStrategy,
//    TreeOfThoughtStrategy, ReflectionStrategy, CodeActStrategy,
//    ReWOOStrategy
// 3. All 22 sync files parse correctly
// 4. suite.yaml validation
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { parse as parseYaml } from 'yaml';
import type { ConceptAST } from '../runtime/types.js';

const SUITE_DIR = resolve(__dirname, '..', 'repertoire', 'concepts', 'llm-agent');

function readConcept(name: string): string {
  return readFileSync(resolve(SUITE_DIR, `${name}.concept`), 'utf-8');
}

function readStrategy(name: string): string {
  return readFileSync(resolve(SUITE_DIR, 'strategies', `${name}.concept`), 'utf-8');
}

function readSync(name: string): string {
  return readFileSync(resolve(SUITE_DIR, 'syncs', `${name}.sync`), 'utf-8');
}

// ============================================================
// Core Concepts
// ============================================================

describe('AgentLoop concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('agent-loop'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('AgentLoop');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['L']);
  });

  it('has @gate annotation', () => {
    expect(ast.annotations?.gate).toBe(true);
  });

  it('declares 6 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['create', 'run', 'step', 'observe', 'interrupt', 'resume']);
  });

  it('run action has 4 variants', () => {
    const action = ast.actions.find(a => a.name === 'run')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('max_iterations');
    expect(variants).toContain('error');
    expect(variants).toContain('waiting_for_human');
  });

  it('step action has 4 variants', () => {
    const action = ast.actions.find(a => a.name === 'step')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('thought');
    expect(variants).toContain('action_request');
    expect(variants).toContain('final_answer');
    expect(variants).toContain('error');
  });

  it('has state fields', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('agents');
    expect(names).toContain('available_tools');
    expect(names).toContain('max_iterations');
    expect(names).toContain('current_step');
    expect(names).toContain('status');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('StateGraph concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('state-graph'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('StateGraph');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['H']);
  });

  it('has @gate annotation', () => {
    expect(ast.annotations?.gate).toBe(true);
  });

  it('declares at least 13 actions', () => {
    expect(ast.actions.length).toBeGreaterThanOrEqual(13);
    const names = ast.actions.map(a => a.name);
    expect(names).toContain('create');
    expect(names).toContain('addNode');
    expect(names).toContain('addEdge');
    expect(names).toContain('addConditionalEdge');
    expect(names).toContain('setEntryPoint');
    expect(names).toContain('setFinishPoint');
    expect(names).toContain('compile');
    expect(names).toContain('execute');
    expect(names).toContain('checkpoint');
    expect(names).toContain('restore');
    expect(names).toContain('timeTravel');
    expect(names).toContain('fork');
  });

  it('execute has ok, error, and waiting_for_human variants', () => {
    const action = ast.actions.find(a => a.name === 'execute')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('error');
    expect(variants).toContain('waiting_for_human');
  });

  it('has state fields for graph structure', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('graphs');
    expect(names).toContain('nodes');
    expect(names).toContain('edges');
    expect(names).toContain('state_schema');
    expect(names).toContain('checkpoints');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('AgentMemory concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('agent-memory'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('AgentMemory');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['E']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 7 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual([
      'remember', 'recall', 'editWorkingMemory', 'forget',
      'consolidate', 'search', 'getWorkingMemory',
    ]);
  });

  it('has memory state fields', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('entries');
    expect(names).toContain('memory_type');
    expect(names).toContain('content');
    expect(names).toContain('working_memory');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ToolBinding concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('tool-binding'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('ToolBinding');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['T']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 5 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['define', 'invoke', 'toProviderFormat', 'discover', 'search']);
  });

  it('invoke action has 5 variants', () => {
    const action = ast.actions.find(a => a.name === 'invoke')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('validation_error');
    expect(variants).toContain('timeout');
    expect(variants).toContain('execution_error');
    expect(variants).toContain('approval_required');
  });

  it('has tool state fields', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('tools');
    expect(names).toContain('name');
    expect(names).toContain('input_schema');
    expect(names).toContain('annotations');
    expect(names).toContain('requires_approval');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('AgentTeam concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('agent-team'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('AgentTeam');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['M']);
  });

  it('has @gate annotation', () => {
    expect(ast.annotations?.gate).toBe(true);
  });

  it('declares 7 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual([
      'assemble', 'delegate', 'synthesize', 'resolveConflict',
      'addMember', 'removeMember', 'getStatus',
    ]);
  });

  it('has team state fields', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('teams');
    expect(names).toContain('members');
    expect(names).toContain('topology');
    expect(names).toContain('protocol');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('AgentRole concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('agent-role'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('AgentRole');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['K']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 5 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['define', 'bid', 'match', 'recordOutcome', 'getAvailability']);
  });

  it('bid has ok and decline variants', () => {
    const action = ast.actions.find(a => a.name === 'bid')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('decline');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Blackboard concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('blackboard'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('Blackboard');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['B']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 7 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual([
      'create', 'post', 'query', 'subscribe', 'challenge', 'resolve', 'snapshot',
    ]);
  });

  it('has board state fields', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('boards');
    expect(names).toContain('entries');
    expect(names).toContain('entry_schema');
    expect(names).toContain('subscriptions');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('AgentHandoff concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('agent-handoff'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('AgentHandoff');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['D']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 4 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['prepare', 'execute', 'escalate', 'getHistory']);
  });

  it('has handoff state fields', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('handoffs');
    expect(names).toContain('source_agent');
    expect(names).toContain('target_agent');
    expect(names).toContain('context_summary');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Consensus concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('consensus'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('Consensus');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['N']);
  });

  it('has @gate annotation', () => {
    expect(ast.annotations?.gate).toBe(true);
  });

  it('declares at least 6 actions', () => {
    expect(ast.actions.length).toBeGreaterThanOrEqual(6);
    const names = ast.actions.map(a => a.name);
    expect(names).toContain('create');
    expect(names).toContain('vote');
    expect(names).toContain('tally');
    expect(names).toContain('challenge');
    expect(names).toContain('resolve');
  });

  it('has consensus state fields', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('sessions');
    expect(names).toContain('proposal');
    expect(names).toContain('votes');
    expect(names).toContain('method');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Constitution concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readConcept('constitution'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('Constitution');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['W']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 6 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual([
      'create', 'critique', 'revise', 'critiqueAndRevise',
      'addPrinciple', 'removePrinciple',
    ]);
  });

  it('critiqueAndRevise has ok and max_revisions variants', () => {
    const action = ast.actions.find(a => a.name === 'critiqueAndRevise')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('max_revisions');
  });

  it('has constitution state fields', () => {
    const names = ast.state.map(s => s.name);
    expect(names).toContain('constitutions');
    expect(names).toContain('name');
    expect(names).toContain('principles');
  });

  it('has an invariant', () => {
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Strategy Concepts
// ============================================================

describe('ReactStrategy concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readStrategy('react'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('ReactStrategy');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['S']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 4 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['execute', 'stepOnce', 'addObservation', 'getState']);
  });

  it('execute has ok, max_iterations, error variants', () => {
    const action = ast.actions.find(a => a.name === 'execute')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('max_iterations');
    expect(variants).toContain('error');
  });

  it('stepOnce has thought, action_request, final_answer variants', () => {
    const action = ast.actions.find(a => a.name === 'stepOnce')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('thought');
    expect(variants).toContain('action_request');
    expect(variants).toContain('final_answer');
  });

  it('has requires/ensures invariant for addObservation', () => {
    expect(ast.invariants).toHaveLength(1);
    expect(ast.invariants[0].kind).toBe('requires_ensures');
  });
});

describe('PlanAndExecuteStrategy concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readStrategy('plan-and-execute'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('PlanAndExecuteStrategy');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['S']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 4 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['execute', 'plan', 'replan', 'getState']);
  });

  it('has always and requires/ensures invariants', () => {
    expect(ast.invariants).toHaveLength(2);
  });
});

describe('TreeOfThoughtStrategy concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readStrategy('tree-of-thought'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('TreeOfThoughtStrategy');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['S']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 5 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['execute', 'branch', 'evaluate', 'prune', 'getState']);
  });

  it('has always and requires/ensures invariants', () => {
    expect(ast.invariants).toHaveLength(2);
  });
});

describe('ReflectionStrategy concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readStrategy('reflection'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('ReflectionStrategy');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['S']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 4 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['execute', 'critique', 'revise', 'getState']);
  });

  it('execute has ok and max_rounds variants', () => {
    const action = ast.actions.find(a => a.name === 'execute')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('max_rounds');
  });

  it('has requires/ensures invariant for execute', () => {
    expect(ast.invariants).toHaveLength(1);
    expect(ast.invariants[0].kind).toBe('requires_ensures');
  });
});

describe('CodeActStrategy concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readStrategy('code-act'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('CodeActStrategy');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['S']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 4 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['execute', 'generateCode', 'executeCode', 'getState']);
  });

  it('execute has ok, max_iterations, sandbox_error variants', () => {
    const action = ast.actions.find(a => a.name === 'execute')!;
    const variants = action.variants.map(r => r.name);
    expect(variants).toContain('ok');
    expect(variants).toContain('max_iterations');
    expect(variants).toContain('sandbox_error');
  });

  it('has always and requires/ensures invariants', () => {
    expect(ast.invariants).toHaveLength(2);
  });
});

describe('ReWOOStrategy concept', () => {
  let ast: ConceptAST;

  beforeAll(() => {
    ast = parseConceptFile(readStrategy('rewoo'));
  });

  it('parses with correct name and version', () => {
    expect(ast.name).toBe('ReWOOStrategy');
    expect(ast.version).toBe(1);
    expect(ast.typeParams).toEqual(['S']);
  });

  it('is not a gate concept', () => {
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('declares 5 actions', () => {
    const names = ast.actions.map(a => a.name);
    expect(names).toEqual(['execute', 'planCalls', 'executeBatch', 'synthesize', 'getState']);
  });

  it('has always and requires/ensures invariants', () => {
    expect(ast.invariants).toHaveLength(2);
  });
});

// ============================================================
// Sync File Parsing
// ============================================================

describe('llm-agent sync files', () => {
  const syncFiles = [
    'agent-invokes-tool',
    'agent-loop-dispatches-to-strategy',
    'agent-recalls-memory',
    'agent-remembers-step',
    'agent-workflow-provider',
    'blackboard-notifies-subscribers',
    'code-act-routes',
    'consensus-resolves-conflict',
    'constitution-critiques-output',
    'episodic-memory-archive',
    'handoff-packages-context',
    'hitl-notification',
    'memory-consolidation',
    'multi-agent-message-passing',
    'plan-execute-routes',
    'procedural-memory-update',
    'react-routes',
    'reflection-routes',
    'rewoo-routes',
    'team-delegates-via-role',
    'tool-result-feeds-agent',
    'tree-of-thought-routes',
  ];

  it.each(syncFiles)('%s parses without error', (syncName) => {
    const source = readSync(syncName);
    const syncs = parseSyncFile(source);
    expect(syncs).toBeDefined();
    expect(syncs.length).toBeGreaterThanOrEqual(1);
    expect(syncs[0].name).toBeTruthy();
  });

  it('has 22 sync files total', () => {
    expect(syncFiles).toHaveLength(22);
  });
});

// ============================================================
// Suite Manifest
// ============================================================

describe('llm-agent suite.yaml', () => {
  let manifest: any;

  beforeAll(() => {
    const source = readFileSync(resolve(SUITE_DIR, 'suite.yaml'), 'utf-8');
    manifest = parseYaml(source) as any;
  });

  it('has suite metadata', () => {
    expect(manifest.suite.name).toBe('llm-agent');
    expect(manifest.suite.version).toBe('0.1.0');
    expect(manifest.suite.description).toBeTruthy();
  });

  it('lists core concepts', () => {
    expect(manifest.concepts.AgentLoop).toBeDefined();
    expect(manifest.concepts.StateGraph).toBeDefined();
    expect(manifest.concepts.AgentMemory).toBeDefined();
    expect(manifest.concepts.ToolBinding).toBeDefined();
    expect(manifest.concepts.AgentTeam).toBeDefined();
    expect(manifest.concepts.AgentRole).toBeDefined();
    expect(manifest.concepts.Blackboard).toBeDefined();
    expect(manifest.concepts.AgentHandoff).toBeDefined();
    expect(manifest.concepts.Consensus).toBeDefined();
    expect(manifest.concepts.Constitution).toBeDefined();
  });

  it('all referenced concept files exist', () => {
    for (const [, value] of Object.entries(manifest.concepts || {})) {
      const specPath = resolve(SUITE_DIR, (value as any).spec);
      expect(existsSync(specPath)).toBe(true);
    }
  });

  it('all referenced sync files exist', () => {
    const allSyncs = [
      ...(manifest.syncs?.required || []),
      ...(manifest.syncs?.recommended || []),
      ...(manifest.syncs?.integration || []),
      ...(manifest.syncs?.eventual || []),
    ];
    for (const sync of allSyncs) {
      const syncPath = resolve(SUITE_DIR, sync.path);
      expect(existsSync(syncPath)).toBe(true);
    }
  });

  it('has uses declarations', () => {
    expect(manifest.uses).toBeDefined();
    expect(manifest.uses.length).toBeGreaterThanOrEqual(1);
  });
});
