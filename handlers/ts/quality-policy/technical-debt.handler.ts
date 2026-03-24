// @clef-handler style=functional
// ============================================================
// TechnicalDebt Handler
//
// Quantify remediation cost (principal) and ongoing productivity
// cost (interest) for quality issues. Calculate ROI-prioritized
// fix ordering and break-even analysis. Track debt evolution.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, merge, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Period to days mapping for break-even calculation
const PERIOD_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

// ---------------------------------------------------------------------------
// Functional handler (pure StorageProgram construction)
// ---------------------------------------------------------------------------

const _handler: FunctionalConceptHandler = {

  // ---- register -----------------------------------------------------------
  register(_input: Record<string, unknown>): StorageProgram<Result> {
    return complete(createProgram(), 'ok', { name: 'TechnicalDebt' });
  },

  // ---- assess -------------------------------------------------------------
  assess(input: Record<string, unknown>): StorageProgram<Result> {
    const findingRef = input.findingRef as string;
    const target = input.target as string;
    const principal = input.principal as number;
    const principalUnit = input.principalUnit as string;
    const interest = input.interest as number;
    const interestPeriod = input.interestPeriod as string;

    let p = createProgram();
    p = get(p, 'debt', findingRef, '_existing');

    return branch(p,
      (bindings) => bindings._existing != null,
      // Duplicate
      (b) => complete(b, 'duplicate', { findingRef }),
      // Create new debt assessment
      (b) => {
        const periodDays = PERIOD_DAYS[interestPeriod] || 30;
        const dailyInterest = interest / periodDays;
        const breakEvenDays = dailyInterest > 0 ? principal / dailyInterest : null;
        const roi = principal > 0 ? interest / principal : 0;

        let b2 = put(b, 'debt', findingRef, {
          findingRef,
          target,
          principal,
          principalUnit,
          interest,
          interestPeriod,
          assessedAt: new Date().toISOString(),
          retired: false,
          breakEvenDays,
          roi,
          changeFrequency: null,
        });
        return complete(b2, 'ok', {
          debt: findingRef,
          breakEvenDays,
        });
      },
    );
  },

  // ---- prioritize ----------------------------------------------------------
  prioritize(input: Record<string, unknown>): StorageProgram<Result> {
    const targets = (input.targets as string[] | undefined) ?? null;
    const limit = (input.limit as number | undefined) ?? null;

    let p = createProgram();
    p = find(p, 'debt', {}, '_allDebts');

    return completeFrom(
      mapBindings(p, (bindings) => {
        let debts = ((bindings._allDebts || []) as Array<Record<string, unknown>>)
          .filter(d => !(d.retired as boolean));

        // Filter by targets if specified
        if (targets && targets.length > 0) {
          debts = debts.filter(d => targets.includes(d.target as string));
        }

        // Calculate ROI and sort by it (highest first)
        const ranked = debts.map(d => {
          const principal = d.principal as number;
          const interest = d.interest as number;
          const roi = principal > 0 ? interest / principal : 0;
          const breakEvenDays = d.breakEvenDays as number || 0;

          return {
            debt: d.findingRef as string,
            findingRef: d.findingRef as string,
            target: d.target as string,
            principal,
            interest,
            roi,
            breakEvenDays,
          };
        }).sort((a, b) => b.roi - a.roi);

        return limit ? ranked.slice(0, limit) : ranked;
      }, '_ranked'),
      'ok',
      (bindings) => ({ ranked: bindings._ranked }),
    );
  },

  // ---- summary -------------------------------------------------------------
  summary(input: Record<string, unknown>): StorageProgram<Result> {
    const groupBy = (input.groupBy as string | undefined) ?? 'target';

    let p = createProgram();
    p = find(p, 'debt', {}, '_allDebts');

    return completeFrom(
      mapBindings(p, (bindings) => {
        const debts = ((bindings._allDebts || []) as Array<Record<string, unknown>>)
          .filter(d => !(d.retired as boolean));

        // Group debts
        const groupMap = new Map<string, Array<Record<string, unknown>>>();
        for (const d of debts) {
          let key: string;
          switch (groupBy) {
            case 'target':
              key = d.target as string;
              break;
            case 'effort':
              key = d.principalUnit as string;
              break;
            default:
              key = d.target as string;
          }
          if (!groupMap.has(key)) groupMap.set(key, []);
          groupMap.get(key)!.push(d);
        }

        // Build group summaries
        const groups: Array<Record<string, unknown>> = [];
        for (const [key, items] of groupMap.entries()) {
          const totalPrincipal = items.reduce((sum, d) => sum + (d.principal as number), 0);
          // Convert interest to monthly
          const totalMonthlyInterest = items.reduce((sum, d) => {
            const interest = d.interest as number;
            const period = d.interestPeriod as string;
            const periodDays = PERIOD_DAYS[period] || 30;
            return sum + (interest / periodDays) * 30;
          }, 0);
          const breakEvenValues = items
            .map(d => d.breakEvenDays as number)
            .filter(v => v != null && v > 0);
          const avgBreakEvenDays = breakEvenValues.length > 0
            ? breakEvenValues.reduce((a, b) => a + b, 0) / breakEvenValues.length
            : 0;
          // Worst item = highest principal
          const worstItem = items.reduce((worst, d) =>
            (d.principal as number) > (worst.principal as number) ? d : worst,
            items[0],
          );

          groups.push({
            key,
            itemCount: items.length,
            totalPrincipal,
            totalMonthlyInterest: Math.round(totalMonthlyInterest * 100) / 100,
            avgBreakEvenDays: Math.round(avgBreakEvenDays * 100) / 100,
            worstItem: worstItem.findingRef as string,
          });
        }

        return groups;
      }, '_groups'),
      'ok',
      (bindings) => ({ groups: bindings._groups }),
    );
  },

  // ---- retire --------------------------------------------------------------
  retire(input: Record<string, unknown>): StorageProgram<Result> {
    const findingRef = input.findingRef as string;

    let p = createProgram();
    p = get(p, 'debt', findingRef, '_debt');

    return branch(p,
      (bindings) => {
        const debt = bindings._debt as Record<string, unknown> | null;
        return debt == null || (debt.retired as boolean) === true;
      },
      (b) => complete(b, 'notFound', { findingRef }),
      (b) => {
        return completeFrom(
          merge(b, 'debt', findingRef, { retired: true }),
          'ok',
          (bindings) => {
            const debt = bindings._debt as Record<string, unknown>;
            return {
              debt: findingRef,
              principalSaved: debt.principal as number,
            };
          },
        );
      },
    );
  },

  // ---- recalculateInterest -------------------------------------------------
  recalculateInterest(input: Record<string, unknown>): StorageProgram<Result> {
    const findingRef = input.findingRef as string;
    const changeFrequency = input.changeFrequency as number;

    let p = createProgram();
    p = get(p, 'debt', findingRef, '_debt');

    return branch(p,
      (bindings) => {
        const debt = bindings._debt as Record<string, unknown> | null;
        return debt == null || (debt.retired as boolean) === true;
      },
      (b) => complete(b, 'notFound', { findingRef }),
      (b) => {
        return completeFrom(
          merge(b, 'debt', findingRef, { changeFrequency }),
          'ok',
          (bindings) => {
            const debt = bindings._debt as Record<string, unknown>;
            const previousInterest = debt.interest as number;
            // Scale interest by change frequency (base frequency assumed to be 1.0)
            const newInterest = previousInterest * changeFrequency;
            return {
              debt: findingRef,
              previousInterest,
              newInterest,
            };
          },
        );
      },
    );
  },
};

// ---------------------------------------------------------------------------
// Export auto-interpreted handler
// ---------------------------------------------------------------------------

export const technicalDebtHandler = autoInterpret(_handler);
export default technicalDebtHandler;
