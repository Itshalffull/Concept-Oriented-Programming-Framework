#!/usr/bin/env node
/**
 * Fix generated conformance tests: output variable bindings should capture
 * the handler's return value instead of asserting against placeholders.
 *
 * For each test file:
 * 1. Find declared free variables (let X = "u-test-invariant-NNN")
 * 2. Track which variables are used as INPUTS to handler calls
 * 3. For variables that appear in output assertions: capture on first occurrence
 * 4. For subsequent occurrences: assert consistency
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dirs = [
  'generated/deploy/typescript',
  'generated/repertoire/typescript',
];

let fixedCount = 0;

for (const dir of dirs) {
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.conformance.test.ts'));
  } catch {
    continue;
  }

  for (const file of files) {
    const filePath = join(dir, file);
    let content = readFileSync(filePath, 'utf-8');
    const original = content;

    // Step 1: Find declared free variables
    const varPattern = /(?:const|let)\s+(\w+)\s*=\s*"u-test-invariant-\d+"/g;
    const declaredVars = new Set();
    let match;
    while ((match = varPattern.exec(content)) !== null) {
      declaredVars.add(match[1]);
    }

    if (declaredVars.size === 0) continue;

    // Step 2: Change const to let for declared variables
    for (const v of declaredVars) {
      content = content.replace(
        new RegExp(`const\\s+(${v})\\s*=\\s*"u-test-invariant-`),
        `let ${v} = "u-test-invariant-`
      );
    }

    // Step 3: Find which variables are used as inputs to handler calls
    // Pattern: { field: varName } in function call arguments
    const inputVars = new Set();
    const inputPattern = /\{\s*([^}]+)\s*\}/g;
    while ((match = inputPattern.exec(content)) !== null) {
      const fields = match[1];
      for (const v of declaredVars) {
        // Variable used as input value (e.g., "tag: t" or "application: a")
        if (new RegExp(`\\b\\w+:\\s*${v}\\b`).test(fields)) {
          inputVars.add(v);
        }
      }
    }

    // Step 4: Transform output assertions
    // Track which variables have been "captured" (bound from output)
    const boundVars = new Set();

    // Process all expect().toBe(VAR) lines for declared variables
    const lines = content.split('\n');
    const newLines = [];

    for (const line of lines) {
      let modified = false;

      for (const v of declaredVars) {
        // Match: expect((stepN as any).field).toBe(VAR);
        const assertRegex = new RegExp(
          `^(\\s*)expect\\(\\(step(\\d+)\\s+as\\s+any\\)\\.(\\w+)\\)\\.toBe\\(${v}\\);$`
        );
        const m = line.match(assertRegex);

        if (m) {
          const [, indent, stepNum, field] = m;

          if (!boundVars.has(v)) {
            // First occurrence as output: capture the value
            boundVars.add(v);
            newLines.push(`${indent}${v} = (step${stepNum} as any).${field};`);
            modified = true;
          }
          // If already bound, keep the assertion as-is
          break;
        }
      }

      if (!modified) {
        newLines.push(line);
      }
    }

    content = newLines.join('\n');

    if (content !== original) {
      writeFileSync(filePath, content);
      fixedCount++;
      console.log(`Fixed: ${filePath}`);
    }
  }
}

console.log(`\nFixed ${fixedCount} files.`);
