// ============================================================
// Project Instructions Target Provider Handler
//
// Generates project instruction files (CLAUDE.md, AGENTS.md,
// GEMINI.md) for AI coding assistants from a shared content
// block defined in the interface manifest.
//
// Uses the first-concept gate pattern: emits once across
// per-concept calls to avoid duplicate generation.
// Architecture doc: Clef Bind
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { generateMarkdownFileHeader } from './codegen-utils.js';

// --- Types ---

interface InstructionsOutput {
  path: string;
  format: string;
  description?: string;
}

interface InstructionsConfig {
  description?: string;
  outputs?: InstructionsOutput[];
  content?: string;
}

// --- Concept Handler ---

export const projectInstructionsTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'ProjectInstructionsTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'ProjectInstructions',
      capabilities: JSON.stringify(['project-instructions', 'claude-md', 'agents-md', 'gemini-md']),
      targetKey: 'project-instructions',
      providerType: 'target',
    };
  },

  /**
   * Generate project instruction files from manifest configuration.
   *
   * Uses the first-concept gate pattern: only emits on the first
   * concept in allProjections. All other calls return an empty file list.
   *
   * The content comes from the manifest's `project-instructions.content`
   * field, and the output paths come from `targets.project-instructions.outputs`.
   *
   * Input fields:
   *   - projection:      JSON string of the current concept's projection
   *   - allProjections:  JSON string array of all projection records
   *   - config:          JSON string of project-instructions target config
   *   - manifestYaml:    JSON string of the full parsed manifest YAML
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    // --- Parse current projection ---
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

    const conceptName = projection.conceptName as string;

    // --- First-concept gate ---
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
        return { variant: 'ok', files: [] };
      }
    }

    // --- Parse target config ---
    let config: InstructionsConfig = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as InstructionsConfig;
      } catch { /* use defaults */ }
    }

    // --- Parse manifest YAML for project-instructions content ---
    let manifestYaml: Record<string, unknown> = {};
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        manifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch { /* use defaults */ }
    } else if (input.manifestYaml && typeof input.manifestYaml === 'object') {
      manifestYaml = input.manifestYaml as Record<string, unknown>;
    }

    // Get content from project-instructions block in manifest
    const piBlock = manifestYaml['project-instructions'] as Record<string, unknown> | undefined;
    const content = piBlock?.content as string
      || config.content as string | undefined
      || '';

    if (!content) {
      return {
        variant: 'noContent',
        reason: 'No project-instructions.content found in manifest',
      };
    }

    // --- Determine output files ---
    const outputs: InstructionsOutput[] = config.outputs || [
      { path: 'CLAUDE.md', format: 'markdown', description: 'Claude Code project instructions' },
      { path: 'AGENTS.md', format: 'markdown', description: 'OpenAI Codex CLI project instructions' },
      { path: 'GEMINI.md', format: 'markdown', description: 'Google Gemini CLI project instructions' },
    ];

    // --- Generate files ---
    // Note: the generator prefixes each file path with the target name,
    // so we only provide the filename here. Strip leading './' from paths.
    const files = outputs.map((output) => {
      const cleanPath = output.path.replace(/^\.\//, '');
      const header = generateMarkdownFileHeader('project-instructions', cleanPath);
      return {
        path: cleanPath,
        content: `${header}\n${content}`,
      };
    });

    return {
      variant: 'ok',
      files,
    };
  },
};
