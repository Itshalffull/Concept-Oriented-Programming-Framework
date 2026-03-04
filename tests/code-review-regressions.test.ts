// ============================================================
// Code Review Regression Tests
//
// Guards against reintroduction of bugs found during the
// full-project code review. Each describe block maps to a
// specific issue that was fixed.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// --------------- Helpers ---------------

const ROOT = resolve(__dirname, '..');

function readSource(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8');
}

// ===============================================================
// 1. score-bootstrap.ts — CompiledSync field names must match
//    the CompiledSync interface (when/where/then/annotations)
// ===============================================================

describe('Score bootstrap CompiledSync shape', () => {
  const source = readSource('runtime/score-bootstrap.ts');

  it('uses "when" not "patterns"', () => {
    expect(source).not.toContain('patterns:');
    expect(source).toContain('when:');
  });

  it('uses "where" not "whereClause"', () => {
    expect(source).not.toContain('whereClause:');
    expect(source).toContain('where:');
  });

  it('uses "then" not "thenClause"', () => {
    expect(source).not.toContain('thenClause:');
    expect(source).toContain('then:');
  });

  it('uses "annotations" (array) not "annotation" (string)', () => {
    // Should have annotations: ['eager'] not annotation: 'eager'
    expect(source).not.toMatch(/\bannotation:\s*'/);
    expect(source).toContain("annotations: ['eager']");
  });

  it('uses inputFields/outputFields not inputBindings/outputBindings', () => {
    expect(source).not.toContain('inputBindings');
    expect(source).not.toContain('outputBindings');
    expect(source).toContain('inputFields');
    expect(source).toContain('outputFields');
  });

  it('uses fields with name/value objects in then clauses', () => {
    expect(source).not.toMatch(/\bbindings:\s*\{/);
    expect(source).toContain('fields:');
  });
});

// ===============================================================
// 2. CLI suite.ts — Command injection protection
// ===============================================================

describe('CLI suite test runner validation', () => {
  const source = readSource('cli/src/commands/suite.ts');

  it('has an ALLOWED_TEST_RUNNERS whitelist', () => {
    expect(source).toContain('ALLOWED_TEST_RUNNERS');
    expect(source).toContain("'npx'");
    expect(source).toContain("'cargo'");
    expect(source).toContain("'forge'");
  });

  it('validates base command against whitelist before execSync', () => {
    expect(source).toContain('ALLOWED_TEST_RUNNERS.has(baseCommand)');
  });

  it('rejects shell metacharacters in test runner strings', () => {
    expect(source).toMatch(/[;&|`$(){}!<>\\\\]/);
    expect(source).toContain('disallowed shell characters');
  });
});

// ===============================================================
// 3. LiteFilter — No duplicate definition in http-transport
// ===============================================================

describe('LiteFilter type consistency', () => {
  const httpTransportSource = readSource('runtime/adapters/http-transport.ts');
  const typesSource = readSource('runtime/types.ts');

  it('http-transport.ts does not redefine LiteFilter', () => {
    expect(httpTransportSource).not.toMatch(/export\s+interface\s+LiteFilter/);
  });

  it('http-transport.ts does not redefine ConceptStateSnapshot', () => {
    expect(httpTransportSource).not.toMatch(/export\s+interface\s+ConceptStateSnapshot/);
  });

  it('http-transport.ts imports LiteFilter from types.ts', () => {
    expect(httpTransportSource).toMatch(/import\s+type\s*\{[^}]*LiteFilter[^}]*\}\s*from\s*'\.\.\/types\.js'/);
  });

  it('types.ts LiteFilter includes neq operator', () => {
    expect(typesSource).toMatch(/op:.*'neq'/);
  });
});

// ===============================================================
// 4. BindingProvider coupled mode — must return error, not success
// ===============================================================

describe('BindingProvider coupled mode behavior', () => {
  const source = readSource('surface/widgets/react/components/BindingProvider.tsx');

  it('coupled mode returns ok: false (not a silent no-op)', () => {
    expect(source).not.toMatch(/case 'coupled'[\s\S]*?ok:\s*true/);
    expect(source).toMatch(/case 'coupled'[\s\S]*?ok:\s*false/);
  });

  it('does not use console.warn for coupled mode dispatch', () => {
    expect(source).not.toContain('coupled invoke not wired');
  });
});

// ===============================================================
// 5. BindingProvider GraphQL — proper variable syntax
// ===============================================================

describe('BindingProvider GraphQL mutation syntax', () => {
  const source = readSource('surface/widgets/react/components/BindingProvider.tsx');

  it('uses GraphQL variables ($input) not double JSON.stringify', () => {
    expect(source).not.toContain('JSON.stringify(JSON.stringify(input))');
    expect(source).toContain('$input');
  });

  it('passes variables object in fetch body', () => {
    expect(source).toContain('variables:');
  });
});

// ===============================================================
// 6. CLI main.ts — error handling only catches import failures
// ===============================================================

describe('CLI main.ts error handling', () => {
  const source = readSource('cli/src/main.ts');

  it('checks for ERR_MODULE_NOT_FOUND specifically', () => {
    expect(source).toContain('ERR_MODULE_NOT_FOUND');
  });

  it('does not have a bare catch block that swallows all errors', () => {
    // Should not have `} catch {` without filtering error type
    expect(source).not.toMatch(/\}\s*catch\s*\{\s*\n\s*\/\/\s*Generated CLI not available/);
  });

  it('re-throws non-import errors', () => {
    expect(source).toContain('throw err');
  });
});

// ===============================================================
// 7. DynamoDB — no self-referencing KeyConditionExpression
// ===============================================================

describe('DynamoDB KeyConditionExpression validity', () => {
  it('dynamodb-storage.ts does not use self-referencing pk = pk', () => {
    const source = readSource('runtime/adapters/dynamodb-storage.ts');
    // Should not contain the literal string 'pk = pk'
    expect(source).not.toMatch(/'pk\s*=\s*pk'/);
  });

  it('durable-action-log-dynamodb.ts does not use self-referencing #pk = #pk', () => {
    const source = readSource('runtime/action-log/durable-action-log-dynamodb.ts');
    expect(source).not.toMatch(/'#pk\s*=\s*#pk'/);
  });
});

// ===============================================================
// 8. schema-gen — exhaustiveness checks on switch statements
// ===============================================================

describe('schema-gen exhaustiveness checks', () => {
  const source = readSource('handlers/ts/framework/schema-gen.handler.ts');

  it('typeExprToResolvedType has a default/never case', () => {
    // The function should contain an exhaustiveness check
    expect(source).toContain('_exhaustive: never');
  });

  it('resolvedTypeToJsonSchema has a default/never case', () => {
    // Count occurrences — should be at least 3 (one per switch)
    const matches = source.match(/_exhaustive:\s*never/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

// ===============================================================
// 9. Dead code removal — known dead variables should stay removed
// ===============================================================

describe('Dead code removal', () => {
  it('engine.ts does not have dead keyVariable', () => {
    const source = readSource('handlers/ts/framework/engine.ts');
    expect(source).not.toMatch(/const keyVariable:\s*string\s*\|\s*null\s*=\s*null/);
  });

  it('parser.ts parsePurpose does not have dead startPos', () => {
    const source = readSource('handlers/ts/framework/parser.ts');
    // Check that the parsePurpose area doesn't have unused startPos
    const purposeIdx = source.indexOf('parsePurpose');
    if (purposeIdx > -1) {
      const section = source.slice(purposeIdx, purposeIdx + 300);
      expect(section).not.toContain('const startPos');
    }
  });

  it('suite.ts check-overrides does not have dead invalid variable', () => {
    const source = readSource('cli/src/commands/suite.ts');
    expect(source).not.toMatch(/const invalid\s*=\s*overrides\.length\s*===\s*0\s*\?\s*\[\]\s*:\s*\[\]/);
  });
});

// ===============================================================
// 10. Solidity access control — contracts must use Ownable
// ===============================================================

describe('Solidity access control', () => {
  it('Authentication.sol inherits Ownable', () => {
    const source = readSource('codegen/solidity/src/Authentication.sol');
    expect(source).toContain('import "@openzeppelin/contracts/access/Ownable.sol"');
    expect(source).toMatch(/contract\s+Authentication\s+is\s+Ownable/);
    expect(source).toContain('Ownable(msg.sender)');
  });

  it('Authentication.sol resetPassword is onlyOwner', () => {
    const source = readSource('codegen/solidity/src/Authentication.sol');
    expect(source).toMatch(/function\s+resetPassword\([^)]*\)\s+external\s+onlyOwner/);
  });

  it('Authorization.sol inherits Ownable', () => {
    const source = readSource('codegen/solidity/src/Authorization.sol');
    expect(source).toContain('import "@openzeppelin/contracts/access/Ownable.sol"');
    expect(source).toMatch(/contract\s+Authorization\s+is\s+Ownable/);
  });

  it('Authorization.sol admin functions are onlyOwner', () => {
    const source = readSource('codegen/solidity/src/Authorization.sol');
    expect(source).toMatch(/function\s+createRole\([^)]*\)\s+external\s+onlyOwner/);
    expect(source).toMatch(/function\s+grantPermission\([^)]*\)\s+external\s+onlyOwner/);
    expect(source).toMatch(/function\s+revokePermission\([^)]*\)\s+external\s+onlyOwner/);
    expect(source).toMatch(/function\s+assignRole\([^)]*\)\s+external\s+onlyOwner/);
  });

  it('Authorization.sol view functions do NOT have onlyOwner', () => {
    const source = readSource('codegen/solidity/src/Authorization.sol');
    expect(source).not.toMatch(/function\s+checkPermission\([^)]*\)\s+external\s+onlyOwner/);
  });
});

// ===============================================================
// 11. Solidity generator — emits access control in skeletons
// ===============================================================

describe('Solidity generator access control', () => {
  const source = readSource('handlers/ts/framework/solidity-gen.handler.ts');

  it('imports Ownable in generated contracts', () => {
    expect(source).toContain('@openzeppelin/contracts/access/Ownable.sol');
  });

  it('generated contracts inherit Ownable', () => {
    expect(source).toContain('is Ownable');
  });

  it('generated contracts have Ownable constructor', () => {
    expect(source).toContain('Ownable(msg.sender)');
  });

  it('generated action functions have onlyOwner modifier', () => {
    expect(source).toContain('onlyOwner');
  });
});
