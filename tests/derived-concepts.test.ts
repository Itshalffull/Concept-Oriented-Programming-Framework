// ============================================================
// Derived Concepts Tests
// Validates: .derived file parsing, annotation sync generation,
// derivedContext tag evaluation, scoped propagation, DAG validation,
// and hierarchical composition.
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseDerivedFile } from '../handlers/ts/framework/derived-parser';
import {
  generateAnnotationSyncs,
  generateAllAnnotationSyncs,
  evaluateAnnotationSyncs,
  buildSyncToDerivedIndex,
  propagateDerivedContext,
} from '../handlers/ts/framework/derived-sync-gen';
import {
  validateCompositionDAG,
  validateDerivedConcept,
  validateAllDerivedConcepts,
} from '../handlers/ts/framework/derived-validator';
import type {
  DerivedAST,
  ConceptAST,
} from '../runtime/types';

// --- Test Fixtures ---

const TRASH_DERIVED = `
derived Trash [T] {

  purpose {
    Allow users to safely delete items with the ability to recover them
    before permanent removal.
  }

  composes {
    Folder [T]
    Label [T]
  }

  syncs {
    required: [trash-delete, trash-restore, trash-empty]
  }

  surface {
    action moveToTrash(item: T) {
      matches: Folder/move(destination: "trash")
    }

    action restore(item: T) {
      matches: Folder/move(source: "trash")
    }

    action empty() {
      matches: Label/bulkRemove(label: "trashed")
    }

    query trashedItems() -> Label/find(label: trashed)
    query trashedAt(item: T) -> Label/getMetadata(item: item, label: trashed)
  }

  principle {
    after moveToTrash(item: x)
    then trashedItems() includes x
    and  restore(item: x)
    then trashedItems() excludes x
  }
}
`;

const TASKBOARD_DERIVED = `
derived TaskBoard [T] {
  purpose {
    Organize tasks into columns with drag-and-drop reordering.
  }

  composes {
    Task [T]
    Column [T]
    DragDrop [T]
  }

  syncs {
    required: [task-column-assignment, drag-reorder]
  }

  surface {
    action addTask(task: T) {
      matches: Task/create
    }

    action moveTask(task: T, column: T) {
      matches: DragDrop/drop
    }
  }

  principle {
    after addTask(task: x)
    then task x appears in default column
    and  moveTask(task: x, column: c)
    then task x appears in column c
  }
}
`;

const PROJECT_MANAGEMENT_DERIVED = `
derived ProjectManagement [T] {
  purpose {
    Coordinate task tracking, scheduling, and resource allocation
    for project delivery.
  }

  composes {
    derived TaskBoard [T]
    Timeline [T]
    ResourceAllocation [T]
  }

  syncs {
    required: [task-timeline-sync, resource-task-binding]
  }

  surface {
    action createTask(task: T) {
      matches: derivedContext "TaskBoard/addTask"
    }

    action scheduleTask(task: T, start: DateTime, end: DateTime) {
      matches: Timeline/schedule
    }

    action assignResource(task: T, resource: T) {
      matches: ResourceAllocation/assign
    }
  }

  principle {
    after createTask(task: x) and scheduleTask(task: x, start: s, end: e)
    then task x appears on timeline between s and e
    and  assignResource(task: x, resource: r)
    then resource r's availability reflects the assignment
  }
}
`;

const REGISTRATION_DERIVED = `
derived Registration [U] {
  purpose {
    Allow new users to create accounts with secure credentials
    and receive an authentication token.
  }

  composes {
    User [U]
    Password [U]
    JWT [U]
    Profile [U]
  }

  syncs {
    required: [registration-flow, login-flow, token-generation]
  }

  surface {
    action register(username: String, password: String, email: String) {
      matches: User/register
    }

    action login(username: String, password: String) {
      matches: Password/check
    }

    query currentUser(token: String) -> JWT/verify(token: token)
    query profile(user: U) -> Profile/get(user: user)
  }

  principle {
    after register(username: "alice", password: "s3cret", email: "a@b.com")
    then login(username: "alice", password: "s3cret") succeeds
    and  currentUser(token: t) returns user alice
  }
}
`;

// --- Parser Tests ---

describe('Derived Concept Parser', () => {

  it('parses the Trash derived concept', () => {
    const ast = parseDerivedFile(TRASH_DERIVED);

    expect(ast.name).toBe('Trash');
    expect(ast.typeParams).toEqual(['T']);
    expect(ast.purpose).toContain('safely delete items');
  });

  it('parses composes section correctly', () => {
    const ast = parseDerivedFile(TRASH_DERIVED);

    expect(ast.composes).toHaveLength(2);
    expect(ast.composes[0]).toEqual({ name: 'Folder', typeParams: ['T'], isDerived: false });
    expect(ast.composes[1]).toEqual({ name: 'Label', typeParams: ['T'], isDerived: false });
  });

  it('parses composes with derived keyword', () => {
    const ast = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);

    expect(ast.composes).toHaveLength(3);
    expect(ast.composes[0]).toEqual({ name: 'TaskBoard', typeParams: ['T'], isDerived: true });
    expect(ast.composes[1]).toEqual({ name: 'Timeline', typeParams: ['T'], isDerived: false });
    expect(ast.composes[2]).toEqual({ name: 'ResourceAllocation', typeParams: ['T'], isDerived: false });
  });

  it('parses syncs section', () => {
    const ast = parseDerivedFile(TRASH_DERIVED);

    expect(ast.syncs.required).toEqual(['trash-delete', 'trash-restore', 'trash-empty']);
  });

  it('parses surface actions with concept/action match', () => {
    const ast = parseDerivedFile(TRASH_DERIVED);

    expect(ast.surface.actions).toHaveLength(3);

    const moveToTrash = ast.surface.actions[0];
    expect(moveToTrash.name).toBe('moveToTrash');
    expect(moveToTrash.params).toHaveLength(1);
    expect(moveToTrash.params[0].name).toBe('item');
    expect(moveToTrash.matches).toEqual({
      type: 'action',
      concept: 'Folder',
      action: 'move',
      fields: { destination: 'trash' },
    });

    const restore = ast.surface.actions[1];
    expect(restore.name).toBe('restore');
    expect(restore.matches).toEqual({
      type: 'action',
      concept: 'Folder',
      action: 'move',
      fields: { source: 'trash' },
    });

    const empty = ast.surface.actions[2];
    expect(empty.name).toBe('empty');
    expect(empty.params).toHaveLength(0);
    expect(empty.matches).toEqual({
      type: 'action',
      concept: 'Label',
      action: 'bulkRemove',
      fields: { label: 'trashed' },
    });
  });

  it('parses surface actions with derivedContext match', () => {
    const ast = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);

    const createTask = ast.surface.actions[0];
    expect(createTask.name).toBe('createTask');
    expect(createTask.matches).toEqual({
      type: 'derivedContext',
      tag: 'TaskBoard/addTask',
    });
  });

  it('parses surface actions without field matches', () => {
    const ast = parseDerivedFile(TASKBOARD_DERIVED);

    const addTask = ast.surface.actions[0];
    expect(addTask.matches).toEqual({
      type: 'action',
      concept: 'Task',
      action: 'create',
    });
  });

  it('parses surface queries', () => {
    const ast = parseDerivedFile(TRASH_DERIVED);

    expect(ast.surface.queries).toHaveLength(2);

    const trashedItems = ast.surface.queries[0];
    expect(trashedItems.name).toBe('trashedItems');
    expect(trashedItems.params).toHaveLength(0);
    expect(trashedItems.target).toEqual({
      concept: 'Label',
      action: 'find',
      args: { label: 'trashed' },
    });

    const trashedAt = ast.surface.queries[1];
    expect(trashedAt.name).toBe('trashedAt');
    expect(trashedAt.params).toHaveLength(1);
    expect(trashedAt.target).toEqual({
      concept: 'Label',
      action: 'getMetadata',
      args: { item: 'item', label: 'trashed' },
    });
  });

  it('parses principle section', () => {
    const ast = parseDerivedFile(TRASH_DERIVED);

    expect(ast.principle).toBeDefined();
    expect(ast.principle!.steps.length).toBeGreaterThan(0);

    const afterStep = ast.principle!.steps[0];
    expect(afterStep.kind).toBe('after');
    expect(afterStep.actionName).toBe('moveToTrash');
    expect(afterStep.args).toEqual({ item: 'x' });
  });

  it('parses Registration derived with multiple type params on params', () => {
    const ast = parseDerivedFile(REGISTRATION_DERIVED);

    expect(ast.name).toBe('Registration');
    expect(ast.typeParams).toEqual(['U']);
    expect(ast.composes).toHaveLength(4);
    expect(ast.surface.actions).toHaveLength(2);
    expect(ast.surface.queries).toHaveLength(2);

    const register = ast.surface.actions[0];
    expect(register.params).toHaveLength(3);
    expect(register.params[0]).toEqual({ name: 'username', type: { kind: 'primitive', name: 'String' } });
  });

  it('parses principle with string literal arguments', () => {
    const ast = parseDerivedFile(REGISTRATION_DERIVED);
    expect(ast.principle).toBeDefined();

    const afterStep = ast.principle!.steps[0];
    expect(afterStep.kind).toBe('after');
    expect(afterStep.actionName).toBe('register');
    expect(afterStep.args).toHaveProperty('username', 'alice');
  });

  it('rejects invalid derived concept syntax', () => {
    expect(() => parseDerivedFile('concept Foo { }')).toThrow();
    expect(() => parseDerivedFile('derived { }')).toThrow();
  });
});

// --- Annotation Sync Generation Tests ---

describe('Annotation Sync Generation', () => {

  it('generates annotation syncs for Trash surface actions', () => {
    const ast = parseDerivedFile(TRASH_DERIVED);
    const syncs = generateAnnotationSyncs(ast);

    expect(syncs).toHaveLength(3);

    // moveToTrash
    const moveSync = syncs[0];
    expect(moveSync.name).toBe('Trash_moveToTrash_context');
    expect(moveSync.annotation).toBe(true);
    expect(moveSync.derivedContextTag).toBe('Trash/moveToTrash');
    expect(moveSync.matchesDerivedContext).toBe(false);
    expect(moveSync.when).toHaveLength(1);
    expect(moveSync.when[0].concept).toBe('urn:clef/Folder');
    expect(moveSync.when[0].action).toBe('move');
    expect(moveSync.when[0].inputFields).toHaveLength(1);
    expect(moveSync.when[0].inputFields[0]).toEqual({
      name: 'destination',
      match: { type: 'literal', value: 'trash' },
    });
    expect(moveSync.then).toHaveLength(0); // No invocations

    // restore
    const restoreSync = syncs[1];
    expect(restoreSync.derivedContextTag).toBe('Trash/restore');

    // empty
    const emptySync = syncs[2];
    expect(emptySync.derivedContextTag).toBe('Trash/empty');
  });

  it('generates derivedContext-matching syncs for derived-of-derived', () => {
    const ast = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);
    const syncs = generateAnnotationSyncs(ast);

    // createTask matches derivedContext "TaskBoard/addTask"
    const createSync = syncs[0];
    expect(createSync.name).toBe('ProjectManagement_createTask_context');
    expect(createSync.matchesDerivedContext).toBe(true);
    expect(createSync.derivedContextMatch).toBe('TaskBoard/addTask');
    expect(createSync.derivedContextTag).toBe('ProjectManagement/createTask');
    expect(createSync.when).toHaveLength(0); // No when pattern for context matchers

    // scheduleTask is a normal action match
    const scheduleSync = syncs[1];
    expect(scheduleSync.matchesDerivedContext).toBe(false);
    expect(scheduleSync.when).toHaveLength(1);
  });

  it('generates all annotation syncs from multiple derived concepts', () => {
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);
    const projectMgmt = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);

    const allSyncs = generateAllAnnotationSyncs([taskBoard, projectMgmt]);
    expect(allSyncs.length).toBe(2 + 3); // TaskBoard has 2 actions, ProjectManagement has 3
  });
});

// --- derivedContext Evaluation Tests ---

describe('derivedContext Tag Evaluation', () => {

  it('evaluates annotation syncs for matching invocation', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const syncs = generateAnnotationSyncs(trash);

    // Folder/move with destination: "trash" should get Trash/moveToTrash tag
    const tags = evaluateAnnotationSyncs(
      syncs,
      'urn:clef/Folder', 'move',
      { item: 'doc-1', destination: 'trash' },
    );

    expect(tags).toContain('Trash/moveToTrash');
  });

  it('does not tag non-matching invocations', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const syncs = generateAnnotationSyncs(trash);

    // Folder/move without destination: "trash" should NOT match
    const tags = evaluateAnnotationSyncs(
      syncs,
      'urn:clef/Folder', 'move',
      { item: 'doc-1', destination: 'archive' },
    );

    expect(tags).not.toContain('Trash/moveToTrash');
  });

  it('matches restore action correctly', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const syncs = generateAnnotationSyncs(trash);

    const tags = evaluateAnnotationSyncs(
      syncs,
      'urn:clef/Folder', 'move',
      { item: 'doc-1', source: 'trash' },
    );

    expect(tags).toContain('Trash/restore');
    expect(tags).not.toContain('Trash/moveToTrash'); // Different match fields
  });

  it('performs fixed-point evaluation for derived-of-derived', () => {
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);
    const projectMgmt = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);

    const allSyncs = generateAllAnnotationSyncs([taskBoard, projectMgmt]);

    // Task/create should first get TaskBoard/addTask, then ProjectManagement/createTask
    const tags = evaluateAnnotationSyncs(
      allSyncs,
      'urn:clef/Task', 'create',
      { task: 'task-1' },
    );

    expect(tags).toContain('TaskBoard/addTask');
    expect(tags).toContain('ProjectManagement/createTask');
  });

  it('preserves existing context during evaluation', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const syncs = generateAnnotationSyncs(trash);

    const tags = evaluateAnnotationSyncs(
      syncs,
      'urn:clef/Folder', 'move',
      { item: 'doc-1', destination: 'trash' },
      ['ExistingContext/tag'],
    );

    expect(tags).toContain('ExistingContext/tag');
    expect(tags).toContain('Trash/moveToTrash');
  });
});

// --- Scoped Propagation Tests ---

describe('Scoped derivedContext Propagation', () => {

  it('builds sync-to-derived index correctly', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);

    const index = buildSyncToDerivedIndex([trash, taskBoard]);

    expect(index.get('trash-delete')).toEqual(new Set(['Trash']));
    expect(index.get('trash-restore')).toEqual(new Set(['Trash']));
    expect(index.get('task-column-assignment')).toEqual(new Set(['TaskBoard']));
  });

  it('propagates tags through claimed syncs', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const index = buildSyncToDerivedIndex([trash]);

    // Parent flow has Trash/moveToTrash context
    // trash-delete sync is claimed by Trash — should propagate
    const propagated = propagateDerivedContext(
      ['Trash/moveToTrash'],
      'trash-delete',
      index,
    );

    expect(propagated).toContain('Trash/moveToTrash');
  });

  it('stops propagation at unclaimed syncs', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const index = buildSyncToDerivedIndex([trash]);

    // search-index-update is NOT in Trash's syncs — should NOT propagate
    const propagated = propagateDerivedContext(
      ['Trash/moveToTrash'],
      'search-index-update',
      index,
    );

    expect(propagated).toHaveLength(0);
  });

  it('propagates selectively when multiple derived concepts active', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);
    const index = buildSyncToDerivedIndex([trash, taskBoard]);

    // Both tags active, but task-column-assignment only claimed by TaskBoard
    const propagated = propagateDerivedContext(
      ['Trash/moveToTrash', 'TaskBoard/addTask'],
      'task-column-assignment',
      index,
    );

    expect(propagated).toContain('TaskBoard/addTask');
    expect(propagated).not.toContain('Trash/moveToTrash');
  });

  it('returns empty for no parent context', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);
    const index = buildSyncToDerivedIndex([trash]);

    const propagated = propagateDerivedContext([], 'trash-delete', index);
    expect(propagated).toHaveLength(0);
  });

  it('handles sync claimed by multiple derived concepts', () => {
    // Create two derived concepts that both claim the same sync
    const dc1: DerivedAST = {
      name: 'DC1',
      typeParams: ['T'],
      composes: [{ name: 'A', typeParams: ['T'], isDerived: false }],
      syncs: { required: ['shared-sync'] },
      surface: { actions: [], queries: [] },
    };
    const dc2: DerivedAST = {
      name: 'DC2',
      typeParams: ['T'],
      composes: [{ name: 'B', typeParams: ['T'], isDerived: false }],
      syncs: { required: ['shared-sync'] },
      surface: { actions: [], queries: [] },
    };

    const index = buildSyncToDerivedIndex([dc1, dc2]);
    expect(index.get('shared-sync')?.size).toBe(2);

    // Both tags should propagate through the shared sync
    const propagated = propagateDerivedContext(
      ['DC1/action', 'DC2/action'],
      'shared-sync',
      index,
    );

    expect(propagated).toContain('DC1/action');
    expect(propagated).toContain('DC2/action');
  });
});

// --- DAG Validation Tests ---

describe('Derived Concept DAG Validation', () => {

  it('validates acyclic composition', () => {
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);
    const projectMgmt = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);

    const messages = validateCompositionDAG([taskBoard, projectMgmt]);
    expect(messages).toHaveLength(0);
  });

  it('detects simple cycle', () => {
    const a: DerivedAST = {
      name: 'A',
      typeParams: [],
      composes: [{ name: 'B', typeParams: [], isDerived: true }],
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };
    const b: DerivedAST = {
      name: 'B',
      typeParams: [],
      composes: [{ name: 'A', typeParams: [], isDerived: true }],
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };

    const messages = validateCompositionDAG([a, b]);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].severity).toBe('error');
    expect(messages[0].message).toContain('Cycle');
  });

  it('detects transitive cycle', () => {
    const a: DerivedAST = {
      name: 'A',
      typeParams: [],
      composes: [{ name: 'B', typeParams: [], isDerived: true }],
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };
    const b: DerivedAST = {
      name: 'B',
      typeParams: [],
      composes: [{ name: 'C', typeParams: [], isDerived: true }],
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };
    const c: DerivedAST = {
      name: 'C',
      typeParams: [],
      composes: [{ name: 'A', typeParams: [], isDerived: true }],
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };

    const messages = validateCompositionDAG([a, b, c]);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].severity).toBe('error');
  });

  it('allows non-derived composition of same concept', () => {
    const a: DerivedAST = {
      name: 'A',
      typeParams: [],
      composes: [{ name: 'Shared', typeParams: [], isDerived: false }],
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };
    const b: DerivedAST = {
      name: 'B',
      typeParams: [],
      composes: [{ name: 'Shared', typeParams: [], isDerived: false }],
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };

    const messages = validateCompositionDAG([a, b]);
    expect(messages).toHaveLength(0);
  });
});

// --- Validation Tests ---

describe('Derived Concept Validation', () => {

  it('validates a well-formed derived concept', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);

    const folderConcept: ConceptAST = {
      name: 'Folder',
      typeParams: ['T'],
      state: [],
      actions: [{ name: 'move', params: [], variants: [] }],
      invariants: [],
      capabilities: [],
    };

    const labelConcept: ConceptAST = {
      name: 'Label',
      typeParams: ['T'],
      state: [],
      actions: [
        { name: 'bulkRemove', params: [], variants: [] },
        { name: 'find', params: [], variants: [] },
        { name: 'getMetadata', params: [], variants: [] },
      ],
      invariants: [],
      capabilities: [],
    };

    const messages = validateDerivedConcept(
      trash,
      (name) => ({ Folder: folderConcept, Label: labelConcept }[name]),
      () => undefined,
      (name) => ['trash-delete', 'trash-restore', 'trash-empty'].includes(name),
    );

    const errors = messages.filter(m => m.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('warns when composed concept not found', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);

    const messages = validateDerivedConcept(
      trash,
      () => undefined, // No concepts found
      () => undefined,
      () => true,
    );

    const warnings = messages.filter(m => m.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('errors on type param mismatch', () => {
    const trash = parseDerivedFile(TRASH_DERIVED);

    // Folder has no type params — mismatch with Trash's [T]
    const folderConcept: ConceptAST = {
      name: 'Folder',
      typeParams: [], // Mismatch!
      state: [],
      actions: [],
      invariants: [],
      capabilities: [],
    };

    const messages = validateDerivedConcept(
      trash,
      (name) => (name === 'Folder' ? folderConcept : undefined),
      () => undefined,
      () => true,
    );

    const errors = messages.filter(m => m.severity === 'error');
    expect(errors.some(e => e.message.includes('Type parameter count mismatch'))).toBe(true);
  });

  it('validates derivedContext references', () => {
    const pm = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);

    const messages = validateDerivedConcept(
      pm,
      () => undefined,
      (name) => (name === 'TaskBoard' ? taskBoard : undefined),
      () => true,
    );

    // Should not error because TaskBoard is in composes and has addTask action
    const contextErrors = messages.filter(m =>
      m.severity === 'error' && m.message.includes('derivedContext'),
    );
    expect(contextErrors).toHaveLength(0);
  });

  it('errors on invalid derivedContext tag format', () => {
    const dc: DerivedAST = {
      name: 'Bad',
      typeParams: [],
      composes: [],
      syncs: { required: [] },
      surface: {
        actions: [{
          name: 'badAction',
          params: [],
          matches: { type: 'derivedContext', tag: 'invalid-no-slash' },
        }],
        queries: [],
      },
    };

    const messages = validateDerivedConcept(
      dc,
      () => undefined,
      () => undefined,
      () => true,
    );

    expect(messages.some(m => m.severity === 'error' && m.message.includes('invalid derivedContext tag format'))).toBe(true);
  });

  it('errors on undeclared type parameter in composes', () => {
    const dc: DerivedAST = {
      name: 'Bad',
      typeParams: ['T'],
      composes: [{ name: 'Foo', typeParams: ['U'], isDerived: false }], // U not declared
      syncs: { required: [] },
      surface: { actions: [], queries: [] },
    };

    const messages = validateDerivedConcept(
      dc,
      () => undefined,
      () => undefined,
      () => true,
    );

    expect(messages.some(m => m.severity === 'error' && m.message.includes("Type parameter 'U'"))).toBe(true);
  });

  it('validates all derived concepts together', () => {
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);
    const projectMgmt = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);

    const result = validateAllDerivedConcepts(
      [taskBoard, projectMgmt],
      () => undefined,
      () => true,
    );

    // Should be valid overall (warnings are OK, errors are not)
    expect(result.valid).toBe(true);
  });
});

// --- Hierarchical Composition Tests ---

describe('Hierarchical Derived Concept Composition', () => {

  it('builds nested annotation tags for three-level hierarchy', () => {
    // Level 1: TaskBoard wraps Task/create
    // Level 2: ProjectManagement wraps TaskBoard/addTask
    // When Task/create fires, it should get both tags

    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);
    const projectMgmt = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);

    const allSyncs = generateAllAnnotationSyncs([taskBoard, projectMgmt]);

    const tags = evaluateAnnotationSyncs(
      allSyncs,
      'urn:clef/Task', 'create',
      {},
    );

    // Should have both tags from fixed-point evaluation
    expect(tags).toContain('TaskBoard/addTask');
    expect(tags).toContain('ProjectManagement/createTask');
  });

  it('does not cross-contaminate unrelated derived concepts', () => {
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);
    const trash = parseDerivedFile(TRASH_DERIVED);

    const allSyncs = generateAllAnnotationSyncs([taskBoard, trash]);

    // Folder/move with destination "trash" should only get Trash tag, not TaskBoard
    const trashTags = evaluateAnnotationSyncs(
      allSyncs,
      'urn:clef/Folder', 'move',
      { destination: 'trash' },
    );

    expect(trashTags).toContain('Trash/moveToTrash');
    expect(trashTags).not.toContain('TaskBoard/addTask');

    // Task/create should only get TaskBoard tag, not Trash
    const taskTags = evaluateAnnotationSyncs(
      allSyncs,
      'urn:clef/Task', 'create',
      { task: 'task-1' },
    );

    expect(taskTags).toContain('TaskBoard/addTask');
    expect(taskTags).not.toContain('Trash/moveToTrash');
  });

  it('hierarchical scoping isolates propagation boundaries', () => {
    const taskBoard = parseDerivedFile(TASKBOARD_DERIVED);
    const projectMgmt = parseDerivedFile(PROJECT_MANAGEMENT_DERIVED);
    const index = buildSyncToDerivedIndex([taskBoard, projectMgmt]);

    // task-column-assignment is claimed by TaskBoard
    // With both tags active, only TaskBoard tag propagates through it
    const propagated = propagateDerivedContext(
      ['TaskBoard/addTask', 'ProjectManagement/createTask'],
      'task-column-assignment',
      index,
    );

    expect(propagated).toContain('TaskBoard/addTask');
    expect(propagated).not.toContain('ProjectManagement/createTask');

    // task-timeline-sync is claimed by ProjectManagement
    const pmPropagated = propagateDerivedContext(
      ['TaskBoard/addTask', 'ProjectManagement/createTask'],
      'task-timeline-sync',
      index,
    );

    expect(pmPropagated).toContain('ProjectManagement/createTask');
    expect(pmPropagated).not.toContain('TaskBoard/addTask');
  });
});

// --- Edge Cases ---

describe('Derived Concept Edge Cases', () => {

  it('handles derived concept with no surface actions', () => {
    const source = `
    derived Empty [T] {
      purpose { An empty derived concept for testing. }
      composes { Foo [T] }
      syncs { required: [some-sync] }
      surface {}
    }`;

    const ast = parseDerivedFile(source);
    expect(ast.surface.actions).toHaveLength(0);
    expect(ast.surface.queries).toHaveLength(0);

    const syncs = generateAnnotationSyncs(ast);
    expect(syncs).toHaveLength(0);
  });

  it('handles derived concept with no syncs', () => {
    const source = `
    derived NoSyncs [T] {
      purpose { A derived concept without syncs. }
      composes { Foo [T] }
      syncs { required: [] }
      surface {
        action doThing(item: T) {
          matches: Foo/bar
        }
      }
    }`;

    const ast = parseDerivedFile(source);
    expect(ast.syncs.required).toHaveLength(0);
  });

  it('handles derived concept with no principle', () => {
    const source = `
    derived NoPrinciple [T] {
      purpose { A derived concept without a principle. }
      composes { Foo [T] }
      syncs { required: [] }
      surface {
        query items() -> Foo/list()
      }
    }`;

    const ast = parseDerivedFile(source);
    expect(ast.principle).toBeUndefined();
  });

  it('handles multiple type parameters', () => {
    const source = `
    derived MultiParam [T, U] {
      purpose { Multi-param test. }
      composes {
        Foo [T]
        Bar [U]
      }
      syncs { required: [] }
      surface {}
    }`;

    const ast = parseDerivedFile(source);
    expect(ast.typeParams).toEqual(['T', 'U']);
    expect(ast.composes[0].typeParams).toEqual(['T']);
    expect(ast.composes[1].typeParams).toEqual(['U']);
  });
});

// --- Premade Derived Concept Round-Trip Tests ---

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

function findDerivedFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDerivedFiles(full));
    } else if (entry.name.endsWith('.derived')) {
      results.push(full);
    }
  }
  return results;
}

describe('Premade Derived Concept Parsing', () => {
  const projectRoot = join(__dirname, '..');
  const searchDirs = [
    join(projectRoot, 'repertoire'),
    join(projectRoot, 'framework'),
    join(projectRoot, 'bind'),
    join(projectRoot, 'score'),
    join(projectRoot, 'surface'),
  ];

  const allDerivedFiles = searchDirs.flatMap(findDerivedFiles);

  it('finds all 33 premade derived concept files', () => {
    expect(allDerivedFiles.length).toBe(33);
  });

  it.each(allDerivedFiles.map(f => [relative(projectRoot, f), f]))(
    'parses %s',
    (_relPath, filePath) => {
      const source = readFileSync(filePath as string, 'utf-8');
      const ast = parseDerivedFile(source);

      // Basic structural assertions
      expect(ast.name).toBeTruthy();
      expect(ast.typeParams.length).toBeGreaterThan(0);
      expect(ast.purpose).toBeTruthy();
      expect(ast.composes.length).toBeGreaterThan(0);
      expect(ast.syncs.required).toBeDefined();
      expect(
        ast.surface.actions.length + ast.surface.queries.length,
      ).toBeGreaterThan(0);
    },
  );

  it('parses hierarchical derived concepts with derivedContext matches', () => {
    const hierarchicalFiles = allDerivedFiles.filter(f => {
      const source = readFileSync(f, 'utf-8');
      return source.includes('derivedContext');
    });

    // ConversationalRAG and AppShell use derivedContext
    expect(hierarchicalFiles.length).toBeGreaterThanOrEqual(2);

    for (const filePath of hierarchicalFiles) {
      const source = readFileSync(filePath, 'utf-8');
      const ast = parseDerivedFile(source);

      // Must have at least one composed derived concept
      const derivedComposes = ast.composes.filter(c => c.isDerived);
      expect(derivedComposes.length).toBeGreaterThan(0);

      // Must have at least one derivedContext surface action
      const contextActions = ast.surface.actions.filter(
        a => a.matches.type === 'derivedContext',
      );
      expect(contextActions.length).toBeGreaterThan(0);
    }
  });

  it('all derived concepts have unique names', () => {
    const names = allDerivedFiles.map(f => {
      const source = readFileSync(f, 'utf-8');
      return parseDerivedFile(source).name;
    });

    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all sync names are kebab-case', () => {
    for (const filePath of allDerivedFiles) {
      const source = readFileSync(filePath, 'utf-8');
      const ast = parseDerivedFile(source);

      for (const syncName of ast.syncs.required) {
        expect(syncName).toMatch(
          /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
        );
      }
    }
  });
});
