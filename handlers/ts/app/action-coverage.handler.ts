// ActionCoverage handler — functional StorageProgram style
// Static analysis: reports gaps in ActionBinding coverage.
// Compares stored bindings against registered concept actions and widget
// action parts. Identifies unbound actions, unbound widget parts, and
// stale bindings targeting nonexistent actions.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

interface ActionRef {
  concept: string;
  action: string;
}

interface PartRef {
  widget: string;
  actionPart: string;
}

interface BindingRecord {
  id?: string;
  binding?: string;
  target?: string;
  [key: string]: unknown;
}

interface CoverageResult {
  unboundActions: string;
  unboundWidgetParts: string;
  staleBindings: string;
  coverage: string;
  timestamp: string;
}

function computeCoverage(
  allBindings: BindingRecord[],
  registeredActions: ActionRef[],
  registeredParts: PartRef[],
): CoverageResult {
  function actionKey(ref: ActionRef): string {
    return `${ref.concept}/${ref.action}`;
  }
  function partKey(ref: PartRef): string {
    return `${ref.widget}/${ref.actionPart}`;
  }

  const registeredActionKeys = new Set(registeredActions.map(actionKey));
  const registeredPartKeys = new Set(registeredParts.map(partKey));

  // Collect all target keys that bindings point to
  const boundTargets = new Set<string>();
  for (const b of allBindings) {
    const target = b.target as string | undefined;
    if (target) boundTargets.add(target);
  }

  // Collect widget/actionPart pairs that are bound (widget::actionPart notation)
  const boundPartKeys = new Set<string>();
  for (const b of allBindings) {
    const target = b.target as string | undefined;
    if (target && target.includes('::')) {
      boundPartKeys.add(target);
    }
  }

  // Unbound actions: registered concept actions with no binding pointing to them
  const unboundActions = registeredActions.filter(
    (ref) => !boundTargets.has(actionKey(ref)),
  );

  // Unbound widget parts: registered parts with no binding pointing to them
  const unboundWidgetParts = registeredParts.filter(
    (ref) => !boundPartKeys.has(partKey(ref)),
  );

  // Stale bindings: bindings whose target is not in the registered action set
  // Only check concept/action-style targets (not widget::part)
  const staleBindingIds = allBindings
    .filter((b) => {
      const target = b.target as string | undefined;
      if (!target) return false;
      if (target.includes('::')) return false;
      return !registeredActionKeys.has(target);
    })
    .map((b) => (b.id ?? b.binding ?? 'unknown') as string);

  // Coverage metrics
  const totalActions = registeredActions.length;
  const boundActionsCount = registeredActions.filter(
    (ref) => boundTargets.has(actionKey(ref)),
  ).length;
  const totalWidgetParts = registeredParts.length;
  const boundPartsCount = registeredParts.filter(
    (ref) => boundPartKeys.has(partKey(ref)),
  ).length;

  const percentActions = totalActions > 0
    ? Math.round((boundActionsCount / totalActions) * 100)
    : 100;
  const percentParts = totalWidgetParts > 0
    ? Math.round((boundPartsCount / totalWidgetParts) * 100)
    : 100;

  const coverageObj = {
    totalActions,
    boundActions: boundActionsCount,
    totalWidgetParts,
    boundParts: boundPartsCount,
    percentActions,
    percentParts,
  };

  return {
    unboundActions: JSON.stringify(unboundActions),
    unboundWidgetParts: JSON.stringify(unboundWidgetParts),
    staleBindings: JSON.stringify(staleBindingIds),
    coverage: JSON.stringify(coverageObj),
    timestamp: new Date().toISOString(),
  };
}

const _handler: FunctionalConceptHandler = {

  register() {
    return { name: 'ActionCoverage' };
  },

  analyze(input: Record<string, unknown>) {
    const report = input.report as string;
    const registeredActionsRaw = input.registeredActions as string;
    const registeredPartsRaw = input.registeredParts as string;

    // Validate report identifier
    if (!report || report.trim() === '') {
      return complete(createProgram(), 'error', { message: 'report identifier is required' });
    }

    // Parse and validate registeredActions JSON
    let registeredActions: ActionRef[];
    try {
      registeredActions = JSON.parse(registeredActionsRaw) as ActionRef[];
    } catch {
      return complete(createProgram(), 'error', { message: 'registeredActions is not valid JSON' });
    }

    // Parse and validate registeredParts JSON
    let registeredParts: PartRef[];
    try {
      registeredParts = JSON.parse(registeredPartsRaw) as PartRef[];
    } catch {
      return complete(createProgram(), 'error', { message: 'registeredParts is not valid JSON' });
    }

    // Fetch all existing action bindings, then compute and store the analysis
    let p = createProgram();
    p = find(p, 'bindings', {}, 'allBindings');

    // Compute coverage analysis result from bindings
    p = mapBindings(p, (bindings) => {
      const allBindings = ((bindings.allBindings || []) as BindingRecord[]);
      return computeCoverage(allBindings, registeredActions, registeredParts);
    }, '_coverageResult');

    // Store the report using computed values
    p = putFrom(p, 'reports', report, (bindings) => {
      const result = bindings._coverageResult as CoverageResult;
      return {
        report,
        timestamp: result.timestamp,
        unboundActions: result.unboundActions,
        unboundWidgetParts: result.unboundWidgetParts,
        staleBindings: result.staleBindings,
        coverage: result.coverage,
      };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings._coverageResult as CoverageResult;
      return {
        report,
        unboundActions: result.unboundActions,
        unboundWidgetParts: result.unboundWidgetParts,
        staleBindings: result.staleBindings,
        coverage: result.coverage,
      };
    });
  },

  get(input: Record<string, unknown>) {
    const report = input.report as string;

    if (!report || typeof report !== 'string' || report.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'report identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'reports', report, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `coverage report '${report}' not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          report: rec.report ?? report,
          unboundActions: rec.unboundActions as string,
          unboundWidgetParts: rec.unboundWidgetParts as string,
          staleBindings: rec.staleBindings as string,
          coverage: rec.coverage as string,
          timestamp: rec.timestamp as string,
        };
      }),
    );
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'reports', {}, 'all');
    return completeFrom(p, 'ok', (b) => {
      const items = ((b.all || []) as Record<string, unknown>[]);
      const ids = items.map((r) => r.report ?? r.id ?? 'unknown');
      return { reports: JSON.stringify(ids) };
    });
  },
};

export const actionCoverageHandler = autoInterpret(_handler);
