import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const syncPath = path.resolve('repertoire/concepts/ui-app/syncs/required/shell-theme-motif-adapt.sync');
const derivedPath = path.resolve('repertoire/concepts/ui-app/app-shell.derived');
const suitePath = path.resolve('repertoire/concepts/ui-app/suite.yaml');

describe('ui-app shell theme motif integration', () => {
  it('registers a shell motif adaptation sync in the suite', () => {
    const content = fs.readFileSync(suitePath, 'utf8');
    expect(content).toContain('ShellThemeMotifAdapt');
    expect(content).toContain('./syncs/required/shell-theme-motif-adapt.sync');
  });

  it('wires AppShell to the shell motif adaptation sync', () => {
    const content = fs.readFileSync(derivedPath, 'utf8');
    expect(content).toContain('shell-theme-motif-adapt');
  });

  it('routes structural motif output into Shell/adapt', () => {
    const content = fs.readFileSync(syncPath, 'utf8');
    expect(content).toContain('StructuralMotif/resolve');
    expect(content).toContain('Shell/adapt');
  });
});
