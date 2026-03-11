import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

describe('Clef Base app-shell suite', () => {
  it('declares the ui-app suite dependency', () => {
    const suitePath = path.resolve('clef-base/suites/app-shell/suite.yaml');
    const suite = parseYaml(fs.readFileSync(suitePath, 'utf-8')) as {
      uses?: Array<{ suite?: string }>;
    };

    expect(suite.uses?.some((entry) => entry.suite === 'ui-app')).toBe(true);
  });
});
