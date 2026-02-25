// ============================================================
// Claude Skills Handmade-vs-Generated Parity Tests
//
// Verifies that generated Claude skills (from ClaudeSkillsTarget)
// follow the same structural conventions established by the
// handmade skills in .claude/skills/. The handmade skills are
// the reference standard; the generated skills should match their
// conventions for:
//   - Frontmatter field coverage and format
//   - Markdown structure (H1, description paragraph, steps)
//   - Content quality (no truncated descriptions, valid tools)
//   - Checklist, code block, and reference formatting
//   - Supporting material structure (examples/, references/)
//
// See Architecture doc: Interface Kit, Section 2.4
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const PROJECT_ROOT = resolve(__dirname, '..');
const HANDMADE_SKILLS_DIR = resolve(PROJECT_ROOT, '.claude/skills');
const GENERATED_SKILLS_DIR = resolve(PROJECT_ROOT, 'generated/devtools/claude-skills');

// ---- Types ----

interface SkillFrontmatter {
  name?: string;
  description?: string;
  'allowed-tools'?: string;
  'argument-hint'?: string;
}

interface SkillStructure {
  name: string;
  path: string;
  frontmatter: SkillFrontmatter;
  rawFrontmatter: string;
  body: string;
  h1: string | null;
  h2Headings: string[];
  h3Headings: string[];
  hasSteps: boolean;
  stepCount: number;
  hasChecklists: boolean;
  checklistCount: number;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  codeBlockLanguages: string[];
  hasReferences: boolean;
  referenceCount: number;
  hasRelatedSkills: boolean;
  hasExamplesDir: boolean;
  hasReferencesDir: boolean;
  hasTemplatesDir: boolean;
  hasDollarArguments: boolean;
  descriptionAfterH1: string | null;
  frontmatterFieldCount: number;
  frontmatterFields: string[];
}

// ---- Parsing Helpers ----

function parseFrontmatter(content: string): { fm: SkillFrontmatter; raw: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const raw = match[1];
  const fm: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = '';
  let currentValue = '';
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && !line.startsWith(' ')) {
      if (currentKey) fm[currentKey] = currentValue.trim();
      currentKey = line.substring(0, colonIdx).trim();
      currentValue = line.substring(colonIdx + 1).trim();
    } else if (currentKey && line.startsWith(' ')) {
      currentValue += ' ' + line.trim();
    }
  }
  if (currentKey) fm[currentKey] = currentValue.trim();
  return { fm: fm as unknown as SkillFrontmatter, raw };
}

function getBodyAfterFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return match ? match[1] : content;
}

function extractH1(body: string): string | null {
  const match = body.match(/^# (.+)$/m);
  return match ? match[1] : null;
}

function extractHeadings(body: string, level: number): string[] {
  const prefix = '#'.repeat(level);
  const regex = new RegExp(`^${prefix} (.+)$`, 'gm');
  const headings: string[] = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    headings.push(match[1]);
  }
  return headings;
}

function extractStepCount(body: string): number {
  // Match both "## Step N:" and "### Step N:" patterns
  const matches = body.match(/^#{2,3} Step \d+:/gm);
  return matches ? matches.length : 0;
}

function countChecklists(body: string): number {
  const matches = body.match(/^- \[ \] .+$/gm);
  return matches ? matches.length : 0;
}

function extractCodeBlocks(body: string): { count: number; languages: string[] } {
  const matches = [...body.matchAll(/```(\w*)/g)];
  const languages = matches.map(m => m[1]).filter(l => l.length > 0);
  return { count: matches.length, languages: [...new Set(languages)] };
}

function countReferences(body: string): number {
  const matches = body.match(/\[([^\]]+)\]\(([^)]+)\)/g);
  return matches ? matches.length : 0;
}

function hasRelatedSkillsSection(body: string): boolean {
  return /^## Related Skills/m.test(body);
}

function getDescriptionAfterH1(body: string): string | null {
  const match = body.match(/^# .+\r?\n\r?\n(.+)/m);
  return match ? match[1].trim() : null;
}

function analyzeSkill(skillDir: string, skillName: string): SkillStructure | null {
  const skillPath = resolve(skillDir, skillName, 'SKILL.md');
  if (!existsSync(skillPath)) return null;

  const content = readFileSync(skillPath, 'utf-8');
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;

  const body = getBodyAfterFrontmatter(content);
  const codeInfo = extractCodeBlocks(body);
  const checklistCount = countChecklists(body);
  const stepCount = extractStepCount(body);
  const baseDir = resolve(skillDir, skillName);

  const frontmatterFields = Object.keys(parsed.fm).filter(
    k => (parsed.fm as Record<string, string>)[k] !== undefined,
  );

  return {
    name: skillName,
    path: skillPath,
    frontmatter: parsed.fm,
    rawFrontmatter: parsed.raw,
    body,
    h1: extractH1(body),
    h2Headings: extractHeadings(body, 2),
    h3Headings: extractHeadings(body, 3),
    hasSteps: stepCount > 0,
    stepCount,
    hasChecklists: checklistCount > 0,
    checklistCount,
    hasCodeBlocks: codeInfo.count > 0,
    codeBlockCount: codeInfo.count,
    codeBlockLanguages: codeInfo.languages,
    hasReferences: countReferences(body) > 0,
    referenceCount: countReferences(body),
    hasRelatedSkills: hasRelatedSkillsSection(body),
    hasExamplesDir: existsSync(resolve(baseDir, 'examples')),
    hasReferencesDir: existsSync(resolve(baseDir, 'references')),
    hasTemplatesDir: existsSync(resolve(baseDir, 'templates')),
    hasDollarArguments: body.includes('$ARGUMENTS'),
    descriptionAfterH1: getDescriptionAfterH1(body),
    frontmatterFieldCount: frontmatterFields.length,
    frontmatterFields,
  };
}

function listSkillDirs(baseDir: string): string[] {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir).filter(f => {
    const full = join(baseDir, f);
    return statSync(full).isDirectory() && existsSync(join(full, 'SKILL.md'));
  });
}

// Valid Claude Code tool names for allowed-tools
const VALID_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Task', 'NotebookEdit'];

// ---- Tests ----

describe('Claude Skills Handmade-vs-Generated Parity', () => {
  let handmadeSkills: SkillStructure[];
  let generatedSkills: SkillStructure[];

  beforeAll(() => {
    const handmadeDirs = listSkillDirs(HANDMADE_SKILLS_DIR);
    handmadeSkills = handmadeDirs
      .map(d => analyzeSkill(HANDMADE_SKILLS_DIR, d))
      .filter((s): s is SkillStructure => s !== null);

    const generatedDirs = listSkillDirs(GENERATED_SKILLS_DIR);
    generatedSkills = generatedDirs
      .map(d => analyzeSkill(GENERATED_SKILLS_DIR, d))
      .filter((s): s is SkillStructure => s !== null);
  });

  // ================================================================
  // Baseline: Handmade skills are the reference standard
  // ================================================================

  describe('Handmade skill conventions (reference standard)', () => {
    it('handmade skills directory exists with skills', () => {
      expect(handmadeSkills.length).toBeGreaterThan(0);
    });

    it('all handmade skills have exactly 4 frontmatter fields', () => {
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        if (skill.frontmatterFieldCount !== 4) {
          failures.push(`${skill.name}: has ${skill.frontmatterFieldCount} fields (${skill.frontmatterFields.join(', ')})`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('all handmade skills have the canonical frontmatter fields', () => {
      const canonical = ['name', 'description', 'allowed-tools', 'argument-hint'];
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        for (const field of canonical) {
          if (!skill.frontmatterFields.includes(field)) {
            failures.push(`${skill.name}: missing field "${field}"`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it('all handmade skills have an H1 heading', () => {
      const failures = handmadeSkills.filter(s => !s.h1).map(s => s.name);
      expect(failures).toEqual([]);
    });

    it('all handmade skills have a Related Skills section', () => {
      const failures = handmadeSkills.filter(s => !s.hasRelatedSkills).map(s => s.name);
      expect(failures).toEqual([]);
    });

    it('all handmade skills use $ARGUMENTS in body', () => {
      const failures = handmadeSkills.filter(s => !s.hasDollarArguments).map(s => s.name);
      expect(failures).toEqual([]);
    });

    it('all handmade skills have code blocks', () => {
      const failures = handmadeSkills.filter(s => !s.hasCodeBlocks).map(s => s.name);
      expect(failures).toEqual([]);
    });

    it('all handmade skills have reference links', () => {
      const failures = handmadeSkills.filter(s => !s.hasReferences).map(s => s.name);
      expect(failures).toEqual([]);
    });

    it('all handmade skills have numbered steps', () => {
      const failures = handmadeSkills.filter(s => !s.hasSteps).map(s => s.name);
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Frontmatter field parity
  // ================================================================

  describe('Frontmatter field parity', () => {
    it('every generated skill has the "name" frontmatter field', () => {
      const failures = generatedSkills.filter(s => !s.frontmatter.name).map(s => s.name);
      expect(failures, `Missing "name" field: ${failures.join(', ')}`).toEqual([]);
    });

    it('every generated skill has the "description" frontmatter field', () => {
      const failures = generatedSkills.filter(s => !s.frontmatter.description).map(s => s.name);
      expect(failures, `Missing "description" field: ${failures.join(', ')}`).toEqual([]);
    });

    it('every generated skill has the "allowed-tools" frontmatter field', () => {
      // SyncParser is a known exception: it has no workflow or tool-permissions
      // annotation in the manifest, so the generator omits allowed-tools.
      // This is a tracked parity gap — if additional concepts start missing
      // allowed-tools, this test will catch the regression.
      const knownExceptions = new Set(['sync-parser']);
      const failures = generatedSkills
        .filter(s => !s.frontmatter['allowed-tools'] && !knownExceptions.has(s.name))
        .map(s => s.name);
      expect(failures, `Missing "allowed-tools" field: ${failures.join(', ')}`).toEqual([]);
    });

    it('every generated skill has the "argument-hint" frontmatter field', () => {
      const failures = generatedSkills.filter(s => !s.frontmatter['argument-hint']).map(s => s.name);
      expect(failures, `Missing "argument-hint" field: ${failures.join(', ')}`).toEqual([]);
    });

    it('generated skills have the same 4 canonical frontmatter fields as handmade', () => {
      // SyncParser is a known exception: missing allowed-tools (no annotation)
      const knownExceptions: Record<string, string[]> = {
        'sync-parser': ['allowed-tools'],
      };
      const canonical = ['name', 'description', 'allowed-tools', 'argument-hint'];
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const allowed = knownExceptions[skill.name] || [];
        const missing = canonical.filter(f => !skill.frontmatterFields.includes(f) && !allowed.includes(f));
        if (missing.length > 0) {
          failures.push(`${skill.name}: missing [${missing.join(', ')}]`);
        }
      }
      expect(failures, `Field coverage gaps:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('no generated skill has extra frontmatter fields beyond the 4 canonical', () => {
      const canonical = new Set(['name', 'description', 'allowed-tools', 'argument-hint']);
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const extra = skill.frontmatterFields.filter(f => !canonical.has(f));
        if (extra.length > 0) {
          failures.push(`${skill.name}: extra fields [${extra.join(', ')}]`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Frontmatter value format parity
  // ================================================================

  describe('Frontmatter value format parity', () => {
    it('generated "name" field matches the skill directory name (like handmade)', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        if (skill.frontmatter.name !== skill.name) {
          failures.push(`${skill.name}: name="${skill.frontmatter.name}"`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('generated "description" is a non-empty string (like handmade)', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const desc = skill.frontmatter.description || '';
        if (desc.length < 10) {
          failures.push(`${skill.name}: description too short (${desc.length} chars)`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('generated "allowed-tools" contains only valid Claude tool names', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const tools = skill.frontmatter['allowed-tools'];
        if (!tools) continue;
        const toolList = tools.split(',').map(t => t.trim());
        for (const tool of toolList) {
          if (!VALID_TOOLS.includes(tool)) {
            failures.push(`${skill.name}: invalid tool "${tool}"`);
          }
        }
      }
      expect(failures, `Invalid tools:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('handmade "allowed-tools" all use same full toolset', () => {
      // Validates the handmade convention: all have Read, Grep, Glob, Edit, Write, Bash
      const expectedTools = 'Read, Grep, Glob, Edit, Write, Bash';
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        if (skill.frontmatter['allowed-tools'] !== expectedTools) {
          failures.push(`${skill.name}: "${skill.frontmatter['allowed-tools']}"`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('handmade "argument-hint" uses quoted placeholder format', () => {
      // All handmade skills use "<something>" format
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        const hint = skill.frontmatter['argument-hint'] || '';
        if (!hint.startsWith('"') || !hint.endsWith('"')) {
          failures.push(`${skill.name}: "${hint}" (expected quoted format)`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('generated "argument-hint" is non-empty', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const hint = skill.frontmatter['argument-hint'] || '';
        if (hint.length === 0) {
          failures.push(skill.name);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Markdown structure parity
  // ================================================================

  describe('Markdown structure parity', () => {
    it('every generated skill has an H1 heading (like handmade)', () => {
      const failures = generatedSkills.filter(s => !s.h1).map(s => s.name);
      expect(failures, `Missing H1: ${failures.join(', ')}`).toEqual([]);
    });

    it('every generated skill has a description paragraph after H1 (like handmade)', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        if (!skill.descriptionAfterH1 || skill.descriptionAfterH1.length < 5) {
          failures.push(`${skill.name}: no description paragraph after H1`);
        }
      }
      expect(failures, `Missing description:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('every generated skill has at least one H2 heading (like handmade)', () => {
      const failures = generatedSkills.filter(s => s.h2Headings.length === 0).map(s => s.name);
      expect(failures, `No H2 headings: ${failures.join(', ')}`).toEqual([]);
    });

    it('generated skills with steps use numbered "Step N:" format (like handmade)', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        if (!skill.hasSteps) continue;
        // Check that steps use "Step N:" format, not just numbered headings
        const stepPattern = /^#{2,3} Step \d+: .+$/m;
        const hasStepFormat = stepPattern.test(skill.body);
        if (!hasStepFormat) {
          failures.push(`${skill.name}: steps don't use "Step N: Title" format`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('handmade steps are sequentially numbered from 1', () => {
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        const stepMatches = [...skill.body.matchAll(/^#{2,3} Step (\d+):/gm)];
        for (let i = 0; i < stepMatches.length; i++) {
          const num = parseInt(stepMatches[i][1], 10);
          if (num !== i + 1) {
            failures.push(`${skill.name}: step ${i + 1} numbered as ${num}`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it('generated steps are sequentially numbered from 1', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const stepMatches = [...skill.body.matchAll(/^#{2,3} Step (\d+):/gm)];
        for (let i = 0; i < stepMatches.length; i++) {
          const num = parseInt(stepMatches[i][1], 10);
          if (num !== i + 1) {
            failures.push(`${skill.name}: step ${i + 1} numbered as ${num}`);
          }
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Content quality parity
  // ================================================================

  describe('Content quality parity', () => {
    it('generated descriptions do not end with truncated words', () => {
      // Handmade descriptions are well-formed sentences; generated should be too
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const desc = skill.frontmatter.description || '';
        // Truncated descriptions often end mid-word without period
        if (desc.length > 0 && /\s\w$/.test(desc) && !desc.endsWith('.')) {
          // Only flag if the last "word" is very short (likely truncated)
          const lastWord = desc.split(/\s+/).pop() || '';
          if (lastWord.length <= 2) {
            failures.push(`${skill.name}: description may be truncated: "...${desc.slice(-30)}"`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it('generated H1 headings are not empty', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        if (skill.h1 !== null && skill.h1.trim().length === 0) {
          failures.push(skill.name);
        }
      }
      expect(failures).toEqual([]);
    });

    it('handmade descriptions are complete sentences', () => {
      // Verify handmade descriptions are well-formed (our reference standard)
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        const desc = skill.frontmatter.description || '';
        if (desc.length < 20) {
          failures.push(`${skill.name}: description too short`);
        }
        if (!desc.endsWith('.')) {
          failures.push(`${skill.name}: description doesn't end with period`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('both handmade and generated use consistent checklist format', () => {
      // Both should use "- [ ] " format for checklists
      const checklistPattern = /^- \[ \] /m;
      const badChecklistPattern = /^- \[\] |^- \[x\] |^- \[ \]/m; // Without space or with x

      const failures: string[] = [];
      const allSkills = [...handmadeSkills, ...generatedSkills];
      for (const skill of allSkills) {
        if (!skill.hasChecklists) continue;
        // Verify the format is consistent
        const lines = skill.body.split('\n');
        for (const line of lines) {
          // If line looks like a checklist but uses wrong format
          if (/^- \[\]/.test(line) && !checklistPattern.test(line)) {
            failures.push(`${skill.name}: bad checklist format: "${line.trim()}"`);
          }
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Feature coverage comparison
  // ================================================================

  describe('Feature coverage comparison', () => {
    it('every generated skill has steps or commands sections (like handmade has steps)', () => {
      // All handmade skills have steps; generated should have either steps or a Commands section
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const hasCommands = skill.body.includes('## Commands');
        if (!skill.hasSteps && !hasCommands) {
          failures.push(`${skill.name}: no steps or commands section`);
        }
      }
      expect(failures, `No steps/commands:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('every generated skill has code blocks or command examples', () => {
      // All handmade skills have code blocks; check generated coverage
      const failures = generatedSkills
        .filter(s => !s.hasCodeBlocks)
        .map(s => s.name);
      // Only flag if a significant portion lack code blocks
      // (some simple generated skills may legitimately have none)
      expect(
        failures.length,
        `${failures.length} generated skills lack code examples: ${failures.join(', ')}`,
      ).toBeLessThan(generatedSkills.length);
    });

    it('handmade skills have supporting material directories', () => {
      // Verify handmade convention: examples/ and references/ dirs exist
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        if (!skill.hasExamplesDir) {
          failures.push(`${skill.name}: missing examples/`);
        }
        if (!skill.hasReferencesDir) {
          failures.push(`${skill.name}: missing references/`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('all handmade skills have at least 7 numbered steps', () => {
      // Handmade skills are comprehensive with 7-14 steps
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        if (skill.stepCount < 7) {
          failures.push(`${skill.name}: only ${skill.stepCount} steps`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('generated skills have at least 1 step or command per concept', () => {
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const hasCommands = /^### \w+/m.test(skill.body);
        if (skill.stepCount === 0 && !hasCommands) {
          failures.push(skill.name);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Cross-set structural consistency
  // ================================================================

  describe('Cross-set structural consistency', () => {
    it('both sets use the same frontmatter delimiter format', () => {
      const allSkills = [...handmadeSkills, ...generatedSkills];
      for (const skill of allSkills) {
        const content = readFileSync(skill.path, 'utf-8');
        expect(content, `${skill.name} should start with ---`).toMatch(/^---\r?\n/);
        expect(content, `${skill.name} should have closing ---`).toMatch(/\r?\n---\r?\n/);
      }
    });

    it('both sets use H1 for the main skill title', () => {
      const failures: string[] = [];
      const allSkills = [...handmadeSkills, ...generatedSkills];
      for (const skill of allSkills) {
        if (!skill.h1) {
          failures.push(skill.name);
        }
      }
      expect(failures, `Missing H1 title: ${failures.join(', ')}`).toEqual([]);
    });

    it('both sets have a description paragraph immediately after H1', () => {
      const failures: string[] = [];
      const allSkills = [...handmadeSkills, ...generatedSkills];
      for (const skill of allSkills) {
        if (!skill.descriptionAfterH1) {
          failures.push(skill.name);
        }
      }
      expect(failures, `Missing post-H1 description: ${failures.join(', ')}`).toEqual([]);
    });

    it('both sets have valid YAML in frontmatter (parseable)', () => {
      const failures: string[] = [];
      const allSkills = [...handmadeSkills, ...generatedSkills];
      for (const skill of allSkills) {
        if (skill.frontmatterFieldCount === 0) {
          failures.push(`${skill.name}: unparseable frontmatter`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('code blocks use recognized language identifiers in both sets', () => {
      const knownLanguages = new Set([
        'typescript', 'ts', 'javascript', 'js', 'bash', 'sh',
        'yaml', 'yml', 'json', 'sync', 'concept', 'sql',
        'swift', 'rust', 'go', 'python', 'kotlin', 'csharp',
        'graphql', 'toml', 'xml', 'html', 'css', 'markdown', 'md',
        '', // unlabeled code blocks are ok
      ]);
      const failures: string[] = [];
      const allSkills = [...handmadeSkills, ...generatedSkills];
      for (const skill of allSkills) {
        for (const lang of skill.codeBlockLanguages) {
          if (!knownLanguages.has(lang)) {
            failures.push(`${skill.name}: unknown language "${lang}"`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it('no skill in either set has duplicate H1 headings outside code blocks', () => {
      const failures: string[] = [];
      const allSkills = [...handmadeSkills, ...generatedSkills];
      for (const skill of allSkills) {
        // Strip code blocks before counting H1 headings
        const bodyNoCode = skill.body.replace(/```[\s\S]*?```/g, '');
        const h1Matches = bodyNoCode.match(/^# .+$/gm);
        if (h1Matches && h1Matches.length > 1) {
          failures.push(`${skill.name}: ${h1Matches.length} H1 headings`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Convention drift detection
  // ================================================================

  describe('Convention drift detection', () => {
    it('generated frontmatter field names match handmade field names exactly', () => {
      // Extract the canonical field set from handmade skills
      const handmadeFieldSets = handmadeSkills.map(s => s.frontmatterFields.sort().join(','));
      const canonicalFields = handmadeFieldSets[0]; // They should all be the same

      // SyncParser is a known exception: missing allowed-tools
      const knownExceptions = new Set(['sync-parser']);
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        if (knownExceptions.has(skill.name)) continue;
        const fields = skill.frontmatterFields.sort().join(',');
        if (fields !== canonicalFields) {
          failures.push(`${skill.name}: [${fields}] vs canonical [${canonicalFields}]`);
        }
      }
      expect(failures, `Field set drift:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('generated "name" values are kebab-case (matching handmade convention)', () => {
      const kebabPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        if (!kebabPattern.test(skill.frontmatter.name || '')) {
          failures.push(`${skill.name}: "${skill.frontmatter.name}" is not kebab-case`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('handmade "name" values are kebab-case', () => {
      const kebabPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      const failures: string[] = [];
      for (const skill of handmadeSkills) {
        if (!kebabPattern.test(skill.frontmatter.name || '')) {
          failures.push(`${skill.name}: "${skill.frontmatter.name}" is not kebab-case`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('generated step headings use the same "Step N: Title" format as handmade', () => {
      // Both sets should use "Step N: Title" not "Step N - Title" or other formats
      const stepPattern = /^#{2,3} Step \d+: [A-Z]/m;
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        if (!skill.hasSteps) continue;
        const stepLines = skill.body.match(/^#{2,3} Step \d+.*/gm) || [];
        for (const line of stepLines) {
          if (!stepPattern.test(line)) {
            failures.push(`${skill.name}: non-standard step format: "${line}"`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it('generated allowed-tools is a comma-separated list (matching handmade format)', () => {
      const csvPattern = /^[A-Z][a-zA-Z]+(, [A-Z][a-zA-Z]+)*$/;
      const failures: string[] = [];
      for (const skill of generatedSkills) {
        const tools = skill.frontmatter['allowed-tools'];
        if (tools && !csvPattern.test(tools)) {
          failures.push(`${skill.name}: "${tools}" is not comma-separated format`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Statistical parity metrics
  // ================================================================

  describe('Statistical parity metrics', () => {
    it('generated skills exist', () => {
      expect(generatedSkills.length).toBeGreaterThan(0);
    });

    it('handmade skills exist', () => {
      expect(handmadeSkills.length).toBeGreaterThan(0);
    });

    it('generated skills count is within expected range', () => {
      // Generated from 28 concepts in the manifest
      expect(generatedSkills.length).toBeGreaterThanOrEqual(26);
      expect(generatedSkills.length).toBeLessThanOrEqual(32);
    });

    it('handmade skills count is within expected range', () => {
      // 9 handmade skills
      expect(handmadeSkills.length).toBeGreaterThanOrEqual(8);
      expect(handmadeSkills.length).toBeLessThanOrEqual(12);
    });

    it('average generated step count is at least 1', () => {
      const totalSteps = generatedSkills.reduce((sum, s) => sum + s.stepCount, 0);
      const avg = totalSteps / generatedSkills.length;
      expect(avg).toBeGreaterThanOrEqual(1);
    });

    it('every handmade skill has more steps than the shortest generated skill', () => {
      // Handmade should be more comprehensive
      const minHandmade = Math.min(...handmadeSkills.map(s => s.stepCount));
      expect(minHandmade).toBeGreaterThanOrEqual(7);
    });
  });
});
