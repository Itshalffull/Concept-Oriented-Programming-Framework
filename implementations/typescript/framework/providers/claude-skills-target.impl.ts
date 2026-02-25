// ============================================================
// Claude Skills Target Provider Handler
//
// Generates Claude Code SKILL.md files (YAML frontmatter +
// markdown body) and TypeScript command runners for each
// concept. Uses the shared Grouping concept abstraction from
// codegen-utils for all grouping modes (per-concept default).
//
// Enrichment rendering is delegated to the Renderer concept.
// The target owns structural rendering (frontmatter, workflow
// step numbering, action arguments) and calls renderContent()
// / renderKey() for enrichment blocks. New enrichment keys
// only need a handler registered in the Renderer — no changes
// to this file.
// Architecture doc: Interface Kit
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptManifest, ActionSchema, ResolvedType } from '../../../../kernel/src/types.js';
import {
  toKebabCase,
  toCamelCase,
  toPascalCase,
  generateFileHeader,
  buildConceptGroups,
  getHierarchicalTrait,
  type ConceptGroup,
  type GroupingConfig,
  type GroupingMode,
  type HierarchicalConfig,
} from './codegen-utils.js';
import { renderContent, renderKey, interpolateVars, filterByTier } from './renderer.impl.js';

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
//
// Concepts store enrichment as opaque content (JSON passthrough).
// The Renderer concept handles rendering of enrichment keys.
// These types define only the structural fields needed for
// workflow step rendering and annotation lookup.

/** Workflow step from manifest YAML workflows section. */
interface WorkflowStep {
  action: string;
  title?: string;
  prose?: string;
}

/**
 * Workflow config from manifest YAML.
 * Structural fields: concept, steps (the concept owns ordering).
 * All decoration keys are opaque — rendered by the Renderer.
 */
type WorkflowConfig = {
  concept: string;
  steps: WorkflowStep[];
} & Record<string, unknown>;

/**
 * Annotation config from manifest YAML.
 * Entirely opaque — rendered by the Renderer.
 */
type AnnotationConfig = Record<string, unknown>;

/**
 * Read a key from opaque content, cast to T.
 * Used for structural fields the target needs directly
 * (e.g. step-specific checklists, per-action examples).
 */
function contentKey<T>(obj: Record<string, unknown> | undefined, key: string): T | undefined {
  if (!obj || !(key in obj)) return undefined;
  return obj[key] as T;
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

/**
 * Merge workflow and annotation content into a single enrichment
 * object for rendering. Workflow keys take precedence; annotation
 * keys fill in gaps. Structural keys (concept, steps) are excluded.
 */
function mergeEnrichment(
  workflow?: WorkflowConfig,
  annot?: AnnotationConfig,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  // Annotation keys first (lower priority)
  if (annot) {
    for (const [key, value] of Object.entries(annot)) {
      // Skip structural keys that aren't enrichment
      if (key === 'tool-permissions' || key === 'argument-template') continue;
      if (key === 'trigger-patterns' || key === 'trigger-exclude') continue;
      merged[key] = value;
    }
  }

  // Workflow keys override (higher priority)
  if (workflow) {
    for (const [key, value] of Object.entries(workflow)) {
      if (key === 'concept' || key === 'steps') continue;
      merged[key] = value;
    }
  }

  return merged;
}

// --- SKILL.md Builder ---

/**
 * Build SKILL.md content with YAML frontmatter and markdown body.
 *
 * Structural rendering (frontmatter, step numbering, action arguments)
 * is handled here. Enrichment blocks are delegated to the Renderer.
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
  const hierConfig = conceptName ? getHierarchicalTrait(manifestYaml, conceptName) : undefined;

  // --- YAML Frontmatter ---
  lines.push('---');
  lines.push(`name: ${group.name}`);
  lines.push(`description: ${group.description}`);

  // Argument hint: use annotation template if available
  const argTemplate = contentKey<string>(annot?.concept, 'argument-template');
  if (argTemplate) {
    lines.push(`argument-hint: ${argTemplate}`);
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
  const toolPerms = contentKey<string[]>(annot?.concept, 'tool-permissions');
  if (toolPerms && toolPerms.length > 0) {
    lines.push(`allowed-tools: ${toolPerms.join(', ')}`);
  }

  lines.push('---');
  lines.push('');

  // --- Markdown Body ---
  if (group.concepts.length === 1 && workflow) {
    renderWorkflowSkill(lines, manifest, workflow, annot, hierConfig);
  } else if (group.concepts.length === 1) {
    renderFlatSkill(lines, manifest, annot, hierConfig);
  } else {
    renderMultiConceptSkill(lines, group, manifestYaml, hierConfig);
  }

  return lines.join('\n');
}

/**
 * Render a rich workflow-based skill with numbered steps.
 *
 * The target owns: heading, purpose, step numbering, action
 * arguments, step-specific interleaving (checklists per action,
 * content-sections/validation-commands placed after specific steps,
 * per-action examples/references from annotations).
 *
 * The Renderer owns: global enrichment sections rendered before
 * and after the workflow steps (design-principles, trigger,
 * scaffolds, references, anti-patterns, quick-reference, etc.).
 */
function renderWorkflowSkill(
  lines: string[],
  manifest: ConceptManifest,
  workflow: WorkflowConfig,
  annot?: { concept?: AnnotationConfig; actions: Record<string, AnnotationConfig> },
  hierConfig?: HierarchicalConfig,
): void {
  const pascal = toPascalCase(manifest.name);
  const enrichment = mergeEnrichment(workflow, annot?.concept);
  const fmt = 'skill-md';

  // --- Header ---
  // Use skill-title from annotations for a descriptive heading (e.g.
  // "Create a New COPF Concept") instead of just the PascalCase concept name.
  const skillTitle = contentKey<string>(annot?.concept, 'skill-title');
  lines.push(`# ${skillTitle || pascal}`);
  lines.push('');

  // Intro line: use intro-template with variable interpolation if available,
  // otherwise fall back to manifest.purpose.
  const introTemplate = contentKey<string>(annot?.concept, 'intro-template');
  if (introTemplate) {
    const vars: Record<string, string> = { ARGUMENTS: '$ARGUMENTS', CONCEPT: manifest.name };
    lines.push(interpolateVars(introTemplate, vars));
  } else {
    lines.push(manifest.purpose || `Manage ${manifest.name} resources.`);
  }
  lines.push('');

  // --- Pre-step enrichment (rendered by Renderer) ---
  // Design principles and trigger description appear before steps
  const preStepKeys: Record<string, unknown> = {};
  if (enrichment['design-principles']) preStepKeys['design-principles'] = enrichment['design-principles'];
  if (enrichment['trigger-description']) preStepKeys['trigger-description'] = enrichment['trigger-description'];
  if (Object.keys(preStepKeys).length > 0) {
    const { output } = renderContent(preStepKeys, fmt);
    if (output) lines.push(output);
  }

  // --- Step heading hierarchy ---
  // Matches handmade skill structure: "## Step-by-Step Process" wrapper
  // with steps rendered as "### Step N:" underneath.
  const stepsHeading = contentKey<string>(workflow, 'steps-heading') || 'Step-by-Step Process';
  lines.push(`## ${stepsHeading}`);
  lines.push('');

  // --- Workflow steps (structural — target owns this) ---
  const allContentSections = contentKey<Array<{ heading: string; body: string; afterStep?: number }>>(workflow, 'content-sections');
  const allValidationCmds = contentKey<Array<{ label: string; command: string; afterStep?: number }>>(workflow, 'validation-commands');
  const stepRefs = contentKey<Record<string, Array<{ path: string; label: string; context?: string }>>>(workflow, 'step-references');
  const checklistLabels = contentKey<Record<string, string>>(workflow, 'checklist-labels');

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const title = step.title || toPascalCase(step.action);
    lines.push(`### Step ${i + 1}: ${title}`);
    lines.push('');

    // Action prose
    const action = manifest.actions.find(a => a.name === step.action);
    const prose = action?.description || step.prose || action?.variants[0]?.prose || `Execute ${step.action}`;
    lines.push(prose);
    lines.push('');

    // Per-step inline references — rendered as "Read [label](path) for..."
    // within the step, matching handmade skill format.
    const refs = stepRefs?.[step.action];
    if (refs && refs.length > 0) {
      for (const ref of refs) {
        const suffix = ref.context ? ` for ${ref.context}` : '';
        lines.push(`Read [${ref.label}](${ref.path})${suffix}.`);
      }
      lines.push('');
    }

    // Arguments
    if (action && action.params.length > 0) {
      const argParts = action.params.map((p, j) => `\`$${j}\` **${p.name}** (${typeLabel(p.type)})`);
      lines.push(`**Arguments:** ${argParts.join(', ')}`);
      lines.push('');
    }

    // Step-specific checklist with named heading
    const checklists = contentKey<Record<string, string[]>>(workflow, 'checklists');
    const checklist = checklists?.[step.action];
    if (checklist && checklist.length > 0) {
      const label = checklistLabels?.[step.action] || 'Checklist';
      lines.push(`**${label}:**`);
      for (const item of checklist) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push('');
    }

    // Per-action enrichment from annotations (rendered by Renderer)
    const actionAnnot = annot?.actions?.[step.action];
    if (actionAnnot) {
      const actionEnrichment: Record<string, unknown> = {};
      if (actionAnnot.examples) actionEnrichment.examples = actionAnnot.examples;
      if (actionAnnot.references) actionEnrichment.references = actionAnnot.references;
      if (Object.keys(actionEnrichment).length > 0) {
        const { output } = renderContent(actionEnrichment, fmt);
        if (output) lines.push(output);
      }
    }

    // Content sections inserted after this step
    const contentSections = allContentSections?.filter(s => s.afterStep === i + 1);
    if (contentSections && contentSections.length > 0) {
      for (const section of contentSections) {
        lines.push(`#### ${section.heading}`);
        lines.push('');
        lines.push(section.body);
        lines.push('');
      }
    }

    // Validation commands inserted after this step
    const validationCmds = allValidationCmds?.filter(v => v.afterStep === i + 1);
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

  // @hierarchical: add tree navigation note
  if (hierConfig) {
    lines.push('## Tree Navigation');
    lines.push('');
    lines.push('This concept has hierarchical structure. When working with nested items:');
    lines.push('');
    lines.push('1. Identify the parent node first');
    lines.push('2. Navigate to the target level using the parent path');
    lines.push('3. Perform the action at the correct level');
    lines.push('');
    lines.push('- [ ] Verify parent exists before creating children');
    lines.push('- [ ] Check depth limit when recursing');
    lines.push('');
  }

  // --- Post-step enrichment (rendered by Renderer) ---
  // Everything except pre-step keys, structural keys, and step-specific keys
  const postStepKeys: Record<string, unknown> = {};
  const skipKeys = new Set([
    'concept', 'steps',                     // structural
    'design-principles', 'trigger-description', // pre-step
    'checklists', 'checklist-labels',       // step-specific
    'step-references', 'steps-heading',     // step-structural
    'content-sections', 'validation-commands',  // step-interleaved (handled above)
  ]);
  for (const [key, value] of Object.entries(enrichment)) {
    if (!skipKeys.has(key)) {
      postStepKeys[key] = value;
    }
  }

  // Add global validation commands (no afterStep) and global content sections
  const globalValidation = allValidationCmds?.filter(v => !v.afterStep);
  if (globalValidation && globalValidation.length > 0) {
    postStepKeys['validation-commands'] = globalValidation;
  }
  const globalContentSections = allContentSections?.filter(s => !s.afterStep);
  if (globalContentSections && globalContentSections.length > 0) {
    postStepKeys['content-sections'] = globalContentSections;
  }

  if (Object.keys(postStepKeys).length > 0) {
    const { output } = renderContent(postStepKeys, fmt);
    if (output) lines.push(output);
  }
}

/** Render a flat single-concept skill (default, preserves existing output). */
function renderFlatSkill(
  lines: string[],
  manifest: ConceptManifest,
  annot?: { concept?: AnnotationConfig; actions: Record<string, AnnotationConfig> },
  hierConfig?: HierarchicalConfig,
): void {
  const pascal = toPascalCase(manifest.name);
  const fmt = 'skill-md';

  // Use skill-title for a descriptive heading, falling back to PascalCase.
  const skillTitle = contentKey<string>(annot?.concept, 'skill-title');
  lines.push(`# ${skillTitle || pascal}`);
  lines.push('');

  // Intro line: use intro-template with variable interpolation if available
  const introTemplate = contentKey<string>(annot?.concept, 'intro-template');
  if (introTemplate) {
    const vars: Record<string, string> = { ARGUMENTS: '$ARGUMENTS', CONCEPT: manifest.name };
    lines.push(interpolateVars(introTemplate, vars));
  } else {
    lines.push(manifest.purpose || `Manage ${manifest.name} resources.`);
  }
  lines.push('');
  lines.push('## Commands');
  lines.push('');

  for (const action of manifest.actions) {
    lines.push(`### ${action.name}`);
    const prose = action.description || action.variants[0]?.prose || `Execute ${action.name}`;
    lines.push(prose);
    lines.push('');

    if (action.params.length > 0) {
      const argParts = action.params.map((p, i) => `\`$${i}\` **${p.name}** (${typeLabel(p.type)})`);
      lines.push(`**Arguments:** ${argParts.join(', ')}`);
      lines.push('');
    }

    // Per-action enrichment from annotations (rendered by Renderer)
    const actionAnnot = annot?.actions?.[action.name];
    if (actionAnnot) {
      const actionEnrichment: Record<string, unknown> = {};
      if (actionAnnot.examples) actionEnrichment.examples = actionAnnot.examples;
      if (Object.keys(actionEnrichment).length > 0) {
        const { output } = renderContent(actionEnrichment, fmt);
        if (output) lines.push(output);
      }
    }
  }

  // @hierarchical: add tree navigation note
  if (hierConfig) {
    lines.push('## Tree Navigation');
    lines.push('');
    lines.push('This concept has hierarchical structure. When working with nested items:');
    lines.push('');
    lines.push('1. Identify the parent node first');
    lines.push('2. Navigate to the target level using the parent path');
    lines.push('3. Perform the action at the correct level');
    lines.push('');
    lines.push('- [ ] Verify parent exists before creating children');
    lines.push('- [ ] Check depth limit when recursing');
    lines.push('');
  }
}

/** Render a multi-concept skill (grouped mode). */
function renderMultiConceptSkill(
  lines: string[],
  group: ConceptGroup,
  manifestYaml?: Record<string, unknown>,
  hierConfig?: HierarchicalConfig,
): void {
  const pascal = toPascalCase(group.name);
  const fmt = 'skill-md';

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

      // Per-action enrichment from annotations (rendered by Renderer)
      const actionAnnot = annot.actions?.[action.name];
      if (actionAnnot) {
        const actionEnrichment: Record<string, unknown> = {};
        if (actionAnnot.examples) actionEnrichment.examples = actionAnnot.examples;
        if (Object.keys(actionEnrichment).length > 0) {
          const { output } = renderContent(actionEnrichment, fmt);
          if (output) lines.push(output);
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
  async register() {
    return {
      variant: 'ok',
      name: 'ClaudeSkillsTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'ClaudeSkills',
      capabilities: JSON.stringify(['skill-md', 'command-runner', 'enrichment']),
      targetKey: 'claude-skills',
      providerType: 'target',
    };
  },

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

      // --- Companion file emission ---
      // Emit supporting materials (examples/, references/, templates/)
      // from companion-docs and references enrichment keys. Reference
      // items with tier=reference are emitted as separate files; others
      // stay inline (already rendered in SKILL.md by the Renderer).
      const conceptAnnot = getAnnotationsForConcept(parsedManifestYaml, name);
      const conceptWorkflow = getWorkflowForConcept(parsedManifestYaml, name);
      const enrichment = mergeEnrichment(conceptWorkflow, conceptAnnot?.concept);

      // Emit companion-docs items as separate files
      const companionDocs = enrichment['companion-docs'] as Array<{ path: string; content?: string; label: string; tier?: string }> | undefined;
      if (companionDocs) {
        for (const doc of companionDocs) {
          if (doc.content && doc.path) {
            files.push({ path: `${kebab}/${doc.path}`, content: doc.content });
          }
        }
      }

      // Emit reference items with tier=reference as companion files
      const references = enrichment.references as Array<{ path: string; label: string; tier?: string; content?: string }> | undefined;
      if (references) {
        const refDocs = filterByTier(references, 'reference');
        for (const ref of refDocs) {
          if (ref.content && ref.path) {
            files.push({ path: `${kebab}/${ref.path}`, content: ref.content });
          }
        }
      }
    }

    // For grouped modes: check if allProjections is available.
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

          for (const m of group.concepts) {
            const mKebab = toKebabCase(m.name);
            if (mKebab !== kebab) {
              files.push({
                path: `${group.name}/${mKebab}.commands.ts`,
                content: generateCommandRunner(m, m.name),
              });
            } else {
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
