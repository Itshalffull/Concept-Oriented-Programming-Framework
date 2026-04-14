import { describe, it, expect } from 'vitest';
import { parseWidgetFile } from '../../../handlers/ts/framework/widget-spec-parser.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('heading-block widget parse-verify', () => {
  it('parses and has at least 12 invariants', () => {
    const src = readFileSync(path.join(__dirname, '../heading-block.widget'), 'utf8');
    const m: any = parseWidgetFile(src);
    console.log('Widget name:', m.name);
    console.log('Anatomy parts:', (m.anatomy||[]).map((p:any) => p.name));
    console.log('States:', (m.states||[]).map((s:any) => s.name));
    console.log('Props:', (m.props||[]).map((p:any) => p.name));
    console.log('Invariant count:', (m.invariants||[]).length);
    (m.invariants||[]).forEach((inv:any) => {
      console.log('  inv:', inv.kind, JSON.stringify(inv.name));
    });
    expect(m.name).toBe('heading-block');
    expect((m.invariants||[]).length).toBeGreaterThanOrEqual(12);
  });
});
