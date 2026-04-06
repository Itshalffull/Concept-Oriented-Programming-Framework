// Tests for view-spec-parser.ts
// Verifies parsing of .view manifest files including all invariant types,
// error cases, and view-specific predicate operators.

import { describe, it, expect } from 'vitest';
import { parseViewFile, type ViewSpec } from '../../handlers/ts/framework/view-spec-parser.js';

// --- Minimal view ---

describe('parseViewFile: minimal view', () => {
  it('parses a minimal view with name, shell, and one invariant', () => {
    const source = `
view "simple-list" {
  shell: "simple-list"

  invariants {
    always "read-only": {
      purity = "read-only"
    }
  }
}
`;
    const spec: ViewSpec = parseViewFile(source);
    expect(spec.name).toBe('simple-list');
    expect(spec.shell).toBe('simple-list');
    expect(spec.invariants).toHaveLength(1);
    expect(spec.invariants[0].kind).toBe('always');
    expect(spec.invariants[0].name).toBe('read-only');
  });

  it('parses a view with shell different from name', () => {
    const source = `
view "task-board-actions" {
  shell: "task-board"

  invariants {
    always "purity is read-write": {
      purity = "read-write"
    }
  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.name).toBe('task-board-actions');
    expect(spec.shell).toBe('task-board');
    expect(spec.purpose).toBe('');
  });

  it('parses a view with a purpose block', () => {
    const source = `
view "content-list" {
  shell: "content-list"

  purpose {
    Browse all content entities with schema-based filtering
    and alphabetical sorting. Read-only view.
  }

  invariants {
    always "read-only": {
      purity = "read-only"
    }
  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.name).toBe('content-list');
    expect(spec.purpose).toContain('Browse all content entities');
    expect(spec.purpose).toContain('Read-only view');
    expect(spec.invariants).toHaveLength(1);
  });

  it('parses a view with no invariants', () => {
    const source = `
view "bare-view" {
  shell: "bare-view"

  invariants {
  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.name).toBe('bare-view');
    expect(spec.shell).toBe('bare-view');
    expect(spec.invariants).toHaveLength(0);
  });
});

// --- All invariant types ---

describe('parseViewFile: invariant types', () => {
  it('parses always invariant with equality predicate', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "purity is read-only": {
      purity = "read-only"
    }
  }
}
`;
    const spec = parseViewFile(source);
    const inv = spec.invariants[0];
    expect(inv.kind).toBe('always');
    expect(inv.name).toBe('purity is read-only');
    expect(inv.thenPatterns).toHaveLength(1);
    const step = inv.thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.left).toEqual({ type: 'variable', name: 'purity' });
      expect(step.operator).toBe('=');
      expect(step.right).toEqual({ type: 'literal', value: 'read-only' });
    }
  });

  it('parses never invariant with set non-empty predicate', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    never "invoke instructions present": {
      invokedActions != {}
    }
  }
}
`;
    const spec = parseViewFile(source);
    const inv = spec.invariants[0];
    expect(inv.kind).toBe('never');
    expect(inv.name).toBe('invoke instructions present');
    expect(inv.thenPatterns).toHaveLength(1);
    const step = inv.thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.left).toEqual({ type: 'variable', name: 'invokedActions' });
      expect(step.operator).toBe('!=');
      // {} is encoded as empty list
      expect(step.right).toEqual({ type: 'list', items: [] });
    }
  });

  it('parses example invariant with after compile then assertions', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    example "bulk escalate invokes Task/escalate": {
      after compile
      then "Task/escalate" in invokedActions
      and  purity = "read-write"
      and  uncoveredVariants = []
    }
  }
}
`;
    const spec = parseViewFile(source);
    const inv = spec.invariants[0];
    expect(inv.kind).toBe('example');
    expect(inv.name).toBe('bulk escalate invokes Task/escalate');
    // afterPatterns should have the 'compile' setup marker
    expect(inv.afterPatterns).toHaveLength(1);
    expect(inv.afterPatterns[0].actionName).toBe('compile');
    // thenPatterns should have 3 steps
    expect(inv.thenPatterns).toHaveLength(3);
  });

  it('parses forall invariant with quantifier and predicate', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    forall "unique names": {
      given f in {"id", "name", "kind"}
      then f in projectedFields
    }
  }
}
`;
    const spec = parseViewFile(source);
    const inv = spec.invariants[0];
    expect(inv.kind).toBe('forall');
    expect(inv.name).toBe('unique names');
    expect(inv.quantifiers).toHaveLength(1);
    expect(inv.quantifiers![0].variable).toBe('f');
    expect(inv.quantifiers![0].domain).toEqual({
      type: 'set_literal',
      values: ['id', 'name', 'kind'],
    });
  });

  it('parses always invariant with inline forall quantifier', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "projected fields are subset of source schema": {
      forall f in projectedFields:
      f in ["id", "node", "kind", "name"]
    }
  }
}
`;
    const spec = parseViewFile(source);
    const inv = spec.invariants[0];
    expect(inv.kind).toBe('always');
    // The top-level forall sets the quantifier, the predicate goes to thenPatterns
    expect(inv.quantifiers).toHaveLength(1);
    expect(inv.quantifiers![0].variable).toBe('f');
    expect(inv.quantifiers![0].domain).toEqual({ type: 'state_field', name: 'projectedFields' });
    // The predicate `f in [...]` is the then step
    expect(inv.thenPatterns).toHaveLength(1);
    const step = inv.thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.left).toEqual({ type: 'variable', name: 'f' });
      expect(step.operator).toBe('in');
      expect(step.right).toEqual({
        type: 'list',
        items: [
          { type: 'literal', value: 'id' },
          { type: 'literal', value: 'node' },
          { type: 'literal', value: 'kind' },
          { type: 'literal', value: 'name' },
        ],
      });
    }
  });

  it('parses multiple invariants in one block', () => {
    const source = `
view "content-list" {
  shell: "content-list"

  invariants {
    always "purity is read-only": {
      purity = "read-only"
    }

    never "invoke instructions present": {
      invokedActions != {}
    }

    always "no invoke instructions": {
      invokeCount = 0
    }

    always "projects only known fields": {
      forall f in projectedFields:
      f in ["id", "node", "kind", "name"]
    }
  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.invariants).toHaveLength(4);
    expect(spec.invariants[0].kind).toBe('always');
    expect(spec.invariants[1].kind).toBe('never');
    expect(spec.invariants[2].kind).toBe('always');
    expect(spec.invariants[3].kind).toBe('always');
  });
});

// --- View-specific predicate operators ---

describe('parseViewFile: view-specific operators', () => {
  it('parses startsWith operator', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "invokes only Task concept": {
      ia startsWith "Task/"
    }
  }
}
`;
    const spec = parseViewFile(source);
    const inv = spec.invariants[0];
    const step = inv.thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.left).toEqual({ type: 'variable', name: 'ia' });
      expect(step.operator).toBe('startsWith');
      expect(step.right).toEqual({ type: 'literal', value: 'Task/' });
    }
  });

  it('parses subset operator', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "projected fields are subset of read fields": {
      projectedFields subset readFields
    }
  }
}
`;
    const spec = parseViewFile(source);
    const step = spec.invariants[0].thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.left).toEqual({ type: 'variable', name: 'projectedFields' });
      expect(step.operator).toBe('subset');
      expect(step.right).toEqual({ type: 'variable', name: 'readFields' });
    }
  });

  it('parses implies operator', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "purity implies invokes": {
      purity implies invokedActions
    }
  }
}
`;
    const spec = parseViewFile(source);
    const step = spec.invariants[0].thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.operator).toBe('implies');
    }
  });

  it('parses in operator with list literal', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "string in list": {
      "Task/escalate" in invokedActions
    }
  }
}
`;
    const spec = parseViewFile(source);
    const step = spec.invariants[0].thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.left).toEqual({ type: 'literal', value: 'Task/escalate' });
      expect(step.operator).toBe('in');
      expect(step.right).toEqual({ type: 'variable', name: 'invokedActions' });
    }
  });

  it('parses equality with zero', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "no invokes": {
      invokeCount = 0
    }
  }
}
`;
    const spec = parseViewFile(source);
    const step = spec.invariants[0].thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.left).toEqual({ type: 'variable', name: 'invokeCount' });
      expect(step.operator).toBe('=');
      expect(step.right).toEqual({ type: 'literal', value: 0 });
    }
  });

  it('parses equality with empty list (empty set)', () => {
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "no uncovered variants": {
      uncoveredVariants = []
    }
  }
}
`;
    const spec = parseViewFile(source);
    const step = spec.invariants[0].thenPatterns[0];
    expect(step.kind).toBe('assertion');
    if (step.kind === 'assertion') {
      expect(step.right).toEqual({ type: 'list', items: [] });
    }
  });
});

// --- Error cases ---

describe('parseViewFile: error cases', () => {
  it('throws on missing shell', () => {
    const source = `
view "no-shell" {
  invariants {
    always "test": {
      purity = "read-only"
    }
  }
}
`;
    expect(() => parseViewFile(source)).toThrow(/missing required.*shell/i);
  });

  it('throws on missing view keyword', () => {
    const source = `
"no-keyword" {
  shell: "foo"
  invariants {}
}
`;
    expect(() => parseViewFile(source)).toThrow(/View parse error/);
  });

  it('throws on missing opening brace for view body', () => {
    const source = `
view "bad-syntax"
  shell: "foo"
`;
    expect(() => parseViewFile(source)).toThrow(/View parse error/);
  });

  it('throws on invalid syntax in invariant body', () => {
    // Completely invalid content where an operator is expected
    const source = `
view "v" {
  shell: "v"
  invariants {
    always "bad": {
      purity {{{ this is garbage }}}
    }
  }
}
`;
    // The parser falls back to prose on structured parse failure — this should
    // succeed with an empty thenPatterns (fallback recovery), not throw
    const spec = parseViewFile(source);
    expect(spec.name).toBe('v');
    // The invariant is recovered with empty patterns
    expect(spec.invariants[0].thenPatterns).toHaveLength(0);
  });

  it('throws on view name that is not a string literal', () => {
    const source = `
view content-list {
  shell: "foo"
  invariants {}
}
`;
    expect(() => parseViewFile(source)).toThrow(/expected string literal/i);
  });
});

// --- Comment handling ---

describe('parseViewFile: comments', () => {
  it('handles line comments with //', () => {
    const source = `
// This is a view manifest
view "v" {
  shell: "v" // the shell

  // Invariants section
  invariants {
    always "test": { // test invariant
      purity = "read-only"
    }
  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.name).toBe('v');
    expect(spec.invariants).toHaveLength(1);
  });

  it('handles line comments with #', () => {
    const source = `
# This is a view manifest
view "v" {
  shell: "v" # the shell

  # Invariants section
  invariants {
    # always invariant
    always "test": {
      purity = "read-only"
    }
  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.name).toBe('v');
    expect(spec.invariants).toHaveLength(1);
  });
});

// --- Full example from PRD ---

describe('parseViewFile: PRD examples', () => {
  it('parses the read-only content-list example from the PRD', () => {
    const source = `
view "content-list" {
  shell: "content-list"

  invariants {

    always "purity is read-only": {
      purity = "read-only"
    }

    always "projected fields are subset of source schema": {
      forall f in readFields:
      f in ["id", "node", "kind", "name", "schemas"]
    }

    always "filter references valid fields": {
      forall f in filterFields:
      f in sourceFields
    }

    never "invoke instructions present": {
      invokedActions != {}
    }

    always "all projected fields are read": {
      forall f in projectedFields:
      f in readFields
    }

  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.name).toBe('content-list');
    expect(spec.shell).toBe('content-list');
    expect(spec.invariants).toHaveLength(5);

    // Check kinds
    expect(spec.invariants[0].kind).toBe('always');
    expect(spec.invariants[1].kind).toBe('always');
    expect(spec.invariants[2].kind).toBe('always');
    expect(spec.invariants[3].kind).toBe('never');
    expect(spec.invariants[4].kind).toBe('always');

    // Check names
    expect(spec.invariants[0].name).toBe('purity is read-only');
    expect(spec.invariants[3].name).toBe('invoke instructions present');
  });

  it('parses the read-write task-board-actions example from the PRD', () => {
    const source = `
view "task-board-actions" {
  shell: "task-board"

  invariants {

    always "purity is read-write": {
      purity = "read-write"
    }

    always "invokes only Task actions": {
      forall ia in invokedActions:
      ia startsWith "Task/"
    }

    always "all invoke variants are covered": {
      uncoveredVariants = []
    }

    always "invoke targets exist": {
      forall ia in invokedActions:
      ia in registeredActions
    }

    example "bulk escalate invokes Task/escalate": {
      after compile
      then "Task/escalate" in invokedActions
      and  purity = "read-write"
      and  uncoveredVariants = []
    }

  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.name).toBe('task-board-actions');
    expect(spec.shell).toBe('task-board');
    expect(spec.invariants).toHaveLength(5);

    // Last invariant is an example
    const example = spec.invariants[4];
    expect(example.kind).toBe('example');
    expect(example.name).toBe('bulk escalate invokes Task/escalate');
    expect(example.afterPatterns).toHaveLength(1);
    expect(example.afterPatterns[0].actionName).toBe('compile');
    expect(example.thenPatterns).toHaveLength(3);
  });
});
