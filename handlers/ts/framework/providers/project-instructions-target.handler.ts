// @clef-handler style=functional concept=ProjectInstructionsTarget
// @migrated dsl-constructs 2026-03-18
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

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
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

type Result = { variant: string; [key: string]: unknown };

// --- Concept Handler ---

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'ProjectInstructionsTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'ProjectInstructions',
      capabilities: JSON.stringify(['project-instructions', 'claude-md', 'agents-md', 'gemini-md']),
      targetKey: 'project-instructions',
      providerType: 'target',
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    // --- Parse current projection ---
    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      const p = createProgram();
      return complete(p, 'ok', { files: [] }) as StorageProgram<Result>;
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw);
    } catch {
      const p = createProgram();
      return complete(p, 'ok', { files: [] }) as StorageProgram<Result>;
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
        const p = createProgram();
        return complete(p, 'ok', { files: [] }) as StorageProgram<Result>;
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
      const p = createProgram();
      return complete(p, 'noContent', {
        reason: 'No project-instructions.content found in manifest',
      }) as StorageProgram<Result>;
    }

    // --- Determine output files ---
    const outputs: InstructionsOutput[] = config.outputs || [
      { path: 'CLAUDE.md', format: 'markdown', description: 'Claude Code project instructions' },
      { path: 'AGENTS.md', format: 'markdown', description: 'OpenAI Codex CLI project instructions' },
      { path: 'GEMINI.md', format: 'markdown', description: 'Google Gemini CLI project instructions' },
    ];

    // --- Generate files ---
    const files = outputs.map((output) => {
      const cleanPath = output.path.replace(/^\.\//, '');
      const header = generateMarkdownFileHeader('project-instructions', cleanPath);
      return {
        path: cleanPath,
        content: `${header}\n${content}`,
      };
    });

    const p = createProgram();
    return complete(p, 'ok', { files }) as StorageProgram<Result>;
  },
};

export const projectInstructionsTargetHandler = autoInterpret(_handler);
