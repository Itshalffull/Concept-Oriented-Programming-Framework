// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, mergeFrom, mapBindings,
  branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_DELIVERABLE_TYPES = new Set([
  'report', 'comparison', 'literature_review', 'fact_check', 'data_extraction',
]);

const VALID_STATUSES = new Set([
  'draft', 'planning', 'executing', 'reviewing', 'completed', 'cancelled',
]);

/**
 * Valid status transitions for the ResearchProject FSM.
 * Any non-terminal status may transition to cancelled.
 */
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  draft:     new Set(['planning', 'cancelled']),
  planning:  new Set(['executing', 'cancelled']),
  executing: new Set(['reviewing', 'cancelled']),
  reviewing: new Set(['completed', 'cancelled']),
  completed: new Set(),
  cancelled: new Set(),
};

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  return '';
}

const _researchProjectHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ResearchProject' }) as StorageProgram<Result>;
  },

  /**
   * Create a new research project in draft status.
   * Budget is a JSON-encoded object: { max_tokens, max_search_calls, max_duration_minutes }.
   */
  create(input: Record<string, unknown>) {
    const query = toStr(input.query);
    const deliverable_type = toStr(input.deliverable_type);
    const constraints = toStr(input.constraints);
    const perspectives = toStr(input.perspectives);
    const budgetRaw = toStr(input.budget);

    if (!query || query.trim() === '') {
      return complete(createProgram(), 'error', { message: 'query is required' }) as StorageProgram<Result>;
    }

    if (!VALID_DELIVERABLE_TYPES.has(deliverable_type)) {
      return complete(createProgram(), 'error', {
        message: `Invalid deliverable_type "${deliverable_type}". Must be one of: ${[...VALID_DELIVERABLE_TYPES].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let budget: Record<string, unknown>;
    try {
      budget = JSON.parse(budgetRaw || '{}') as Record<string, unknown>;
    } catch {
      return complete(createProgram(), 'error', {
        message: 'budget must be valid JSON',
      }) as StorageProgram<Result>;
    }

    const projectId = randomId();
    const now = new Date().toISOString();
    const perspectiveList = perspectives
      ? perspectives.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // Use caller-supplied status when valid, otherwise default to 'active'.
    // Field is stored as project_status to match view seeds (visibleFields + filters).
    const requestedStatus = toStr(input.status);
    const initialStatus = VALID_STATUSES.has(requestedStatus) ? requestedStatus : 'active';

    const record = {
      project: projectId,
      query,
      deliverable_type,
      constraints: constraints || null,
      output_format: 'structured_blocks',
      required_perspectives: perspectives,
      perspective_count: perspectiveList.length,
      max_tokens: typeof budget.max_tokens === 'number' ? budget.max_tokens : null,
      max_search_calls: typeof budget.max_search_calls === 'number' ? budget.max_search_calls : null,
      max_duration_minutes: typeof budget.max_duration_minutes === 'number' ? budget.max_duration_minutes : null,
      tokens_used: 0,
      search_calls_used: 0,
      allowed_source_types: 'web_page,pdf,document,dataset,api_response',
      require_credibility_tier: null,
      project_status: initialStatus,
      created_at: now,
      completed_at: null,
      process_run_id: null,
      report_entity_id: null,
    };

    let p = createProgram();
    p = put(p, 'project', projectId, record);
    return complete(p, 'ok', { project: projectId }) as StorageProgram<Result>;
  },

  /**
   * Increment the token and search call usage counters.
   * Returns budget_exceeded if any limit is crossed after increment.
   */
  updateBudgetUsage(input: Record<string, unknown>) {
    const projectId = toStr(input.project);
    const tokens_delta = typeof input.tokens_delta === 'number'
      ? input.tokens_delta
      : parseInt(toStr(input.tokens_delta), 10) || 0;
    const search_calls_delta = typeof input.search_calls_delta === 'number'
      ? input.search_calls_delta
      : parseInt(toStr(input.search_calls_delta), 10) || 0;

    let p = createProgram();
    p = spGet(p, 'project', projectId, 'existing');

    // Derive new usage values and limit information from existing record
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      if (!rec) return null;
      return {
        newTokens: ((rec.tokens_used as number) || 0) + tokens_delta,
        newSearchCalls: ((rec.search_calls_used as number) || 0) + search_calls_delta,
        maxTokens: rec.max_tokens as number | null,
        maxSearchCalls: rec.max_search_calls as number | null,
      };
    }, '_usage');

    p = branch(p, 'existing',
      (b) => {
        // Merge updated usage counters
        let b2 = mergeFrom(b, 'project', projectId, (bindings) => {
          const usage = bindings._usage as { newTokens: number; newSearchCalls: number };
          return {
            tokens_used: usage.newTokens,
            search_calls_used: usage.newSearchCalls,
          };
        });

        // Check budget limits — nested branch for budget_exceeded vs ok
        return branch(b2,
          (bindings) => {
            const usage = bindings._usage as {
              newTokens: number; newSearchCalls: number;
              maxTokens: number | null; maxSearchCalls: number | null;
            };
            return (usage.maxTokens != null && usage.newTokens > usage.maxTokens) ||
              (usage.maxSearchCalls != null && usage.newSearchCalls > usage.maxSearchCalls);
          },
          (exceeded) => completeFrom(exceeded, 'budget_exceeded', (bindings) => {
            const usage = bindings._usage as {
              newTokens: number; newSearchCalls: number;
              maxTokens: number | null; maxSearchCalls: number | null;
            };
            if (usage.maxTokens != null && usage.newTokens > usage.maxTokens) {
              return { resource: 'tokens', limit: usage.maxTokens, current: usage.newTokens };
            }
            return { resource: 'search_calls', limit: usage.maxSearchCalls ?? 0, current: usage.newSearchCalls };
          }) as StorageProgram<Result>,
          (ok) => complete(ok, 'ok', { project: projectId }) as StorageProgram<Result>,
        );
      },
      (b) => complete(b, 'notfound', { message: 'No project exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Advance the project lifecycle to the new status.
   * Enforces valid FSM transitions.
   */
  transition(input: Record<string, unknown>) {
    const projectId = toStr(input.project);
    const new_status = toStr(input.new_status);

    let p = createProgram();
    p = spGet(p, 'project', projectId, 'existing');

    // Derive transition validity from the existing record
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      if (!rec) return null;
      const current_status = (rec.project_status ?? rec.status) as string;
      const allowed = VALID_TRANSITIONS[current_status];
      return {
        current_status,
        allowed: allowed ? allowed.has(new_status) : false,
      };
    }, '_transition');

    p = branch(p, 'existing',
      (b) => {
        // Branch on whether the transition is valid
        return branch(b,
          (bindings) => {
            const t = bindings._transition as { allowed: boolean } | null;
            return !t || !t.allowed;
          },
          // Invalid transition
          (inv) => completeFrom(inv, 'invalid_transition', (bindings) => {
            const t = bindings._transition as { current_status: string } | null;
            return {
              current: t?.current_status ?? 'unknown',
              requested: new_status,
            };
          }) as StorageProgram<Result>,
          // Valid transition — apply it
          (ok) => {
            const updates: Record<string, unknown> = { project_status: new_status };
            if (new_status === 'completed' || new_status === 'cancelled') {
              updates.completed_at = new Date().toISOString();
            }
            let b2 = mergeFrom(ok, 'project', projectId, (_bindings) => updates);
            return complete(b2, 'ok', { project: projectId }) as StorageProgram<Result>;
          },
        );
      },
      (b) => complete(b, 'notfound', { message: 'No project exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Associate the final report ContentNode with this project.
   */
  linkReport(input: Record<string, unknown>) {
    const projectId = toStr(input.project);
    const report_entity_id = toStr(input.report_entity_id);

    let p = createProgram();
    p = spGet(p, 'project', projectId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mergeFrom(b, 'project', projectId, (_bindings) => ({ report_entity_id }));
        return complete(b2, 'ok', { project: projectId }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { message: 'No project exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Return the project and its current lifecycle and usage state.
   */
  get(input: Record<string, unknown>) {
    const projectId = toStr(input.project);

    let p = createProgram();
    p = spGet(p, 'project', projectId, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          project: projectId,
          query: rec.query as string,
          project_status: (rec.project_status ?? rec.status) as string,
          tokens_used: (rec.tokens_used as number) || 0,
          search_calls_used: (rec.search_calls_used as number) || 0,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { message: 'No project exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Return a JSON array of projects.
   * When status_filter is non-empty, only projects in that status are returned.
   */
  list(input: Record<string, unknown>) {
    const status_filter = toStr(input.status_filter);

    const criteria: Record<string, unknown> = {};
    if (status_filter && status_filter.trim() !== '') {
      criteria.project_status = status_filter;
    }

    let p = createProgram();
    p = find(p, 'project', criteria, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      projects: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
    })) as StorageProgram<Result>;
  },
};

export const researchProjectHandler = autoInterpret(_researchProjectHandler);
