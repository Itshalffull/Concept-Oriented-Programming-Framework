import { describe, it, expect } from 'vitest';
import { parseWidgetFile } from '../handlers/ts/framework/widget-spec-parser.js';
import { readFileSync } from 'fs';

describe('key-value-list widget spec', () => {
  it('parses with >= 5 structured invariants', () => {
    const src = readFileSync('./surface/key-value-list.widget', 'utf8');
    const m = parseWidgetFile(src);
    expect(m.name).toBe('key-value-list');
    expect(m.anatomy.length).toBeGreaterThanOrEqual(5);
    const invs = m.invariants ?? [];
    expect(invs.length).toBeGreaterThanOrEqual(5);
    const kinds = invs.map((i: { kind: string }) => i.kind);
    // Must include at least: example, always, never, requires_ensures (action contract)
    expect(kinds).toContain('example');
    expect(kinds).toContain('always');
    expect(kinds).toContain('never');
    expect(kinds).toContain('requires_ensures');
  });
});
