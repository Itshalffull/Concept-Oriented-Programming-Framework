// @clef-handler style=functional concept=ClaudeAgentsTarget
// ============================================================
// Claude Agents Target Provider Handler
//
// Generates Claude Code agent files (.md with YAML frontmatter)
// from concept projections. Agents wrap skills with isolated
// context, model selection, and purpose-driven system prompts.
//
// Agent files live in .claude/agents/ and are auto-delegated
// by Claude Code when the task matches the agent's description.
//
// Architecture doc: Clef Bind
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import { createProgram, complete, type StorageProgram } from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import type { ConceptManifest } from '../../../../runtime/types.js';
import {
  toKebabCase,
  toPascalCase,
  generateMarkdownFileHeader,
} from './codegen-utils.js';

// --- Agent Config Types ---

interface AgentReference {
  /** Relative path from agent dir, e.g. "references/guide.md". */
  path: string;
  /** Human-readable label. */
  label: string;
  /** Reference tier: "reference", "example", or "guide". */
  tier?: string;
  /** Inline content to write to the file. */
  content: string;
}

interface AgentAnnotation {
  /** Agent system prompt body (markdown). */
  prompt?: string;
  /** Model override: sonnet, opus, haiku, or inherit. */
  model?: string;
  /** Skills to preload into the agent's context. */
  skills?: string[];
  /** Tools the agent is allowed to use (comma-separated or array). */
  tools?: string | string[];
  /** Additional rules or constraints appended to the system prompt. */
  rules?: string[];
  /** Workflow steps rendered in the system prompt. */
  workflow?: string[];
  /** Reference docs generated alongside the agent .md file. */
  references?: AgentReference[];
}

function getAgentAnnotation(
  manifestYaml: Record<string, unknown> | undefined,
  conceptName: string,
): AgentAnnotation | undefined {
  if (!manifestYaml) return undefined;
  const agents = manifestYaml['agent-annotations'] as Record<string, unknown> | undefined;
  if (!agents?.[conceptName]) return undefined;
  return agents[conceptName] as AgentAnnotation;
}

// --- Agent File Builder ---

function generateAgentMd(
  manifest: ConceptManifest,
  agentAnnot: AgentAnnotation | undefined,
  conceptKebab: string,
): string {
  const lines: string[] = [];
  const name = conceptKebab;
  const description = agentAnnot?.prompt
    ? agentAnnot.prompt.split('\n')[0]
    : manifest.purpose || `Manage ${manifest.name} resources`;

  // --- YAML Frontmatter ---
  lines.push('---');
  lines.push(`name: ${name}`);
  lines.push(`description: ${description}`);

  const model = agentAnnot?.model || 'sonnet';
  lines.push(`model: ${model}`);

  const tools = agentAnnot?.tools
    ? (Array.isArray(agentAnnot.tools) ? agentAnnot.tools.join(', ') : agentAnnot.tools)
    : 'Read, Grep, Glob, Edit, Write, Bash';
  lines.push(`tools: ${tools}`);

  // Skills: always include the matching skill, plus any extras
  const skills = new Set<string>([conceptKebab]);
  if (agentAnnot?.skills) {
    for (const s of agentAnnot.skills) skills.add(s);
  }
  lines.push(`skills:`);
  for (const s of skills) {
    lines.push(`  - ${s}`);
  }

  // References: list paths in frontmatter
  if (agentAnnot?.references && agentAnnot.references.length > 0) {
    lines.push(`references:`);
    for (const ref of agentAnnot.references) {
      if (ref.path) {
        lines.push(`  - ${ref.path}`);
      }
    }
  }

  lines.push('---');
  lines.push('');

  // --- System Prompt Body ---
  lines.push(generateMarkdownFileHeader('claude-agents', manifest.name));

  const pascal = toPascalCase(manifest.name);
  lines.push(`You are a Clef ${pascal} agent.`);
  lines.push('');

  if (agentAnnot?.prompt) {
    lines.push(agentAnnot.prompt);
    lines.push('');
  } else {
    lines.push(manifest.purpose || `Manage ${manifest.name} resources.`);
    lines.push('');
  }

  // Workflow
  if (agentAnnot?.workflow && agentAnnot.workflow.length > 0) {
    lines.push('## Workflow');
    lines.push('');
    for (let i = 0; i < agentAnnot.workflow.length; i++) {
      lines.push(`${i + 1}. ${agentAnnot.workflow[i]}`);
    }
    lines.push('');
  }

  // Rules
  if (agentAnnot?.rules && agentAnnot.rules.length > 0) {
    lines.push('## Rules');
    lines.push('');
    for (const rule of agentAnnot.rules) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// --- Concept Handler ---

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    let p = createProgram();
    p = complete(p, 'ok', {
      name: 'ClaudeAgentsTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'ClaudeAgents',
      capabilities: JSON.stringify(['agent-md']),
      targetKey: 'claude-agents',
      providerType: 'target',
    });
    return p;
  },

  generate(input: Record<string, unknown>) {
    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      let p = createProgram();
      p = complete(p, 'ok', { files: [] });
      return p;
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw);
    } catch {
      let p = createProgram();
      p = complete(p, 'ok', { files: [] });
      return p;
    }

    const manifestRaw = projection.conceptManifest as string | Record<string, unknown>;
    const conceptName = projection.conceptName as string;

    let manifest: ConceptManifest;
    if (typeof manifestRaw === 'string') {
      try {
        manifest = JSON.parse(manifestRaw) as ConceptManifest;
      } catch {
        let p = createProgram();
        p = complete(p, 'ok', { files: [] });
        return p;
      }
    } else {
      manifest = manifestRaw as ConceptManifest;
    }

    const name = conceptName || manifest.name;
    const kebab = toKebabCase(name);

    // Parse manifestYaml for agent annotations
    let parsedManifestYaml: Record<string, unknown> | undefined;
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        parsedManifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch { /* ignore */ }
    }

    const agentAnnot = getAgentAnnotation(parsedManifestYaml, name);

    // Only generate agent files for concepts that have agent annotations
    if (!agentAnnot) {
      let p = createProgram();
      p = complete(p, 'ok', { files: [] });
      return p;
    }

    const agentMd = generateAgentMd(manifest, agentAnnot, kebab);

    const files: Array<{ path: string; content: string }> = [{
      path: `${kebab}.md`,
      content: agentMd,
    }];

    // Emit reference files alongside the agent .md
    if (agentAnnot?.references) {
      for (const ref of agentAnnot.references) {
        if (ref.path && ref.content) {
          files.push({
            path: `${kebab}/${ref.path}`,
            content: ref.content,
          });
        }
      }
    }

    let p = createProgram();
    p = complete(p, 'ok', { files });
    return p;
  },
};

export const claudeAgentsTargetHandler = autoInterpret(_handler);
