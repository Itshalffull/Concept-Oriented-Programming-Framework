import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
  createProgram, put, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * A11yAuditProvider — functional handler.
 *
 * Analyzes RenderProgram instructions for accessibility gaps:
 * missing ARIA roles on interactive parts, missing labels, keyboard
 * navigation gaps, and focus management issues.
 */

type RenderInstruction = { tag: string; [key: string]: unknown };

function analyzeA11y(instructions: RenderInstruction[], parts: string[]): { findings: string[]; passed: boolean } {
  const findings: string[] = [];

  // Collect declared elements and their roles
  const partRoles = new Map<string, string>();
  const ariaAttrs = new Map<string, Map<string, string>>();
  const keyboardMappings: string[] = [];
  let hasFocusConfig = false;

  for (const instr of instructions) {
    switch (instr.tag) {
      case 'element':
        partRoles.set(instr.part as string, instr.role as string);
        break;
      case 'aria':
        if (!ariaAttrs.has(instr.part as string)) {
          ariaAttrs.set(instr.part as string, new Map());
        }
        ariaAttrs.get(instr.part as string)!.set(instr.attr as string, instr.value as string);
        break;
      case 'keyboard':
        keyboardMappings.push(instr.key as string);
        break;
      case 'focus':
        hasFocusConfig = true;
        break;
    }
  }

  // Check: interactive parts need ARIA role
  for (const [part, role] of partRoles) {
    if ((role === 'interactive' || role === 'action') && !ariaAttrs.has(part)) {
      findings.push(`Interactive part "${part}" has no ARIA attributes`);
    }
  }

  // Check: parts with visible text need labels
  for (const part of parts) {
    const hasLabel = ariaAttrs.get(part)?.has('label') || ariaAttrs.get(part)?.has('labelledby');
    const isContainer = partRoles.get(part) === 'container';
    const isPresentation = partRoles.get(part) === 'presentation';
    if (!hasLabel && !isContainer && !isPresentation && partRoles.has(part)) {
      findings.push(`Part "${part}" has no aria-label or aria-labelledby`);
    }
  }

  // Check: keyboard mappings for essential keys
  const essentialKeys = ['Enter', 'Escape', 'Tab'];
  const hasInteractive = [...partRoles.values()].some(r => r === 'interactive' || r === 'action');
  if (hasInteractive) {
    for (const key of essentialKeys) {
      if (!keyboardMappings.includes(key)) {
        findings.push(`Missing keyboard mapping for "${key}"`);
      }
    }
  }

  // Check: dialogs need focus trap
  const hasDialog = [...(ariaAttrs.values())].some(attrs => attrs.get('role') === 'dialog');
  if (hasDialog && !hasFocusConfig) {
    findings.push(`Dialog detected but no focus management configured`);
  }

  return { findings, passed: findings.length === 0 };
}

const _a11yAuditProviderHandler: FunctionalConceptHandler = {
  audit(input: Record<string, unknown>) {
    const audit = input.audit as string;
    const program = input.program as string;

    try {
      let instructions: RenderInstruction[] = [];
      let parts: string[] = [];

      if (input.instructions) {
        instructions = (Array.isArray(input.instructions) ? input.instructions : JSON.parse(input.instructions as string)) as RenderInstruction[];
      }
      if (input.parts) {
        parts = (Array.isArray(input.parts) ? input.parts : JSON.parse(input.parts as string)) as string[];
      }

      const { findings, passed } = analyzeA11y(instructions, parts);

      let p = createProgram();
      p = put(p, 'audits', audit, { program, findings, passed });
      p = pure(p, {
        variant: 'ok',
        audit,
        findings: JSON.stringify(findings),
        passed,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `A11y audit failed: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  getFindings(input: Record<string, unknown>) {
    const audit = input.audit as string;

    let p = createProgram();
    // This will be resolved by the interpreter at runtime via storage lookup
    p = put(p, '__query', 'audits', { key: audit, bindAs: 'auditResult' });
    p = pure(p, {
      variant: 'ok',
      audit,
      findings: '__BOUND:auditResult.findings',
      passed: '__BOUND:auditResult.passed',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const a11yAuditProviderHandler = autoInterpret(_a11yAuditProviderHandler);

