// ============================================================
// Target Provider Tests — Claude Skills & CLI
//
// Tests for the claude-skills and CLI target providers,
// including workflow/annotation metadata rendering and
// action description propagation.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { claudeSkillsTargetHandler } from '../handlers/ts/framework/providers/claude-skills-target.handler.js';
import { cliTargetHandler } from '../handlers/ts/framework/providers/cli-target.handler.js';
import type { ConceptManifest } from '../kernel/src/types.js';

// --- Test Fixtures ---

const ECHO_MANIFEST: ConceptManifest = {
  uri: 'urn:copf/Echo',
  name: 'Echo',
  purpose: 'Echo messages back for health checking.',
  actions: [
    {
      name: 'send',
      params: [{ name: 'message', type: { kind: 'primitive', primitive: 'String' } }],
      variants: [
        { tag: 'ok', fields: [{ name: 'echo', type: { kind: 'primitive', primitive: 'String' } }], prose: 'Message echoed.' },
      ],
    },
  ],
  relations: [],
  typeParams: [{ name: 'E', wireType: 'string' }],
};

const SPEC_PARSER_MANIFEST: ConceptManifest = {
  uri: 'urn:copf/SpecParser',
  name: 'SpecParser',
  purpose: 'Parse .concept specification files into ConceptAST.',
  category: 'devtools',
  visibility: 'public',
  actions: [
    {
      name: 'parse',
      description: 'Parse and validate all .concept specs in the project.',
      params: [{ name: 'specs', type: { kind: 'primitive', primitive: 'String' } }],
      variants: [
        { tag: 'ok', fields: [{ name: 'results', type: { kind: 'list', inner: { kind: 'primitive', primitive: 'String' } } }], prose: 'All specs parsed.' },
        { tag: 'error', fields: [{ name: 'message', type: { kind: 'primitive', primitive: 'String' } }], prose: 'Parse failed.' },
      ],
    },
  ],
  relations: [],
  typeParams: [{ name: 'S', wireType: 'string' }],
};

// Manifest YAML with workflow + annotation data for SpecParser
const DEVTOOLS_MANIFEST_YAML = {
  interface: { name: 'copf-devtools', version: '0.1.0' },
  targets: { 'claude-skills': { name: 'copf-devtools', grouping: 'per-concept' } },
  workflows: {
    'concept-validator': {
      concept: 'SpecParser',
      steps: [
        { action: 'parse', title: 'Parse and Validate', prose: 'Parse all .concept specs and report errors.' },
      ],
      checklists: {
        parse: ['Has purpose block?', 'Actions have variants?', 'Invariants reference valid actions?'],
      },
      'checklist-labels': {
        parse: 'Validation checklist',
      },
      'step-references': {
        parse: [
          { path: 'references/concept-grammar.md', label: 'Concept grammar reference', context: 'the complete grammar' },
        ],
      },
      references: [
        { path: 'references/concept-grammar.md', label: 'Concept grammar reference' },
      ],
      'anti-patterns': [
        { title: 'Kitchen-sink concept', description: 'Concept has multiple unrelated purposes.' },
      ],
      'related-workflows': ['sync-designer', 'implementation-builder'],
      'example-walkthroughs': [
        { path: 'examples/domain-concepts.md', label: 'Domain concept examples', description: 'Password, Follow, Article' },
      ],
      'quick-reference': {
        heading: 'Quick Reference: Concept Structure',
        body: '```\nconcept Name [T] {\n  purpose { ... }\n  state { ... }\n  actions { ... }\n}\n```',
      },
    },
  },
  annotations: {
    SpecParser: {
      concept: {
        'tool-permissions': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
        'argument-template': '$ARGUMENTS',
        'skill-title': 'Validate COPF Concept Specs',
      },
      parse: {
        examples: [
          { label: 'Parse a concept file', language: 'typescript', code: 'const ast = parseConceptFile(source);' },
        ],
      },
    },
  },
};

// ============================================================
// Claude Skills Target — Flat Rendering (no workflow data)
// ============================================================

describe('Claude Skills Target — Flat Rendering', () => {
  it('generates SKILL.md and commands.ts for a concept', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'Echo', conceptManifest: JSON.stringify(ECHO_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBeGreaterThanOrEqual(2);

    const skillMd = files.find(f => f.path.endsWith('SKILL.md'));
    const commandsTs = files.find(f => f.path.endsWith('.commands.ts'));

    expect(skillMd).toBeDefined();
    expect(commandsTs).toBeDefined();
  });

  it('SKILL.md has YAML frontmatter with name, description, argument-hint', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'Echo', conceptManifest: JSON.stringify(ECHO_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('---');
    expect(skillMd.content).toContain('name: echo');
    expect(skillMd.content).toContain('description:');
    expect(skillMd.content).toContain('argument-hint:');
  });

  it('SKILL.md body lists commands with action names', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'Echo', conceptManifest: JSON.stringify(ECHO_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('# Echo');
    expect(skillMd.content).toContain('### send');
    expect(skillMd.content).toContain('**Arguments:**');
  });

  it('uses action.description when available in flat mode', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    // action.description should appear (not just variant prose)
    expect(skillMd.content).toContain('Parse and validate all .concept specs in the project.');
  });
});

// ============================================================
// Claude Skills Target — Workflow Rendering
// ============================================================

describe('Claude Skills Target — Workflow Rendering', () => {
  it('renders workflow steps as numbered sections under wrapper heading', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    // Steps are nested under a wrapper section
    expect(skillMd.content).toContain('## Step-by-Step Process');
    expect(skillMd.content).toContain('### Step 1: Parse and Validate');
  });

  it('includes tool-permissions in frontmatter', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('allowed-tools: Read, Grep, Glob, Edit, Write, Bash');
  });

  it('includes argument-template in frontmatter', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('argument-hint: $ARGUMENTS');
  });

  it('renders checklists within workflow steps', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    // Uses named checklist label from checklist-labels
    expect(skillMd.content).toContain('**Validation checklist:**');
    expect(skillMd.content).toContain('- [ ] Has purpose block?');
    expect(skillMd.content).toContain('- [ ] Actions have variants?');
  });

  it('renders code examples from annotations', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('**Examples:**');
    expect(skillMd.content).toContain('```typescript');
    expect(skillMd.content).toContain('parseConceptFile(source)');
  });

  it('renders references section', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('## References');
    expect(skillMd.content).toContain('[Concept grammar reference](references/concept-grammar.md)');
  });

  it('renders anti-patterns section', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('## Anti-Patterns');
    expect(skillMd.content).toContain('### Kitchen-sink concept');
  });

  it('renders related skills/workflows section', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('## Related Skills');
    // skill-md format renders related-workflows as a table
    expect(skillMd.content).toContain('| Skill | When to Use |');
    expect(skillMd.content).toContain('`/sync-designer`');
    expect(skillMd.content).toContain('`/implementation-builder`');
  });

  it('uses skill-title annotation for descriptive heading', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    // Uses skill-title from annotations instead of PascalCase concept name
    expect(skillMd.content).toContain('# Validate COPF Concept Specs');
  });

  it('renders per-step inline references', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    // step-references rendered inline within the step
    expect(skillMd.content).toContain('Read [Concept grammar reference](references/concept-grammar.md) for the complete grammar.');
  });

  it('renders example-walkthroughs section', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('## Example Walkthroughs');
    expect(skillMd.content).toContain('[Domain concept examples](examples/domain-concepts.md)');
    expect(skillMd.content).toContain('Password, Follow, Article');
  });

  it('renders quick-reference section', async () => {
    const storage = createInMemoryStorage();
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    expect(skillMd.content).toContain('## Quick Reference: Concept Structure');
    expect(skillMd.content).toContain('concept Name [T]');
  });

  it('falls back to flat rendering when no workflow data exists', async () => {
    const storage = createInMemoryStorage();
    // Pass manifestYaml that has NO workflow for Echo
    const result = await claudeSkillsTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'Echo', conceptManifest: JSON.stringify(ECHO_MANIFEST) }),
        config: JSON.stringify({ grouping: 'per-concept' }),
        manifestYaml: JSON.stringify(DEVTOOLS_MANIFEST_YAML),
      },
      storage,
    );

    const skillMd = (result.files as Array<{ path: string; content: string }>)
      .find(f => f.path.endsWith('SKILL.md'))!;

    // Should use flat rendering (## Commands), not workflow (### Step N:)
    expect(skillMd.content).toContain('## Commands');
    expect(skillMd.content).not.toContain('### Step 1:');
  });
});

// ============================================================
// CLI Target — Action Description Propagation
// ============================================================

describe('CLI Target — Action Description', () => {
  it('generates a command file for a concept', async () => {
    const storage = createInMemoryStorage();
    const result = await cliTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'Echo', conceptManifest: JSON.stringify(ECHO_MANIFEST) }),
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as Array<{ path: string; content: string }>;
    expect(files.length).toBe(1);
    expect(files[0].path).toContain('.command.ts');
  });

  it('uses variant prose as description when no action.description', async () => {
    const storage = createInMemoryStorage();
    const result = await cliTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'Echo', conceptManifest: JSON.stringify(ECHO_MANIFEST) }),
      },
      storage,
    );

    const file = (result.files as Array<{ path: string; content: string }>)[0];
    expect(file.content).toContain("'Message echoed.'");
  });

  it('prefers action.description over variant prose', async () => {
    const storage = createInMemoryStorage();
    const result = await cliTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'SpecParser', conceptManifest: JSON.stringify(SPEC_PARSER_MANIFEST) }),
      },
      storage,
    );

    const file = (result.files as Array<{ path: string; content: string }>)[0];
    // Should use action.description, not variant prose
    expect(file.content).toContain('Parse and validate all .concept specs in the project.');
  });

  it('uses override description when provided', async () => {
    const storage = createInMemoryStorage();
    const result = await cliTargetHandler.generate(
      {
        projection: JSON.stringify({ conceptName: 'Echo', conceptManifest: JSON.stringify(ECHO_MANIFEST) }),
        overrides: JSON.stringify({ send: { description: 'Custom override description' } }),
      },
      storage,
    );

    const file = (result.files as Array<{ path: string; content: string }>)[0];
    expect(file.content).toContain('Custom override description');
  });
});
