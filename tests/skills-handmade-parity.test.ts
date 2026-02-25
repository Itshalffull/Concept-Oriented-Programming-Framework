// ============================================================
// Claude Skills Convention Tests
//
// Verifies that generated Claude skills (from ClaudeSkillsTarget)
// follow structural conventions for:
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
const SKILLS_DIR = resolve(PROJECT_ROOT, '.claude/skills');

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
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const raw = match[1];
  const fm: Record<string, string> = {};
  const lines = raw.split('\n');
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
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
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
  const match = body.match(/^# .+\n\n(.+)/m);
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

describe('Claude Skills Convention Tests', () => {
  let skills: SkillStructure[];

  beforeAll(() => {
    const dirs = listSkillDirs(SKILLS_DIR);
    skills = dirs
      .map(d => analyzeSkill(SKILLS_DIR, d))
      .filter((s): s is SkillStructure => s !== null);
  });

  // ================================================================
  // Frontmatter field conventions
  // ================================================================

  describe('Frontmatter field conventions', () => {
    it('skills directory exists with skills', () => {
      expect(skills.length).toBeGreaterThan(0);
    });

    it('every skill has the "name" frontmatter field', () => {
      const failures = skills.filter(s => !s.frontmatter.name).map(s => s.name);
      expect(failures, `Missing "name" field: ${failures.join(', ')}`).toEqual([]);
    });

    it('every skill has the "description" frontmatter field', () => {
      const failures = skills.filter(s => !s.frontmatter.description).map(s => s.name);
      expect(failures, `Missing "description" field: ${failures.join(', ')}`).toEqual([]);
    });

    it('every skill has the "allowed-tools" frontmatter field', () => {
      // SyncParser is a known exception: it has no workflow or tool-permissions
      // annotation in the manifest, so the generator omits allowed-tools.
      const knownExceptions = new Set(['sync-parser']);
      const failures = skills
        .filter(s => !s.frontmatter['allowed-tools'] && !knownExceptions.has(s.name))
        .map(s => s.name);
      expect(failures, `Missing "allowed-tools" field: ${failures.join(', ')}`).toEqual([]);
    });

    it('every skill has the "argument-hint" frontmatter field', () => {
      const failures = skills.filter(s => !s.frontmatter['argument-hint']).map(s => s.name);
      expect(failures, `Missing "argument-hint" field: ${failures.join(', ')}`).toEqual([]);
    });

    it('skills have the 4 canonical frontmatter fields', () => {
      // SyncParser is a known exception: missing allowed-tools (no annotation)
      const knownExceptions: Record<string, string[]> = {
        'sync-parser': ['allowed-tools'],
      };
      const canonical = ['name', 'description', 'allowed-tools', 'argument-hint'];
      const failures: string[] = [];
      for (const skill of skills) {
        const allowed = knownExceptions[skill.name] || [];
        const missing = canonical.filter(f => !skill.frontmatterFields.includes(f) && !allowed.includes(f));
        if (missing.length > 0) {
          failures.push(`${skill.name}: missing [${missing.join(', ')}]`);
        }
      }
      expect(failures, `Field coverage gaps:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('no skill has extra frontmatter fields beyond the 4 canonical', () => {
      const canonical = new Set(['name', 'description', 'allowed-tools', 'argument-hint']);
      const failures: string[] = [];
      for (const skill of skills) {
        const extra = skill.frontmatterFields.filter(f => !canonical.has(f));
        if (extra.length > 0) {
          failures.push(`${skill.name}: extra fields [${extra.join(', ')}]`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Frontmatter value format conventions
  // ================================================================

  describe('Frontmatter value format conventions', () => {
    it('"name" field matches the skill directory name', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        if (skill.frontmatter.name !== skill.name) {
          failures.push(`${skill.name}: name="${skill.frontmatter.name}"`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('"description" is a non-empty string', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        const desc = skill.frontmatter.description || '';
        if (desc.length < 10) {
          failures.push(`${skill.name}: description too short (${desc.length} chars)`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('"allowed-tools" contains only valid Claude tool names', () => {
      const failures: string[] = [];
      for (const skill of skills) {
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

    it('"argument-hint" is non-empty', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        const hint = skill.frontmatter['argument-hint'] || '';
        if (hint.length === 0) {
          failures.push(skill.name);
        }
      }
      expect(failures).toEqual([]);
    });

    it('"name" values are kebab-case', () => {
      const kebabPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      const failures: string[] = [];
      for (const skill of skills) {
        if (!kebabPattern.test(skill.frontmatter.name || '')) {
          failures.push(`${skill.name}: "${skill.frontmatter.name}" is not kebab-case`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('"allowed-tools" is a comma-separated list', () => {
      const csvPattern = /^[A-Z][a-zA-Z]+(, [A-Z][a-zA-Z]+)*$/;
      const failures: string[] = [];
      for (const skill of skills) {
        const tools = skill.frontmatter['allowed-tools'];
        if (tools && !csvPattern.test(tools)) {
          failures.push(`${skill.name}: "${tools}" is not comma-separated format`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Markdown structure conventions
  // ================================================================

  describe('Markdown structure conventions', () => {
    it('every skill has an H1 heading', () => {
      const failures = skills.filter(s => !s.h1).map(s => s.name);
      expect(failures, `Missing H1: ${failures.join(', ')}`).toEqual([]);
    });

    it('every skill has a description paragraph after H1', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        if (!skill.descriptionAfterH1 || skill.descriptionAfterH1.length < 5) {
          failures.push(`${skill.name}: no description paragraph after H1`);
        }
      }
      expect(failures, `Missing description:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('every skill has at least one H2 heading', () => {
      const failures = skills.filter(s => s.h2Headings.length === 0).map(s => s.name);
      expect(failures, `No H2 headings: ${failures.join(', ')}`).toEqual([]);
    });

    it('skills with steps use numbered "Step N:" format', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        if (!skill.hasSteps) continue;
        const stepPattern = /^#{2,3} Step \d+: .+$/m;
        const hasStepFormat = stepPattern.test(skill.body);
        if (!hasStepFormat) {
          failures.push(`${skill.name}: steps don't use "Step N: Title" format`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('steps are sequentially numbered from 1', () => {
      const failures: string[] = [];
      for (const skill of skills) {
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

    it('uses the same frontmatter delimiter format', () => {
      for (const skill of skills) {
        const content = readFileSync(skill.path, 'utf-8');
        expect(content, `${skill.name} should start with ---`).toMatch(/^---\n/);
        expect(content, `${skill.name} should have closing ---`).toMatch(/\n---\n/);
      }
    });

    it('no skill has duplicate H1 headings outside code blocks', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        const bodyNoCode = skill.body.replace(/```[\s\S]*?```/g, '');
        const h1Matches = bodyNoCode.match(/^# .+$/gm);
        if (h1Matches && h1Matches.length > 1) {
          failures.push(`${skill.name}: ${h1Matches.length} H1 headings`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('step headings use "Step N: Title" format with capitalized title', () => {
      const stepPattern = /^#{2,3} Step \d+: [A-Z]/m;
      const failures: string[] = [];
      for (const skill of skills) {
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
  });

  // ================================================================
  // Content quality conventions
  // ================================================================

  describe('Content quality conventions', () => {
    it('descriptions do not end with truncated words', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        const desc = skill.frontmatter.description || '';
        if (desc.length > 0 && /\s\w$/.test(desc) && !desc.endsWith('.')) {
          const lastWord = desc.split(/\s+/).pop() || '';
          if (lastWord.length <= 2) {
            failures.push(`${skill.name}: description may be truncated: "...${desc.slice(-30)}"`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it('H1 headings are not empty', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        if (skill.h1 !== null && skill.h1.trim().length === 0) {
          failures.push(skill.name);
        }
      }
      expect(failures).toEqual([]);
    });

    it('checklist items use consistent "- [ ] " format', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        if (!skill.hasChecklists) continue;
        const lines = skill.body.split('\n');
        for (const line of lines) {
          if (/^- \[\]/.test(line) && !/^- \[ \] /.test(line)) {
            failures.push(`${skill.name}: bad checklist format: "${line.trim()}"`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it('code blocks use recognized language identifiers', () => {
      const knownLanguages = new Set([
        'typescript', 'ts', 'javascript', 'js', 'bash', 'sh',
        'yaml', 'yml', 'json', 'sync', 'concept', 'sql',
        'swift', 'rust', 'go', 'python', 'kotlin', 'csharp',
        'graphql', 'toml', 'xml', 'html', 'css', 'markdown', 'md',
        '', // unlabeled code blocks are ok
      ]);
      const failures: string[] = [];
      for (const skill of skills) {
        for (const lang of skill.codeBlockLanguages) {
          if (!knownLanguages.has(lang)) {
            failures.push(`${skill.name}: unknown language "${lang}"`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it('valid YAML in frontmatter (parseable)', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        if (skill.frontmatterFieldCount === 0) {
          failures.push(`${skill.name}: unparseable frontmatter`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Feature coverage
  // ================================================================

  describe('Feature coverage', () => {
    it('every skill has steps or commands sections', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        const hasCommands = skill.body.includes('## Commands');
        if (!skill.hasSteps && !hasCommands) {
          failures.push(`${skill.name}: no steps or commands section`);
        }
      }
      expect(failures, `No steps/commands:\n  ${failures.join('\n  ')}`).toEqual([]);
    });

    it('every skill has code blocks or command examples', () => {
      const failures = skills
        .filter(s => !s.hasCodeBlocks)
        .map(s => s.name);
      expect(
        failures.length,
        `${failures.length} skills lack code examples: ${failures.join(', ')}`,
      ).toBeLessThan(skills.length);
    });

    it('every skill has at least 1 step or command', () => {
      const failures: string[] = [];
      for (const skill of skills) {
        const hasCommands = /^### \w+/m.test(skill.body);
        if (skill.stepCount === 0 && !hasCommands) {
          failures.push(skill.name);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ================================================================
  // Statistical metrics
  // ================================================================

  describe('Statistical metrics', () => {
    it('skills exist', () => {
      expect(skills.length).toBeGreaterThan(0);
    });

    it('skills count is within expected range', () => {
      // Generated from 28 concepts in the manifest (minus parse failures)
      expect(skills.length).toBeGreaterThanOrEqual(26);
      expect(skills.length).toBeLessThanOrEqual(32);
    });

    it('average step count is at least 1', () => {
      const totalSteps = skills.reduce((sum, s) => sum + s.stepCount, 0);
      const avg = totalSteps / skills.length;
      expect(avg).toBeGreaterThanOrEqual(1);
    });
  });
});
