// Workflow Concept Implementation (Interface Kit)
import type { ConceptHandler } from '@clef/kernel';

export const interfaceWorkflowHandler: ConceptHandler = {
  async define(input, storage) {
    const concept = input.concept as string;
    const steps = JSON.parse(input.steps as string) as string[];
    const config = input.config as string;

    // Validate steps
    if (steps.length === 0) {
      return { variant: 'emptySteps' };
    }

    // Parse config for decorations
    let configData: Record<string, unknown>;
    try {
      configData = JSON.parse(config);
    } catch {
      configData = {};
    }

    // Build ordered step list with optional titles and prose
    const stepDefinitions: Array<{ action: string; title: string; prose: string; order: number }> = [];
    const stepTitles = (configData.titles as Record<string, string>) ?? {};
    const stepProse = (configData.prose as Record<string, string>) ?? {};

    for (let i = 0; i < steps.length; i++) {
      const action = steps[i];

      // Validate action exists (by convention, non-empty string)
      if (!action || action.trim() === '') {
        return { variant: 'invalidAction', action: action ?? '' };
      }

      stepDefinitions.push({
        action,
        title: stepTitles[action] ?? action.charAt(0).toUpperCase() + action.slice(1),
        prose: stepProse[action] ?? '',
        order: i + 1,
      });
    }

    // Extract decorations from config
    const checklists = (configData.checklists as Array<{ step: string; items: string[] }>) ?? [];
    const references = (configData.references as Array<{ step: string; path: string; label: string }>) ?? [];
    const examples = (configData.examples as Array<{ step: string; language: string; code: string }>) ?? [];
    const antiPatterns = (configData.antiPatterns as Array<{ title: string; description: string }>) ?? [];
    const relatedWorkflows = (configData.relatedWorkflows as string[]) ?? [];

    const workflowId = `workflow-${concept}-${Date.now()}`;

    await storage.put('workflow', workflowId, {
      workflowId,
      concept,
      steps: JSON.stringify(stepDefinitions),
      checklists: JSON.stringify(checklists),
      references: JSON.stringify(references),
      examples: JSON.stringify(examples),
      antiPatterns: JSON.stringify(antiPatterns),
      relatedWorkflows: JSON.stringify(relatedWorkflows),
      stepCount: steps.length,
    });

    return { variant: 'ok', workflow: workflowId, stepCount: steps.length };
  },

  async render(input, storage) {
    const workflow = input.workflow as string;
    const format = input.format as string;

    const existing = await storage.get('workflow', workflow);
    if (!existing) {
      return { variant: 'unknownFormat', format: 'Workflow not found' };
    }

    const supportedFormats = ['skill-md', 'cli-help', 'rest-guide', 'generic'];
    if (!supportedFormats.includes(format)) {
      return { variant: 'unknownFormat', format };
    }

    const concept = existing.concept as string;
    const steps = JSON.parse(existing.steps as string) as Array<{ action: string; title: string; prose: string; order: number }>;
    const checklists = JSON.parse(existing.checklists as string) as Array<{ step: string; items: string[] }>;
    const examples = JSON.parse(existing.examples as string) as Array<{ step: string; language: string; code: string }>;
    const antiPatterns = JSON.parse(existing.antiPatterns as string) as Array<{ title: string; description: string }>;
    const relatedWorkflows = JSON.parse(existing.relatedWorkflows as string) as string[];

    let content = '';

    if (format === 'skill-md') {
      // Render as numbered steps for Claude skills
      const lines: string[] = [];
      lines.push(`# ${concept} Workflow`);
      lines.push('');
      for (const step of steps) {
        lines.push(`## Step ${step.order}: ${step.title}`);
        if (step.prose) lines.push(step.prose);
        lines.push(`Action: \`${step.action}\``);
        lines.push('');

        // Add checklist if available
        const checklist = checklists.find((c) => c.step === step.action);
        if (checklist) {
          for (const item of checklist.items) {
            lines.push(`- [ ] ${item}`);
          }
          lines.push('');
        }

        // Add examples if available
        const example = examples.find((e) => e.step === step.action);
        if (example) {
          lines.push(`\`\`\`${example.language}`);
          lines.push(example.code);
          lines.push('```');
          lines.push('');
        }
      }

      // Add anti-patterns section
      if (antiPatterns.length > 0) {
        lines.push('## Anti-Patterns');
        for (const ap of antiPatterns) {
          lines.push(`- **${ap.title}**: ${ap.description}`);
        }
        lines.push('');
      }

      // Add related workflows
      if (relatedWorkflows.length > 0) {
        lines.push('## Related Workflows');
        for (const rw of relatedWorkflows) {
          lines.push(`- ${rw}`);
        }
      }

      content = lines.join('\n');
    } else if (format === 'cli-help') {
      // Render as CLI help page
      const lines: string[] = [];
      lines.push(`USAGE: ${concept.toLowerCase()} <command>`);
      lines.push('');
      lines.push('COMMANDS:');
      for (const step of steps) {
        const padding = '  ';
        lines.push(`${padding}${step.action.padEnd(20)} ${step.title}`);
      }
      lines.push('');
      lines.push('WORKFLOW:');
      for (const step of steps) {
        lines.push(`  ${step.order}. ${step.title} (${step.action})`);
        if (step.prose) lines.push(`     ${step.prose}`);
      }
      content = lines.join('\n');
    } else if (format === 'rest-guide') {
      // Render as REST getting-started guide
      const lines: string[] = [];
      lines.push(`# Getting Started with ${concept}`);
      lines.push('');
      for (const step of steps) {
        lines.push(`## ${step.order}. ${step.title}`);
        lines.push('');
        if (step.prose) {
          lines.push(step.prose);
          lines.push('');
        }
        lines.push(`\`\`\`bash`);
        lines.push(`curl -X POST /api/${concept.toLowerCase()}/${step.action}`);
        lines.push('```');
        lines.push('');
      }
      content = lines.join('\n');
    } else {
      // Generic format
      const lines: string[] = [];
      lines.push(`Workflow: ${concept}`);
      lines.push(`Steps: ${steps.length}`);
      lines.push('');
      for (const step of steps) {
        lines.push(`${step.order}. [${step.action}] ${step.title}`);
        if (step.prose) lines.push(`   ${step.prose}`);
      }
      content = lines.join('\n');
    }

    return { variant: 'ok', content };
  },
};
