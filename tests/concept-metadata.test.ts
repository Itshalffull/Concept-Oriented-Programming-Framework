// ============================================================
// Concept Metadata Extensions Tests
//
// Tests:
// 1. @category annotation parsing
// 2. @visibility annotation parsing
// 3. Action-level description { } block parsing
// 4. Annotations combined with @gate and @version
// 5. SchemaGen propagation: category, visibility → ConceptManifest
// 6. SchemaGen propagation: action description → ActionSchema
//
// See Architecture doc Sections 3.2, 10.1.
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { createInMemoryStorage } from '../kernel/src/index.js';
import type { ConceptManifest } from '../kernel/src/types.js';

// ============================================================
// Test Data
// ============================================================

const CATEGORIZED_CONCEPT = `
@category("devtools")
concept SpecParser [S] {
  purpose {
    Parse concept specification files into a structured AST
    for downstream processing by SchemaGen and code generators.
  }

  state {
    specs: set S
    source: S -> String
  }

  actions {
    action parse(source: String) {
      -> ok(ast: String) {
        Successfully parsed the concept specification.
      }
      -> error(message: String) {
        The specification contains syntax errors.
      }
    }
  }
}
`;

const VISIBILITY_CONCEPT = `
@visibility("framework")
concept InternalHelper [H] {
  purpose {
    An internal utility concept not exposed to end users.
  }

  state {
    items: set H
    data: H -> String
  }

  actions {
    action process(input: String) {
      -> ok(result: String) {
        Processed successfully.
      }
    }
  }
}
`;

const FULLY_ANNOTATED_CONCEPT = `
@gate
@category("blockchain")
@visibility("public")
concept ChainWatcher [W] {
  @version(3)
  purpose {
    Monitor blockchain transactions and gate downstream actions
    until finality conditions are met.
  }

  state {
    watchers: set W
    txHash: W -> String
    status: W -> String
  }

  actions {
    action awaitFinality(txHash: String, level: String) {
      description {
        Subscribe to a blockchain transaction and wait until it
        reaches the specified finality level before completing.
      }
      -> ok(chain: String, block: Int, confirmations: Int) {
        The transaction has reached the required finality level.
      }
      -> timeout(txHash: String) {
        The transaction did not reach finality within the timeout.
      }
    }

    action cancel(watcher: W) {
      -> ok(watcher: W) {
        Cancelled the watcher subscription.
      }
    }
  }
}
`;

const ACTION_DESCRIPTION_CONCEPT = `
concept TaskRunner [T] {
  purpose {
    Execute and track background tasks.
  }

  state {
    tasks: set T
    status: T -> String
    result: T -> String
  }

  actions {
    action run(command: String) {
      description {
        Execute a shell command as a background task. The command
        runs in a sandboxed environment with limited permissions.
        Returns a task reference for tracking progress.
      }
      -> ok(task: T, pid: Int) {
        Task started successfully.
      }
      -> error(message: String) {
        Failed to start the task.
      }
    }

    action status(task: T) {
      description {
        Check the current execution status of a running task.
      }
      -> running(progress: Int) {
        Task is still executing.
      }
      -> completed(result: String) {
        Task finished.
      }
      -> failed(error: String) {
        Task terminated with an error.
      }
    }

    action stop(task: T) {
      -> ok(task: T) {
        Task stopped.
      }
    }
  }
}
`;

const PLAIN_CONCEPT = `
concept Echo [M] {
  purpose {
    Accept a message and echo it back.
  }

  state {
    messages: set M
    text: M -> String
  }

  actions {
    action send(id: M, text: String) {
      -> ok(id: M, echo: String) {
        Store the message and return the text as-is.
      }
    }
  }
}
`;

// ============================================================
// 1. @category Annotation Parsing
// ============================================================

describe('@category annotation parsing', () => {
  it('parses @category annotation on concept', () => {
    const ast = parseConceptFile(CATEGORIZED_CONCEPT);
    expect(ast.name).toBe('SpecParser');
    expect(ast.annotations).toBeDefined();
    expect(ast.annotations!.category).toBe('devtools');
  });

  it('concepts without @category have no category annotation', () => {
    const ast = parseConceptFile(PLAIN_CONCEPT);
    expect(ast.annotations?.category).toBeUndefined();
  });

  it('@category round-trips through JSON serialization', () => {
    const ast = parseConceptFile(CATEGORIZED_CONCEPT);
    const serialized = JSON.parse(JSON.stringify(ast));
    expect(serialized.annotations.category).toBe('devtools');
  });
});

// ============================================================
// 2. @visibility Annotation Parsing
// ============================================================

describe('@visibility annotation parsing', () => {
  it('parses @visibility annotation on concept', () => {
    const ast = parseConceptFile(VISIBILITY_CONCEPT);
    expect(ast.name).toBe('InternalHelper');
    expect(ast.annotations).toBeDefined();
    expect(ast.annotations!.visibility).toBe('framework');
  });

  it('concepts without @visibility have no visibility annotation', () => {
    const ast = parseConceptFile(PLAIN_CONCEPT);
    expect(ast.annotations?.visibility).toBeUndefined();
  });

  it('@visibility round-trips through JSON serialization', () => {
    const ast = parseConceptFile(VISIBILITY_CONCEPT);
    const serialized = JSON.parse(JSON.stringify(ast));
    expect(serialized.annotations.visibility).toBe('framework');
  });
});

// ============================================================
// 3. Combined Annotations
// ============================================================

describe('combined concept annotations', () => {
  it('parses @gate + @category + @visibility together', () => {
    const ast = parseConceptFile(FULLY_ANNOTATED_CONCEPT);
    expect(ast.name).toBe('ChainWatcher');
    expect(ast.annotations?.gate).toBe(true);
    expect(ast.annotations?.category).toBe('blockchain');
    expect(ast.annotations?.visibility).toBe('public');
  });

  it('preserves @version alongside other annotations', () => {
    const ast = parseConceptFile(FULLY_ANNOTATED_CONCEPT);
    expect(ast.version).toBe(3);
    expect(ast.annotations?.gate).toBe(true);
    expect(ast.annotations?.category).toBe('blockchain');
  });

  it('@category and @visibility without @gate', () => {
    const source = `
@category("infrastructure")
@visibility("internal")
concept CacheStore [C] {
  purpose { Store cached computation results. }
  state {
    entries: set C
    value: C -> String
  }
  actions {
    action put(key: String, value: String) {
      -> ok(key: String) { Stored. }
    }
  }
}
`;
    const ast = parseConceptFile(source);
    expect(ast.annotations?.category).toBe('infrastructure');
    expect(ast.annotations?.visibility).toBe('internal');
    expect(ast.annotations?.gate).toBeUndefined();
  });
});

// ============================================================
// 4. Action-level description { } Block Parsing
// ============================================================

describe('action description block parsing', () => {
  it('parses description block on action', () => {
    const ast = parseConceptFile(ACTION_DESCRIPTION_CONCEPT);
    const runAction = ast.actions.find(a => a.name === 'run');
    expect(runAction).toBeDefined();
    expect(runAction!.description).toBeDefined();
    expect(runAction!.description).toContain('Execute a shell command');
    expect(runAction!.description).toContain('sandboxed environment');
  });

  it('parses description on multiple actions independently', () => {
    const ast = parseConceptFile(ACTION_DESCRIPTION_CONCEPT);
    const runAction = ast.actions.find(a => a.name === 'run');
    const statusAction = ast.actions.find(a => a.name === 'status');
    const stopAction = ast.actions.find(a => a.name === 'stop');

    expect(runAction!.description).toContain('shell command');
    expect(statusAction!.description).toContain('current execution status');
    expect(stopAction!.description).toBeUndefined();
  });

  it('actions without description block have no description field', () => {
    const ast = parseConceptFile(PLAIN_CONCEPT);
    const sendAction = ast.actions.find(a => a.name === 'send');
    expect(sendAction).toBeDefined();
    expect(sendAction!.description).toBeUndefined();
  });

  it('description block coexists with annotations on fully annotated concept', () => {
    const ast = parseConceptFile(FULLY_ANNOTATED_CONCEPT);
    const awaitAction = ast.actions.find(a => a.name === 'awaitFinality');
    expect(awaitAction!.description).toContain('Subscribe to a blockchain transaction');
    expect(awaitAction!.description).toContain('finality level');

    // Action without description still works
    const cancelAction = ast.actions.find(a => a.name === 'cancel');
    expect(cancelAction!.description).toBeUndefined();
  });

  it('description round-trips through JSON serialization', () => {
    const ast = parseConceptFile(ACTION_DESCRIPTION_CONCEPT);
    const serialized = JSON.parse(JSON.stringify(ast));
    const runAction = serialized.actions.find((a: any) => a.name === 'run');
    expect(runAction.description).toContain('Execute a shell command');
  });
});

// ============================================================
// 5. SchemaGen Propagation: category, visibility → ConceptManifest
// ============================================================

describe('SchemaGen metadata propagation', () => {
  it('propagates category to manifest', async () => {
    const ast = parseConceptFile(CATEGORIZED_CONCEPT);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;
    expect(manifest.category).toBe('devtools');
  });

  it('propagates visibility to manifest', async () => {
    const ast = parseConceptFile(VISIBILITY_CONCEPT);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;
    expect(manifest.visibility).toBe('framework');
  });

  it('propagates all annotations to manifest together', async () => {
    const ast = parseConceptFile(FULLY_ANNOTATED_CONCEPT);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;
    expect(manifest.gate).toBe(true);
    expect(manifest.category).toBe('blockchain');
    expect(manifest.visibility).toBe('public');
  });

  it('plain concepts have no category or visibility in manifest', async () => {
    const ast = parseConceptFile(PLAIN_CONCEPT);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;
    expect(manifest.category).toBeUndefined();
    expect(manifest.visibility).toBeUndefined();
  });
});

// ============================================================
// 6. SchemaGen Propagation: action description → ActionSchema
// ============================================================

describe('SchemaGen action description propagation', () => {
  it('propagates action description to ActionSchema', async () => {
    const ast = parseConceptFile(ACTION_DESCRIPTION_CONCEPT);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;

    const runSchema = manifest.actions.find(a => a.name === 'run');
    expect(runSchema).toBeDefined();
    expect(runSchema!.description).toContain('Execute a shell command');
    expect(runSchema!.description).toContain('sandboxed environment');
  });

  it('propagates description only on actions that have it', async () => {
    const ast = parseConceptFile(ACTION_DESCRIPTION_CONCEPT);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    const manifest = result.manifest as ConceptManifest;

    const statusSchema = manifest.actions.find(a => a.name === 'status');
    expect(statusSchema!.description).toContain('current execution status');

    const stopSchema = manifest.actions.find(a => a.name === 'stop');
    expect(stopSchema!.description).toBeUndefined();
  });

  it('actions without description blocks have no description in ActionSchema', async () => {
    const ast = parseConceptFile(PLAIN_CONCEPT);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    const manifest = result.manifest as ConceptManifest;
    const sendSchema = manifest.actions.find(a => a.name === 'send');
    expect(sendSchema!.description).toBeUndefined();
  });

  it('description propagates alongside gate annotation on same concept', async () => {
    const ast = parseConceptFile(FULLY_ANNOTATED_CONCEPT);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    const manifest = result.manifest as ConceptManifest;
    expect(manifest.gate).toBe(true);

    const awaitSchema = manifest.actions.find(a => a.name === 'awaitFinality');
    expect(awaitSchema!.description).toContain('Subscribe to a blockchain transaction');

    const cancelSchema = manifest.actions.find(a => a.name === 'cancel');
    expect(cancelSchema!.description).toBeUndefined();
  });
});
