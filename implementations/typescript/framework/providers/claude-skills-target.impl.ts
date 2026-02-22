// ============================================================
// Claude Skills Target Provider Handler
//
// Generates Claude Code SKILL.md files (YAML frontmatter +
// markdown body) and TypeScript command runners for each
// concept. Uses the shared Grouping concept abstraction from
// codegen-utils for all grouping modes (per-concept default).
// Architecture doc: Interface Kit
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptManifest, ActionSchema, ResolvedType } from '../../../../kernel/src/types.js';
import {
  toKebabCase,
  toCamelCase,
  toPascalCase,
  generateFileHeader,
  buildConceptGroups,
  type ConceptGroup,
  type GroupingConfig,
  type GroupingMode,
} from './codegen-utils.js';

// --- Type Display ---

/** Render a ResolvedType as a human-readable string for markdown docs. */
function typeLabel(type: ResolvedType): string {
  switch (type.kind) {
    case 'primitive': return type.primitive.toLowerCase();
    case 'param': return type.paramRef;
    case 'set': return `set<${typeLabel(type.inner)}>`;
    case 'list': return `${typeLabel(type.inner)}[]`;
    case 'option': return `${typeLabel(type.inner)}?`;
    case 'map': return `map<${typeLabel(type.keyType)}, ${typeLabel(type.inner)}>`;
    default: return 'unknown';
  }
}

// --- Workflow/Annotation Metadata Types ---

/** Workflow step from manifest YAML workflows section. */
interface WorkflowStep {
  action: string;
  title?: string;
  prose?: string;
}

/** Workflow config from manifest YAML. */
interface WorkflowConfig {
  concept: string;
  steps: WorkflowStep[];
  checklists?: Record<string, string[]>;
  references?: Array<{ path: string; label: string }>;
  'anti-patterns'?: Array<{ title: string; description: string; bad?: string; good?: string }>;
  'related-workflows'?: Array<string | { name: string; description: string }>;
  'design-principles'?: Array<{ title: string; rule: string }>;
  'content-sections'?: Array<{ heading: string; body: string; afterStep?: number }>;
  'validation-commands'?: Array<{ label: string; command: string; afterStep?: number }>;
  'quick-reference'?: { heading: string; body: string };
}

/** Annotation config from manifest YAML. */
interface AnnotationConfig {
  'tool-permissions'?: string[];
  'argument-template'?: string;
  examples?: Array<{ label: string; language: string; code: string }>;
  references?: Array<{ path: string; label: string }>;
  scaffolds?: Array<{ name: string; path: string; description: string }>;
  'trigger-description'?: string;
  'trigger-patterns'?: string[];
  'trigger-exclude'?: string[];
  'validation-commands'?: Array<{ label: string; command: string }>;
  'design-principles'?: Array<{ title: string; rule: string }>;
}

/** Extract workflow config for a concept from manifest YAML. */
function getWorkflowForConcept(
  manifestYaml: Record<string, unknown> | undefined,
  conceptName: string,
): WorkflowConfig | undefined {
  if (!manifestYaml) return undefined;
  const workflows = manifestYaml.workflows as Record<string, unknown> | undefined;
  if (!workflows) return undefined;
  for (const [_key, value] of Object.entries(workflows)) {
    const wf = value as Record<string, unknown>;
    if (wf.concept === conceptName) return wf as unknown as WorkflowConfig;
  }
  return undefined;
}

/** Extract annotation config for a concept from manifest YAML. */
function getAnnotationsForConcept(
  manifestYaml: Record<string, unknown> | undefined,
  conceptName: string,
): { concept?: AnnotationConfig; actions: Record<string, AnnotationConfig> } {
  if (!manifestYaml) return { actions: {} };
  const annotations = manifestYaml.annotations as Record<string, unknown> | undefined;
  if (!annotations?.[conceptName]) return { actions: {} };
  const conceptAnnotations = annotations[conceptName] as Record<string, unknown>;
  const result: { concept?: AnnotationConfig; actions: Record<string, AnnotationConfig> } = { actions: {} };
  for (const [key, value] of Object.entries(conceptAnnotations)) {
    if (key === 'concept') {
      result.concept = value as AnnotationConfig;
    } else {
      result.actions[key] = value as AnnotationConfig;
    }
  }
  return result;
}

// --- SKILL.md Builder ---

/**
 * Build SKILL.md content with YAML frontmatter and markdown body.
 * The frontmatter follows Claude Code's skill format.
 *
 * When workflow/annotation data is present in manifestYaml, renders
 * rich skills with numbered steps, tool permissions, examples,
 * references, checklists, and anti-patterns.
 *
 * When absent, falls back to flat command listing (preserves
 * existing Conduit output).
 */
function generateSkillMd(
  group: ConceptGroup,
  manifestYaml?: Record<string, unknown>,
): string {
  const lines: string[] = [];
  const manifest = group.concepts[0];
  const conceptName = manifest?.name;

  // Lookup workflow and annotation data
  const workflow = conceptName ? getWorkflowForConcept(manifestYaml, conceptName) : undefined;
  const annot = conceptName ? getAnnotationsForConcept(manifestYaml, conceptName) : undefined;

  // --- YAML Frontmatter ---
  lines.push('---');
  lines.push(`name: ${group.name}`);
  lines.push(`description: ${group.description}`);

  // Argument hint: use annotation template if available
  if (annot?.concept?.['argument-template']) {
    lines.push(`argument-hint: ${annot.concept['argument-template']}`);
  } else {
    const firstAction = group.concepts[0]?.actions?.[0];
    if (group.concepts.length === 1 && firstAction) {
      const paramHints = firstAction.params.map((p) => `[${p.name}]`).join(' ');
      lines.push(`argument-hint: [command] ${paramHints}`);
    } else {
      lines.push('argument-hint: [concept] [command] [args...]');
    }
  }

  // Tool permissions from annotation
  if (annot?.concept?.['tool-permissions'] && annot.concept['tool-permissions'].length > 0) {
    lines.push(`allowed-tools: ${annot.concept['tool-permissions'].join(', ')}`);
  }

  lines.push('---');
  lines.push('');

  // --- Markdown Body ---
  if (group.concepts.length === 1 && workflow) {
    // Rich workflow-based rendering
    renderWorkflowSkill(lines, manifest, workflow, annot);
  } else if (group.concepts.length === 1) {
    // Flat single-concept rendering (default)
    renderFlatSkill(lines, manifest, annot);
  } else {
    // Multi-concept rendering
    renderMultiConceptSkill(lines, group, manifestYaml);
  }

  return lines.join('\n');
}

/** Render a rich workflow-based skill with numbered steps. */
function renderWorkflowSkill(
  lines: string[],
  manifest: ConceptManifest,
  workflow: WorkflowConfig,
  annot?: { concept?: AnnotationConfig; actions: Record<string, AnnotationConfig> },
): void {
  const pascal = toPascalCase(manifest.name);
  lines.push(`# ${pascal}`);
  lines.push('');
  lines.push(manifest.purpose || `Manage ${manifest.name} resources.`);
  lines.push('');

  // Design principles — rendered before workflow steps
  const designPrinciples = workflow['design-principles'] || annot?.concept?.['design-principles'];
  if (designPrinciples && designPrinciples.length > 0) {
    lines.push('## Design Principles');
    lines.push('');
    for (const dp of designPrinciples) {
      lines.push(`- **${dp.title}:** ${dp.rule}`);
    }
    lines.push('');
  }

  // Trigger description — how to invoke this skill
  const triggerDesc = annot?.concept?.['trigger-description'];
  if (triggerDesc) {
    lines.push(`> **When to use:** ${triggerDesc}`);
    lines.push('');
  }

  // Render workflow steps as numbered sections
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const title = step.title || toPascalCase(step.action);
    lines.push(`## Step ${i + 1}: ${title}`);
    lines.push('');

    // Use action description from manifest, then step prose, then variant prose
    const action = manifest.actions.find(a => a.name === step.action);
    const prose = action?.description || step.prose || action?.variants[0]?.prose || `Execute ${step.action}`;
    lines.push(prose);
    lines.push('');

    // Arguments for this action
    if (action && action.params.length > 0) {
      const argParts = action.params.map((p, j) => `\`$${j}\` **${p.name}** (${typeLabel(p.type)})`);
      lines.push(`**Arguments:** ${argParts.join(', ')}`);
      lines.push('');
    }

    // Checklist for this step
    const checklist = workflow.checklists?.[step.action];
    if (checklist && checklist.length > 0) {
      lines.push('**Checklist:**');
      for (const item of checklist) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push('');
    }

    // Per-action examples from annotations
    const actionAnnot = annot?.actions?.[step.action];
    if (actionAnnot?.examples && actionAnnot.examples.length > 0) {
      lines.push('**Examples:**');
      for (const ex of actionAnnot.examples) {
        lines.push(`*${ex.label}*`);
        lines.push('```' + ex.language);
        lines.push(ex.code);
        lines.push('```');
      }
      lines.push('');
    }

    // Per-action references from annotations
    if (actionAnnot?.references && actionAnnot.references.length > 0) {
      lines.push('**References:**');
      for (const ref of actionAnnot.references) {
        lines.push(`- [${ref.label}](${ref.path})`);
      }
      lines.push('');
    }

    // Content sections inserted after this step
    const contentSections = workflow['content-sections']?.filter(s => s.afterStep === i + 1);
    if (contentSections && contentSections.length > 0) {
      for (const section of contentSections) {
        lines.push(`### ${section.heading}`);
        lines.push('');
        lines.push(section.body);
        lines.push('');
      }
    }

    // Validation commands inserted after this step
    const validationCmds = workflow['validation-commands']?.filter(v => v.afterStep === i + 1);
    if (validationCmds && validationCmds.length > 0) {
      lines.push('**Validation:**');
      for (const vc of validationCmds) {
        lines.push(`*${vc.label}:*`);
        lines.push('```bash');
        lines.push(vc.command);
        lines.push('```');
      }
      lines.push('');
    }
  }

  // Scaffolds section
  const scaffolds = annot?.concept?.scaffolds;
  if (scaffolds && scaffolds.length > 0) {
    lines.push('## Scaffold Templates');
    lines.push('');
    for (const sc of scaffolds) {
      lines.push(`### ${sc.name}`);
      lines.push(sc.description);
      lines.push(`See [${sc.name}](${sc.path})`);
      lines.push('');
    }
  }

  // References section
  const refs = workflow.references || annot?.concept?.references;
  if (refs && refs.length > 0) {
    lines.push('## References');
    lines.push('');
    for (const ref of refs) {
      lines.push(`- [${ref.label}](${ref.path})`);
    }
    lines.push('');
  }

  // Quick reference section
  const quickRef = workflow['quick-reference'];
  if (quickRef) {
    lines.push(`## ${quickRef.heading}`);
    lines.push('');
    lines.push(quickRef.body);
    lines.push('');
  }

  // Anti-patterns section
  const antiPatterns = workflow['anti-patterns'];
  if (antiPatterns && antiPatterns.length > 0) {
    lines.push('## Anti-Patterns');
    lines.push('');
    for (const ap of antiPatterns) {
      lines.push(`### ${ap.title}`);
      lines.push(ap.description);
      if (ap.bad) {
        lines.push('');
        lines.push('**Bad:**');
        lines.push('```');
        lines.push(ap.bad);
        lines.push('```');
      }
      if (ap.good) {
        lines.push('');
        lines.push('**Good:**');
        lines.push('```');
        lines.push(ap.good);
        lines.push('```');
      }
      lines.push('');
    }
  }

  // Validation commands (global, not step-specific)
  const globalValidation = annot?.concept?.['validation-commands']
    || workflow['validation-commands']?.filter(v => !v.afterStep);
  if (globalValidation && globalValidation.length > 0) {
    lines.push('## Validation');
    lines.push('');
    for (const vc of globalValidation) {
      lines.push(`*${vc.label}:*`);
      lines.push('```bash');
      lines.push(vc.command);
      lines.push('```');
    }
    lines.push('');
  }

  // Related workflows
  const related = workflow['related-workflows'];
  if (related && related.length > 0) {
    lines.push('## Related Skills');
    lines.push('');
    for (const r of related) {
      if (typeof r === 'string') {
        lines.push(`- /${r}`);
      } else {
        lines.push(`- /${r.name} — ${r.description}`);
      }
    }
    lines.push('');
  }
}

/** Render a flat single-concept skill (default, preserves existing output). */
function renderFlatSkill(
  lines: string[],
  manifest: ConceptManifest,
  annot?: { concept?: AnnotationConfig; actions: Record<string, AnnotationConfig> },
): void {
  const pascal = toPascalCase(manifest.name);

  lines.push(`# ${pascal}`);
  lines.push('');
  lines.push(manifest.purpose || `Manage ${manifest.name} resources.`);
  lines.push('');
  lines.push('## Commands');
  lines.push('');

  for (const action of manifest.actions) {
    lines.push(`### ${action.name}`);
    // Prefer action description, fall back to variant prose
    const prose = action.description || action.variants[0]?.prose || `Execute ${action.name}`;
    lines.push(prose);
    lines.push('');

    if (action.params.length > 0) {
      const argParts = action.params.map((p, i) => `\`$${i}\` **${p.name}** (${typeLabel(p.type)})`);
      lines.push(`**Arguments:** ${argParts.join(', ')}`);
      lines.push('');
    }

    // Per-action examples from annotations
    const actionAnnot = annot?.actions?.[action.name];
    if (actionAnnot?.examples && actionAnnot.examples.length > 0) {
      for (const ex of actionAnnot.examples) {
        lines.push(`*${ex.label}*`);
        lines.push('```' + ex.language);
        lines.push(ex.code);
        lines.push('```');
        lines.push('');
      }
    }
  }
}

/** Render a multi-concept skill (grouped mode). */
function renderMultiConceptSkill(
  lines: string[],
  group: ConceptGroup,
  manifestYaml?: Record<string, unknown>,
): void {
  const pascal = toPascalCase(group.name);

  lines.push(`# ${pascal}`);
  lines.push('');
  lines.push(group.description);
  lines.push('');

  for (const manifest of group.concepts) {
    const conceptPascal = toPascalCase(manifest.name);
    const conceptKebab = toKebabCase(manifest.name);
    const annot = getAnnotationsForConcept(manifestYaml, manifest.name);

    lines.push(`## ${conceptPascal}`);
    lines.push('');
    lines.push(manifest.purpose || `Manage ${manifest.name} resources.`);
    lines.push('');

    lines.push(`See [${conceptKebab}.commands.ts](${conceptKebab}.commands.ts) for programmatic dispatch.`);
    lines.push('');

    for (const action of manifest.actions) {
      lines.push(`### ${conceptKebab} ${action.name}`);
      const prose = action.description || action.variants[0]?.prose || `Execute ${action.name}`;
      lines.push(prose);
      lines.push('');

      if (action.params.length > 0) {
        const argParts = action.params.map((p, i) => `\`$${i}\` **${p.name}** (${typeLabel(p.type)})`);
        lines.push(`**Arguments:** ${argParts.join(', ')}`);
        lines.push('');
      }

      // Per-action examples
      const actionAnnot = annot.actions?.[action.name];
      if (actionAnnot?.examples && actionAnnot.examples.length > 0) {
        for (const ex of actionAnnot.examples) {
          lines.push(`*${ex.label}*`);
          lines.push('```' + ex.language);
          lines.push(ex.code);
          lines.push('```');
          lines.push('');
        }
      }
    }
  }
}

// --- TypeScript Runner Builder ---

/**
 * Build the TypeScript command runner for a concept.
 * Provides a handleXxxSkill function that dispatches commands
 * to the kernel, plus an exported list of valid command names.
 */
function generateCommandRunner(
  manifest: ConceptManifest,
  conceptName: string,
): string {
  const pascal = toPascalCase(conceptName);
  const camel = toCamelCase(conceptName);
  const actionNames = manifest.actions.map((a) => a.name);
  const lines: string[] = [];

  lines.push(generateFileHeader('claude-skills', conceptName));

  // Handler function
  lines.push(`export async function handle${pascal}Skill(`);
  lines.push('  command: string,');
  lines.push('  args: Record<string, string>,');
  lines.push('  kernel: { handleRequest: (input: Record<string, unknown>) => Promise<any> },');
  lines.push('): Promise<string> {');
  lines.push('  const result = await kernel.handleRequest({ method: command, ...args });');
  lines.push('  if (result.error) return `Error: ${result.error}`;');
  lines.push('  return JSON.stringify(result.body, null, 2);');
  lines.push('}');
  lines.push('');

  // Exported command list
  const commandList = actionNames.map((n) => `'${n}'`).join(', ');
  lines.push(`export const ${camel}SkillCommands = [${commandList}];`);
  lines.push('');

  return lines.join('\n');
}

// --- Concept Handler ---

export const claudeSkillsTargetHandler: ConceptHandler = {
  /**
   * Generate Claude Code SKILL.md files and TypeScript command runners.
   *
   * In per-concept mode (default), called once per concept with input.projection.
   * The generator also passes input.allProjections + input.config for grouped modes.
   *
   * Returns files: SKILL.md + .commands.ts per concept in the group.
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    // --- Parse config ---
    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as Record<string, unknown>;
      } catch { /* use defaults */ }
    }

    const grouping = (config.grouping as string) || 'per-concept';

    // --- Single concept path (per-concept mode or called per-concept by generator) ---
    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      return { variant: 'ok', files: [] };
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw);
    } catch {
      return { variant: 'ok', files: [] };
    }

    const manifestRaw = projection.conceptManifest as string | Record<string, unknown>;
    const conceptName = projection.conceptName as string;

    let manifest: ConceptManifest;
    if (typeof manifestRaw === 'string') {
      try {
        manifest = JSON.parse(manifestRaw) as ConceptManifest;
      } catch {
        return { variant: 'ok', files: [] };
      }
    } else {
      manifest = manifestRaw as ConceptManifest;
    }

    const name = conceptName || manifest.name;
    const kebab = toKebabCase(name);

    // --- Determine if we need multi-concept grouping ---
    // When grouping is not per-concept, we need allProjections to group.
    // However, the generator calls us per-concept. For non-per-concept modes,
    // we accumulate: emit the SKILL.md only when we have allProjections context,
    // but always emit the per-concept .commands.ts.

    // Parse manifestYaml for workflow/annotation metadata
    let parsedManifestYaml: Record<string, unknown> | undefined;
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        parsedManifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch { /* ignore malformed manifest YAML */ }
    }

    const files: Array<{ path: string; content: string }> = [];

    // Always emit the per-concept command runner
    const tsContent = generateCommandRunner(manifest, name);
    files.push({
      path: `${kebab}/${kebab}.commands.ts`,
      content: tsContent,
    });

    // For per-concept mode: also emit a SKILL.md per concept
    if (grouping === 'per-concept') {
      const group: ConceptGroup = {
        name: kebab,
        description: manifest.purpose || `Manage ${name} resources`,
        concepts: [manifest],
      };
      const skillMd = generateSkillMd(group, parsedManifestYaml);
      files.push({
        path: `${kebab}/SKILL.md`,
        content: skillMd,
      });
    }

    // For grouped modes: check if allProjections is available.
    // If so, build groups and emit SKILL.md files for all groups.
    // The generator passes allProjections only once; we detect this
    // by checking if this is the first concept (to avoid duplicates).
    if (grouping !== 'per-concept' && input.allProjections) {
      let allProjections: Record<string, unknown>[];
      try {
        allProjections = JSON.parse(input.allProjections as string);
      } catch {
        allProjections = [];
      }

      // Only emit group SKILL.md files on the first concept call
      const firstConceptName = allProjections[0]
        ? (allProjections[0].conceptName as string)
        : undefined;

      if (firstConceptName && name === firstConceptName) {
        // Parse all manifests from projections
        const allManifests: ConceptManifest[] = [];
        for (const proj of allProjections) {
          const mRaw = proj.conceptManifest as string;
          if (!mRaw) continue;
          try {
            allManifests.push(JSON.parse(mRaw) as ConceptManifest);
          } catch { continue; }
        }

        const groupingConfig: GroupingConfig = {
          strategy: (config.grouping as GroupingMode) || 'per-concept',
          name: config.name as string,
          custom: config.skills as GroupingConfig['custom'],
        };
        const groups = buildConceptGroups(allManifests, groupingConfig);
        for (const group of groups) {
          const skillMd = generateSkillMd(group, parsedManifestYaml);
          files.push({
            path: `${group.name}/SKILL.md`,
            content: skillMd,
          });

          // For grouped modes, command runners go in the group directory
          for (const m of group.concepts) {
            const mKebab = toKebabCase(m.name);
            // Only emit if not already emitted above (avoid duplicates for current concept)
            if (mKebab !== kebab) {
              files.push({
                path: `${group.name}/${mKebab}.commands.ts`,
                content: generateCommandRunner(m, m.name),
              });
            } else {
              // Move the current concept's runner into the group directory
              const existingIdx = files.findIndex((f) => f.path === `${kebab}/${kebab}.commands.ts`);
              if (existingIdx >= 0) {
                files[existingIdx].path = `${group.name}/${mKebab}.commands.ts`;
              }
            }
          }
        }
      }
    }

    return { variant: 'ok', files };
  },
};
