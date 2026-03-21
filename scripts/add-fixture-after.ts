#!/usr/bin/env npx tsx
/**
 * Migration script: Add `after` clauses to concept fixtures.
 *
 * Rules:
 * 1. Within each concept, the first action is the "seed" action (creates state).
 *    Its first ok-path fixture is the seed fixture.
 * 2. For subsequent actions' ok-path fixtures, add `after <seed>`.
 * 3. Within the seed action, fixtures whose names suggest they test against
 *    existing state (duplicate, existing, already, conflict, taken, second)
 *    get `after <seed>` too.
 * 4. For "reverse" actions (un-X), find the matching forward action's seed.
 * 5. Error/notfound fixtures never get `after`.
 * 6. Pure validation actions (validate*, check*, parse*, format*, compute*,
 *    preview, compare) are skipped when they don't read stored state.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedFixture {
  lineIndex: number;
  name: string;
  expectedVariant: string; // 'ok' if not specified
  hasAfter: boolean;
}

interface ParsedAction {
  name: string;
  firstLineIndex: number;
  fixtures: ParsedFixture[];
}

// ─── Heuristics ──────────────────────────────────────────────────────────────

/** Actions that typically don't read stored state — they validate/transform input */
const PURE_ACTION_RE = /^(validate\w*|checkStrength|parse\w*|format\w*|compute\w*|calculate\w*|compare\w*|diff\w*|hash\w*|encode\w*|decode\w*|serialize\w*|deserialize\w*|transform\w*|convert\w*|normalize\w*|sanitize\w*|preview\w*|project\w*|render\w*)$/;

/** Fixture names that suggest they test against pre-existing state (within same action) */
const NEEDS_PRIOR_STATE_RE = /duplicate|existing|already|conflict|taken|second|another|same_|overlap|reuse|occupied|claimed|repeat|retry/i;

/** Reverse action prefixes and their forward counterparts */
const REVERSE_PREFIXES: [string, string][] = [
  ['unfavorite', 'favorite'],
  ['unfollow', 'follow'],
  ['unsubscribe', 'subscribe'],
  ['unregister', 'register'],
  ['unpublish', 'publish'],
  ['unpin', 'pin'],
  ['unblock', 'block'],
  ['unmute', 'mute'],
  ['unlock', 'lock'],
  ['unassign', 'assign'],
  ['unstake', 'stake'],
  ['undelegate', 'delegate'],
  ['deactivate', 'activate'],
  ['disable', 'enable'],
  ['disconnect', 'connect'],
  ['detach', 'attach'],
  ['revoke', 'grant'],
  ['release', 'acquire'],
  ['close', 'open'],
  ['stop', 'start'],
  ['remove', 'add'],
  ['reject', 'accept'],
  ['deny', 'approve'],
];

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseConceptFile(lines: string[]): ParsedAction[] {
  const actions: ParsedAction[] = [];
  let currentAction: ParsedAction | null = null;
  let braceDepth = 0;
  let insideActions = false;
  let actionsDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Count braces for nesting
    for (const ch of trimmed) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }

    // Detect `actions {` block
    if (/^\s*actions\s*\{/.test(line) && !insideActions) {
      insideActions = true;
      actionsDepth = braceDepth;
      continue;
    }

    if (!insideActions) continue;

    // Detect `action <name>(...) {`
    const actionMatch = trimmed.match(/^action\s+(\w+)\s*\(/);
    if (actionMatch) {
      currentAction = {
        name: actionMatch[1],
        firstLineIndex: i,
        fixtures: [],
      };
      actions.push(currentAction);
      continue;
    }

    // Detect fixture lines
    if (currentAction) {
      const fixtureMatch = trimmed.match(
        /^fixture\s+(\w+)\s*\{[^}]*\}\s*(after\s+[\w,\s]+)?\s*(?:->\s*(\w+))?/
      );
      if (fixtureMatch) {
        currentAction.fixtures.push({
          lineIndex: i,
          name: fixtureMatch[1],
          expectedVariant: fixtureMatch[3] || 'ok',
          hasAfter: !!fixtureMatch[2],
        });
      }
    }

    // Exit actions block
    if (insideActions && braceDepth < actionsDepth) {
      insideActions = false;
      currentAction = null;
    }
  }

  return actions;
}

// ─── Dependency Resolution ───────────────────────────────────────────────────

interface FixtureEdit {
  lineIndex: number;
  afterDeps: string[];
}

function resolveAfterDeps(actions: ParsedAction[]): FixtureEdit[] {
  if (actions.length === 0) return [];

  const edits: FixtureEdit[] = [];

  // Build action-name → first-ok-fixture map
  const actionSeedMap = new Map<string, string>();
  for (const action of actions) {
    const firstOk = action.fixtures.find(
      (f) => f.expectedVariant === 'ok' && !f.hasAfter
    );
    if (firstOk) {
      actionSeedMap.set(action.name, firstOk.name);
    }
  }

  // The global seed is the first action's first ok fixture
  const seedAction = actions[0];
  const globalSeed = actionSeedMap.get(seedAction.name);

  if (!globalSeed) return edits; // No seed fixture → nothing to do

  // Process first action: within-action dependencies
  for (const fixture of seedAction.fixtures) {
    if (fixture.hasAfter) continue;
    if (fixture.name === globalSeed) continue; // The seed itself
    if (fixture.expectedVariant !== 'ok') continue; // Error paths don't need after

    // Check if fixture name suggests it needs prior state
    if (NEEDS_PRIOR_STATE_RE.test(fixture.name)) {
      edits.push({ lineIndex: fixture.lineIndex, afterDeps: [globalSeed] });
    }
  }

  // Process subsequent actions
  for (let i = 1; i < actions.length; i++) {
    const action = actions[i];

    // Skip pure validation actions
    if (PURE_ACTION_RE.test(action.name)) continue;

    // Find the best seed for this action
    let seed = globalSeed;

    // Check if this is a reverse action
    for (const [reverse, forward] of REVERSE_PREFIXES) {
      if (action.name.toLowerCase() === reverse || action.name.toLowerCase().startsWith(reverse)) {
        const forwardSeed = actionSeedMap.get(forward);
        if (forwardSeed) {
          seed = forwardSeed;
          break;
        }
      }
    }

    for (const fixture of action.fixtures) {
      if (fixture.hasAfter) continue;
      if (fixture.expectedVariant !== 'ok') continue;

      edits.push({ lineIndex: fixture.lineIndex, afterDeps: [seed] });
    }
  }

  return edits;
}

// ─── Line Rewriting ──────────────────────────────────────────────────────────

function applyEdits(lines: string[], edits: FixtureEdit[]): string[] {
  const editMap = new Map(edits.map((e) => [e.lineIndex, e]));
  return lines.map((line, i) => {
    const edit = editMap.get(i);
    if (!edit) return line;

    const afterClause = ` after ${edit.afterDeps.join(', ')}`;

    // Insert `after ...` between `}` (end of fixture input) and `-> variant` (or end of line)
    // Pattern: fixture name { ... } [-> variant]
    // We need to insert after the closing } of the input object

    // Find the closing brace of the fixture input (the first } after fixture { )
    const fixtureStart = line.indexOf('fixture');
    if (fixtureStart === -1) return line;

    // Find matching braces
    let depth = 0;
    let closingBrace = -1;
    for (let j = fixtureStart; j < line.length; j++) {
      if (line[j] === '{') depth++;
      if (line[j] === '}') {
        depth--;
        if (depth === 0) {
          closingBrace = j;
          break;
        }
      }
    }

    if (closingBrace === -1) return line; // Malformed, skip

    // Insert after clause right after the closing brace
    const before = line.substring(0, closingBrace + 1);
    const after = line.substring(closingBrace + 1);
    return before + afterClause + after;
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

function processFile(filePath: string): { edits: number; skipped: boolean } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const actions = parseConceptFile(lines);
  if (actions.length === 0) return { edits: 0, skipped: true };

  const editsNeeded = resolveAfterDeps(actions);
  if (editsNeeded.length === 0) return { edits: 0, skipped: false };

  const newLines = applyEdits(lines, editsNeeded);
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');

  return { edits: editsNeeded.length, skipped: false };
}

// Find all concept files
const dirs = ['specs/', 'repertoire/', 'score/', 'surface/', 'bind/'];
const files: string[] = [];
for (const dir of dirs) {
  if (fs.existsSync(dir)) {
    const found = execSync(`find ${dir} -name '*.concept' -type f`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    files.push(...found);
  }
}

console.log(`Found ${files.length} concept files`);

let totalEdits = 0;
let filesModified = 0;
let filesSkipped = 0;

for (const file of files.sort()) {
  const result = processFile(file);
  totalEdits += result.edits;
  if (result.edits > 0) {
    filesModified++;
    console.log(`  ${file}: ${result.edits} fixture(s) updated`);
  } else if (result.skipped) {
    filesSkipped++;
  }
}

console.log(`\nDone: ${totalEdits} fixtures updated across ${filesModified} files (${filesSkipped} skipped, ${files.length - filesModified - filesSkipped} unchanged)`);
