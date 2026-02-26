// ============================================================
// async-gate Pattern Validator
//
// Validates that a concept follows the async gate convention
// (Architecture doc Section 16.12):
//
// ✅ Has @gate annotation
// ✅ At least one action has an ok variant (proceed signal)
// ✅ At least one action has a non-ok variant (domain failure)
// ✅ State tracks pending items (heuristic: has set or mapping)
// ⚠  Actions without timeout variant (long-running should timeout)
// ⚠  No @gate but concept shape matches gate pattern (suggest it)
// ============================================================

import type { ConceptAST } from '../../../runtime/types.js';
import type { ValidationResult, ValidationMessage } from './index.js';

export function asyncGateValidator(ast: ConceptAST): ValidationResult {
  const messages: ValidationMessage[] = [];

  const hasGateAnnotation = ast.annotations?.gate === true;

  // Check: @gate annotation
  if (hasGateAnnotation) {
    messages.push({ level: 'info', message: `Has @gate annotation` });
  } else {
    messages.push({ level: 'error', message: `Missing @gate annotation` });
  }

  // Check: at least one action with ok variant
  const actionsWithOk: string[] = [];
  for (const action of ast.actions) {
    if (action.variants.some(v => v.name === 'ok')) {
      actionsWithOk.push(action.name);
    }
  }

  if (actionsWithOk.length > 0) {
    messages.push({
      level: 'info',
      message: `Has at least one action with ok variant (${actionsWithOk.join(', ')})`,
    });
  } else {
    messages.push({
      level: 'error',
      message: `No action has an ok variant (gate actions need a proceed signal)`,
    });
  }

  // Check: at least one action with a non-ok variant
  const nonOkVariants: string[] = [];
  for (const action of ast.actions) {
    for (const v of action.variants) {
      if (v.name !== 'ok' && v.name !== 'error') {
        nonOkVariants.push(v.name);
      }
    }
  }

  if (nonOkVariants.length > 0) {
    const unique = [...new Set(nonOkVariants)];
    messages.push({
      level: 'info',
      message: `Has at least one non-ok variant (${unique.join(', ')})`,
    });
  } else {
    // Also accept 'error' as a non-ok variant for simpler gates
    const hasError = ast.actions.some(a => a.variants.some(v => v.name === 'error'));
    if (hasError) {
      messages.push({
        level: 'info',
        message: `Has at least one non-ok variant (error)`,
      });
    } else {
      messages.push({
        level: 'error',
        message: `No action has a non-ok variant (gate actions need domain-specific failure variants)`,
      });
    }
  }

  // Check: state tracks pending items (heuristic: has a set type or a mapping/relation)
  const hasPendingTracking = ast.state.some(s => {
    return s.type.kind === 'set' || s.type.kind === 'relation';
  });

  if (hasPendingTracking) {
    // Find the field name for the message
    const trackingField = ast.state.find(s =>
      s.type.kind === 'set' || s.type.kind === 'relation',
    );
    messages.push({
      level: 'info',
      message: `Has state tracking pending requests (${trackingField!.name}: ${describeType(trackingField!.type)})`,
    });
  } else {
    messages.push({
      level: 'error',
      message: `No state field tracks pending items (gate concepts need a set or mapping for pending requests)`,
    });
  }

  // Warn: actions without a timeout variant
  for (const action of ast.actions) {
    if (action.variants.some(v => v.name === 'ok')) {
      // This is a gate action — check for timeout variant
      const hasTimeout = action.variants.some(v => v.name === 'timeout');
      if (!hasTimeout) {
        messages.push({
          level: 'warning',
          message: `Consider adding a timeout variant to '${action.name}' action (gate actions should have explicit timeout handling)`,
        });
      }
    }
  }

  // Warn: no @gate but shape matches (suggest adding it)
  if (!hasGateAnnotation) {
    const looksLikeGate =
      actionsWithOk.length > 0 &&
      (nonOkVariants.length > 0 || ast.actions.some(a => a.variants.some(v => v.name === 'error'))) &&
      hasPendingTracking;

    if (looksLikeGate) {
      messages.push({
        level: 'warning',
        message: `Concept shape matches the async gate pattern but missing @gate annotation — consider adding it`,
      });
    }
  }

  return { pattern: 'async-gate', messages };
}

function describeType(type: { kind: string; inner?: unknown; from?: unknown; to?: unknown }): string {
  switch (type.kind) {
    case 'set':
      return `set ${describeType(type.inner as { kind: string })}`;
    case 'relation':
      return `${describeType(type.from as { kind: string })} -> ${describeType(type.to as { kind: string })}`;
    case 'primitive':
      return (type as { kind: string; name: string }).name;
    case 'param':
      return (type as { kind: string; name: string }).name;
    default:
      return type.kind;
  }
}
