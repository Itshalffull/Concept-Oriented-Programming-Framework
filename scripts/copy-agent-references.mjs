// Copy shared reference docs into hand-authored agent folders so agents have
// their grammar / methodology guides locally without navigating to skill
// folders. Keeps copies in sync across .claude / .codex / .gemini.
//
// Hand-authored agents (not in examples/devtools/devtools.interface.yaml's
// claude-agents.include) need explicit references wiring. The tree-sitter
// copy script sets the pattern; this one follows it for agent docs.

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Canonical sources. Edit the source files; this script propagates copies
// to consumer agent folders.
const SOURCES = {
  'concept-grammar.md':     resolve(ROOT, '.claude/skills/create-concept/references/concept-grammar.md'),
  'jackson-methodology.md': resolve(ROOT, '.claude/skills/create-concept/references/jackson-methodology.md'),
  'creation-routing.md':    resolve(ROOT, 'docs/agent-references/creation-routing.md'),
};

// Agents that need a local references folder. Keyed by agent id; value is
// the list of reference filenames (from SOURCES) to copy in.
const AGENT_REFERENCES = {
  'concept-parameter-update':   ['concept-grammar.md', 'jackson-methodology.md'],
  'seed-data':                  ['creation-routing.md'],
  'clef-base':                  ['creation-routing.md'],
  'concept-scaffold-gen':       ['creation-routing.md'],
  'content-type-scaffold-gen':  ['creation-routing.md'],
};

const AGENT_DIRS = [
  resolve(ROOT, '.claude/agents'),
  resolve(ROOT, '.codex/agents'),
  resolve(ROOT, '.gemini/agents'),
];

let copied = 0;
let skipped = 0;

for (const [agentId, refNames] of Object.entries(AGENT_REFERENCES)) {
  for (const agentDir of AGENT_DIRS) {
    if (!existsSync(agentDir)) continue;
    const targetDir = resolve(agentDir, agentId);
    mkdirSync(targetDir, { recursive: true });

    for (const ref of refNames) {
      const src = SOURCES[ref];
      if (!src || !existsSync(src)) {
        console.warn(`  Warning: source ${ref} not found at ${src}`);
        skipped++;
        continue;
      }
      const dst = resolve(targetDir, ref);
      copyFileSync(src, dst);
      copied++;
    }
  }
}

console.log(`Agent references ready (${copied} copied, ${skipped} skipped).`);
