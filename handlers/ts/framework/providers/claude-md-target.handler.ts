// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Claude MD Target Provider Handler
//
// Generates a single CLAUDE.md project context file by
// aggregating all concept projections plus project-level
// configuration. Produces structured markdown with sections
// for conventions, project structure, key files, skill
// summaries, testing commands, and custom content.
//
// Uses the first-concept gate pattern from the Skills target
// to emit once across per-concept calls. Architecturally
// similar to the OpenAPI target (one file from all concepts).
// Architecture doc: Clef Bind
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import type { ConceptManifest } from '../../../../runtime/types.js';
import {
  toKebabCase,
  toPascalCase,
  generateMarkdownFileHeader,
} from './codegen-utils.js';

// --- Config Types ---

/** Project-level configuration for the claude-md target. */
interface ClaudeMdConfig {
  projectName?: string;
  projectDescription?: string;
  outputPath?: string;
  packageAlias?: string;
  includeSections?: string[];
  excludeSections?: string[];
  conventions?: string[];
  keyFiles?: Array<{ path: string; description: string }>;
  testCommands?: Array<{ label: string; command: string }>;
  customSections?: Array<{ heading: string; body: string; order?: number }>;
}

/** Summary of a single concept's skill for the skills table. */
interface SkillSummary {
  name: string;
  description: string;
  commands: string[];
  suite?: string;
}

// --- Section Helpers ---

/**
 * Check whether a section should be included based on include/exclude config.
 * If includeSections is set, only listed sections are included.
 * If excludeSections is set, listed sections are excluded.
 * Default: all sections included.
 */
function shouldInclude(
  section: string,
  config: ClaudeMdConfig,
): boolean {
  if (config.includeSections && config.includeSections.length > 0) {
    return config.includeSections.includes(section);
  }
  if (config.excludeSections && config.excludeSections.length > 0) {
    return !config.excludeSections.includes(section);
  }
  return true;
}

/**
 * Extract a SkillSummary from a ConceptManifest.
 * Pulls the concept name, purpose, and action names.
 */
function extractSkillSummary(manifest: ConceptManifest): SkillSummary {
  return {
    name: toPascalCase(manifest.name),
    description: manifest.purpose || `Manage ${manifest.name} resources`,
    commands: manifest.actions.map((a) => a.name),
    suite: manifest.suite,
  };
}

/**
 * Group skill summaries by suite name for the structure section.
 */
function groupBySuite(
  summaries: SkillSummary[],
): Map<string, SkillSummary[]> {
  const groups = new Map<string, SkillSummary[]>();
  for (const s of summaries) {
    const key = s.suite || 'Other';
    const list = groups.get(key) || [];
    list.push(s);
    groups.set(key, list);
  }
  return groups;
}

// --- Document Builder ---

/**
 * Assemble the full CLAUDE.md document from config and skill summaries.
 */
function assembleClaudeMd(
  config: ClaudeMdConfig,
  summaries: SkillSummary[],
): string {
  const lines: string[] = [];

  // File header (HTML comment)
  lines.push(generateMarkdownFileHeader('claude-md', 'project'));

  // --- Header section ---
  if (shouldInclude('header', config)) {
    const name = config.projectName || 'Project';
    lines.push(`# ${name} Project Conventions`);
    lines.push('');
    if (config.projectDescription) {
      lines.push(config.projectDescription);
      lines.push('');
    }
  }

  // --- Conventions section ---
  if (shouldInclude('conventions', config) && config.conventions && config.conventions.length > 0) {
    lines.push('## Naming & Conventions');
    lines.push('');
    for (const convention of config.conventions) {
      lines.push(`- ${convention}`);
    }
    lines.push('');
  }

  // --- Structure section ---
  if (shouldInclude('structure', config) && summaries.length > 0) {
    lines.push('## Project Structure');
    lines.push('');
    const groups = groupBySuite(summaries);
    for (const [suite, skills] of groups) {
      lines.push(`### ${toPascalCase(suite)}`);
      for (const skill of skills) {
        lines.push(`- **${skill.name}**: ${skill.description}`);
      }
      lines.push('');
    }
  }

  // --- Key files section ---
  if (shouldInclude('key-files', config) && config.keyFiles && config.keyFiles.length > 0) {
    lines.push('## Key Files');
    lines.push('');
    for (const kf of config.keyFiles) {
      lines.push(`- ${kf.path}: ${kf.description}`);
    }
    lines.push('');
  }

  // --- Skills table section ---
  if (shouldInclude('skills', config) && summaries.length > 0) {
    lines.push('## Available Skills');
    lines.push('');
    lines.push('| Skill | Commands | Description |');
    lines.push('| --- | --- | --- |');
    for (const s of summaries) {
      const cmds = s.commands.join(', ');
      lines.push(`| ${s.name} | ${cmds} | ${s.description} |`);
    }
    lines.push('');
  }

  // --- Testing section ---
  if (shouldInclude('testing', config) && config.testCommands && config.testCommands.length > 0) {
    lines.push('## Testing');
    lines.push('');
    for (const tc of config.testCommands) {
      lines.push(`- **${tc.label}:** \`${tc.command}\``);
    }
    lines.push('');
  }

  // --- Package alias ---
  if (shouldInclude('package-alias', config) && config.packageAlias) {
    lines.push('## Package Alias');
    lines.push('');
    lines.push(`- \`${config.packageAlias}\``);
    lines.push('');
  }

  // --- Custom sections (sorted by order) ---
  if (shouldInclude('custom', config) && config.customSections && config.customSections.length > 0) {
    const sorted = [...config.customSections].sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999),
    );
    for (const section of sorted) {
      lines.push(`## ${section.heading}`);
      lines.push('');
      lines.push(section.body);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// --- Concept Handler ---

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    { let p = createProgram(); p = complete(p, 'ok', { name: 'ClaudeMdTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'ClaudeMd',
      capabilities: JSON.stringify(['claude-md', 'project-context']),
      targetKey: 'claude-md',
      providerType: 'target' }); return p; }
  },

  /**
   * Generate a single CLAUDE.md from all concept projections.
   *
   * Uses the first-concept gate pattern: when called per-concept
   * by the generator, only emits on the first concept in
   * allProjections. All other calls return an empty file list.
   *
   * Input fields:
   *   - projection:      JSON string of the current concept's projection
   *   - allProjections:  JSON string array of all projection records
   *   - config:          JSON string of claude-md target config
   *   - manifestYaml:    JSON string of the full parsed manifest YAML
   */
  generate(
    input: Record<string, unknown>,
  ) {
    // --- Parse current projection ---
    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      { let p = createProgram(); p = complete(p, 'ok', { files: [] }); return p; }
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw);
    } catch {
      { let p = createProgram(); p = complete(p, 'ok', { files: [] }); return p; }
    }

    const conceptName = projection.conceptName as string;

    // --- First-concept gate ---
    // Only emit on the first concept to avoid duplicate generation.
    if (input.allProjections) {
      let allProjections: Record<string, unknown>[];
      try {
        allProjections = JSON.parse(input.allProjections as string);
      } catch {
        allProjections = [];
      }

      const firstConceptName = allProjections[0]
        ? (allProjections[0].conceptName as string)
        : undefined;

      if (firstConceptName && conceptName !== firstConceptName) {
        { let p = createProgram(); p = complete(p, 'ok', { files: [] }); return p; }
      }
    }

    // --- Parse config ---
    let config: ClaudeMdConfig = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as ClaudeMdConfig;
      } catch { /* use defaults */ }
    }

    // --- Parse allProjections and extract skill summaries ---
    const summaries: SkillSummary[] = [];

    if (input.allProjections && typeof input.allProjections === 'string') {
      let allProjections: Record<string, unknown>[];
      try {
        allProjections = JSON.parse(input.allProjections as string);
      } catch {
        allProjections = [];
      }

      for (const proj of allProjections) {
        const manifestRaw = proj.conceptManifest as string;
        if (!manifestRaw || typeof manifestRaw !== 'string') continue;
        try {
          const manifest = JSON.parse(manifestRaw) as ConceptManifest;
          if (manifest.name && manifest.actions) {
            summaries.push(extractSkillSummary(manifest));
          }
        } catch { continue; }
      }
    } else {
      // Fallback: single projection mode
      const manifestRaw = projection.conceptManifest as string | Record<string, unknown>;
      let manifest: ConceptManifest | undefined;
      if (typeof manifestRaw === 'string') {
        try { manifest = JSON.parse(manifestRaw) as ConceptManifest; } catch { /* skip */ }
      } else if (manifestRaw) {
        manifest = manifestRaw as ConceptManifest;
      }
      if (manifest?.name && manifest?.actions) {
        summaries.push(extractSkillSummary(manifest));
      }
    }

    if (summaries.length === 0) {
      { let p = createProgram(); p = complete(p, 'noProjections', { reason: 'No valid concept manifests found in projections' }); return p; }
    }

    // --- Assemble document ---
    const document = assembleClaudeMd(config, summaries);
    const outputPath = config.outputPath || 'CLAUDE.md';

    { let p = createProgram(); p = complete(p, 'ok', { files: [{ path: outputPath, content: document }],
      document }); return p; }
  },
};

export const claudeMdTargetHandler = autoInterpret(_handler);
