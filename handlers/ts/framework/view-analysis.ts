// ============================================================
// Clef Kernel - ViewAnalysis Compiler
//
// Compiles a named ViewShell (with its child specs) into a
// QueryProgram and runs the three analysis providers against
// it to produce a ViewAnalysis record.
//
// Used as a test-time utility by the view test generator.
// Replicates the CompileQuery sync logic in a single async
// function usable without a running sync engine.
//
// Section 16.x: View Invariant Declaration
// ============================================================

import type { ConceptStorage } from '../../../runtime/types.js';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import { queryProgramHandler } from '../view/query-program.handler.js';
import { queryPurityProviderHandler } from '../view/providers/query-purity-provider.handler.js';
import { invokeEffectProviderHandler } from '../view/providers/invoke-effect-provider.handler.js';
import { queryCompletionCoverageHandler } from '../view/providers/query-completion-coverage.handler.js';

// ─── ViewAnalysis type ────────────────────────────────────────────────────────

export interface ViewAnalysis {
  // From QueryPurityProvider
  purity: string;           // 'pure' | 'read-only' | 'read-write'
  readFields: string[];
  invokedActions: string[];

  // From InvokeEffectProvider
  invocations: string[];
  invokeCount: number;

  // From QueryCompletionCoverage
  coveredVariants: string[];
  uncoveredVariants: string[];
  totalVariants: number;
  coveredCount: number;

  // From QueryProgram state
  instructions: string[];
  bindings: string[];
  terminated: boolean;

  // Derived from ViewShell child specs
  sourceFields: string[];
  filterFields: string[];
  sortFields: string[];
  groupFields: string[];
  projectedFields: string[];
}

// ─── Field extraction helpers ─────────────────────────────────────────────────

/**
 * Extract field names referenced in a FilterNode predicate tree.
 * A FilterNode is a JSON string or an object with `field`, `children`, or `child`.
 */
export function extractFilterFields(filterTree: string): string[] {
  const fields = new Set<string>();

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;

    if (typeof n.field === 'string') {
      fields.add(n.field);
    }
    // Composite nodes: and/or
    if (Array.isArray(n.children)) {
      for (const child of n.children) walk(child);
    }
    // Not node
    if (n.child) walk(n.child);
  }

  try {
    const parsed = JSON.parse(filterTree);
    walk(parsed);
  } catch {
    // Not parseable — no fields extractable
  }

  return [...fields];
}

/**
 * Extract field names from a SortSpec keys JSON string.
 * Expected shape: [{ field: string, direction: string }, ...]
 */
export function extractSortFields(sortKeys: string): string[] {
  const fields: string[] = [];

  try {
    const parsed = JSON.parse(sortKeys);
    if (Array.isArray(parsed)) {
      for (const k of parsed) {
        if (k && typeof k === 'object' && typeof (k as Record<string, unknown>).field === 'string') {
          const f = (k as Record<string, unknown>).field as string;
          if (!fields.includes(f)) fields.push(f);
        }
      }
    }
  } catch {
    // Not parseable — no fields extractable
  }

  return fields;
}

/**
 * Extract field names from a GroupSpec grouping JSON string.
 * Supports multiple shapes:
 *   - Array of strings: ["field1", "field2"]
 *   - { type: "basic", keys: ["field1", ...] }
 *   - { type: "basic", fields: [{ field: "fieldName" }, ...] }
 *   - { grouping: { keys: [...] } } (nested grouping object)
 */
export function extractGroupFields(groupKeys: string): string[] {
  const fields: string[] = [];

  try {
    const parsed = JSON.parse(groupKeys);

    // Array of key strings
    if (Array.isArray(parsed)) {
      for (const k of parsed) {
        if (typeof k === 'string' && !fields.includes(k)) fields.push(k);
      }
      return fields;
    }

    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;

      // { type: "basic", fields: [{ field: "fieldName" }, ...] } shape
      if (Array.isArray(obj.fields)) {
        for (const f of obj.fields) {
          if (f && typeof f === 'object') {
            const fObj = f as Record<string, unknown>;
            if (typeof fObj.field === 'string' && !fields.includes(fObj.field)) {
              fields.push(fObj.field);
            }
          }
        }
        if (fields.length > 0) return fields;
      }

      // { type: "basic", keys: ["field1", ...] } shape
      if (Array.isArray(obj.keys)) {
        for (const k of obj.keys) {
          if (typeof k === 'string' && !fields.includes(k)) fields.push(k);
          else if (k && typeof k === 'object') {
            const kObj = k as Record<string, unknown>;
            if (typeof kObj.field === 'string' && !fields.includes(kObj.field)) {
              fields.push(kObj.field);
            }
          }
        }
        if (fields.length > 0) return fields;
      }

      // { grouping: { keys: [...] } } nested shape
      const grouping = obj.grouping as Record<string, unknown> | undefined;
      const nestedKeys = grouping?.keys as unknown[] | undefined;
      if (Array.isArray(nestedKeys)) {
        for (const k of nestedKeys) {
          if (typeof k === 'string' && !fields.includes(k)) fields.push(k);
        }
      }
    }
  } catch {
    // Not parseable — no fields extractable
  }

  return fields;
}

/**
 * Extract field keys from a ProjectionSpec fields JSON string.
 * Expected shape: [{ key: string, ... }, ...] or [string, ...]
 */
export function extractProjectedFields(projectionFields: string): string[] {
  const fields: string[] = [];

  try {
    const parsed = JSON.parse(projectionFields);
    if (Array.isArray(parsed)) {
      for (const f of parsed) {
        if (typeof f === 'string' && !fields.includes(f)) {
          fields.push(f);
        } else if (f && typeof f === 'object') {
          const fObj = f as Record<string, unknown>;
          if (typeof fObj.key === 'string' && !fields.includes(fObj.key)) {
            fields.push(fObj.key);
          }
        }
      }
    }
  } catch {
    // Not parseable — no fields extractable
  }

  return fields;
}

/**
 * Extract field names from a DataSourceSpec config JSON string.
 * For `concept-action` kinds this returns the schema fields if declared;
 * for other kinds this returns the top-level keys of the config object.
 */
export function extractSourceFields(sourceConfig: string): string[] {
  const fields: string[] = [];

  try {
    const parsed = JSON.parse(sourceConfig);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;

      // Concept-action: return declared field list if present
      if (Array.isArray(obj.fields)) {
        for (const f of obj.fields) {
          if (typeof f === 'string' && !fields.includes(f)) fields.push(f);
        }
        if (fields.length > 0) return fields;
      }

      // Fallback: top-level config keys (minus meta-keys)
      const meta = new Set(['concept', 'action', 'params', 'kind']);
      for (const k of Object.keys(obj)) {
        if (!meta.has(k) && !fields.includes(k)) fields.push(k);
      }
    }
  } catch {
    // Not parseable — no fields extractable
  }

  return fields;
}

// ─── JSON parse helper ────────────────────────────────────────────────────────

function safeParse<T = unknown>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// ─── compileAndAnalyze ────────────────────────────────────────────────────────

/**
 * Load a named ViewShell from storage, load its child specs,
 * build a QueryProgram (replicating the CompileQuery sync logic),
 * run the three analysis providers, and return a ViewAnalysis.
 *
 * This is a test-time utility — it creates its own in-memory
 * storage for the QueryProgram builder so the caller's storage
 * is not mutated.
 *
 * @param shellName - The name of the ViewShell record in storage.
 * @param storage   - The ConceptStorage containing ViewShell + child spec records.
 */
export async function compileAndAnalyze(
  shellName: string,
  storage: ConceptStorage,
): Promise<ViewAnalysis> {
  // ── 1. Load ViewShell ──────────────────────────────────────────────────────
  // The view-shell handler stores records in the 'view' relation
  const shellRecord = await storage.get('view', shellName);
  if (!shellRecord) {
    throw new Error(`ViewShell not found: "${shellName}"`);
  }

  const dataSourceName = shellRecord.dataSource as string | undefined ?? '';
  const filterName     = shellRecord.filter     as string | undefined ?? '';
  const sortName       = shellRecord.sort       as string | undefined ?? '';
  const groupName      = shellRecord.group      as string | undefined ?? '';
  const projectionName = shellRecord.projection as string | undefined ?? '';
  const interactionName= shellRecord.interaction as string | undefined ?? '';

  // ── 2. Load child spec records ────────────────────────────────────────────
  // Relation names match the storage keys used in each handler's put() calls:
  //   DataSourceSpec → 'source'      FilterSpec → 'filter'
  //   SortSpec       → 'sort'        GroupSpec  → 'group'
  //   ProjectionSpec → 'projection'  InteractionSpec → 'interaction'
  const [dataSourceRec, filterRec, sortRec, groupRec, projectionRec, interactionRec] =
    await Promise.all([
      dataSourceName  ? storage.get('source',      dataSourceName)  : null,
      filterName      ? storage.get('filter',      filterName)      : null,
      sortName        ? storage.get('sort',        sortName)        : null,
      groupName       ? storage.get('group',       groupName)       : null,
      projectionName  ? storage.get('projection',  projectionName)  : null,
      interactionName ? storage.get('interaction', interactionName) : null,
    ]);

  const sourceConfig     = (dataSourceRec?.config   as string | undefined) ?? '{}';
  const filterTree       = (filterRec?.tree         as string | undefined) ?? '{"type":"true"}';
  const sortKeys         = (sortRec?.keys           as string | undefined) ?? '[]';
  const groupConfig      = (groupRec?.grouping      as string | undefined) ?? '';
  const aggregations     = (groupRec?.aggregations  as string | undefined) ?? '[]';
  const projectionFields = (projectionRec?.fields   as string | undefined) ?? '[]';

  // ── 3. Build QueryProgram ─────────────────────────────────────────────────
  // Use a fresh in-memory storage so the caller's storage is not mutated.
  const qpStorage = createInMemoryStorage();
  const programId = `view-analysis-${shellName}-${Date.now()}`;

  const create = await queryProgramHandler.create({ program: programId }, qpStorage);
  if (create.variant !== 'ok' && create.variant !== 'exists') {
    throw new Error(`Failed to create QueryProgram: ${String(create.message ?? create.variant)}`);
  }

  await queryProgramHandler.scan({ program: programId, source: sourceConfig, bindAs: 'records' }, qpStorage);
  await queryProgramHandler.filter({ program: programId, node: filterTree, bindAs: 'filtered' }, qpStorage);

  // Group step — only when a non-empty group spec is present
  if (groupConfig && groupConfig.trim() !== '') {
    await queryProgramHandler.group({ program: programId, keys: groupConfig, config: aggregations, bindAs: 'grouped' }, qpStorage);
  }

  await queryProgramHandler.sort({ program: programId, keys: sortKeys, bindAs: 'sorted' }, qpStorage);
  await queryProgramHandler.project({ program: programId, fields: projectionFields, bindAs: 'projected' }, qpStorage);

  // Interaction spec: add invoke instructions for row actions that declare
  // concept/action targets. rowActions is a JSON array of action descriptors.
  // createForm may also contain a { concept, action } invoke target.
  // NOTE: invoke instructions MUST be added before pure() — pure() seals the
  // program and subsequent invoke calls will return 'sealed'.
  if (interactionRec) {
    const createForm = interactionRec.createForm as string | undefined;
    const rowActionsStr = interactionRec.rowActions as string | undefined;

    // createForm: may be a JSON object with concept + action fields
    if (createForm) {
      const form = safeParse<Record<string, unknown>>(createForm, {});
      if (form && typeof form.concept === 'string' && typeof form.action === 'string') {
        await queryProgramHandler.invoke({
          program: programId,
          concept: form.concept,
          action: form.action as string,
          input: '{}',
          bindAs: `${form.concept}_${form.action}_result`,
        }, qpStorage);
      }
    }

    // rowActions: array of action descriptors, each may have concept + action
    if (rowActionsStr) {
      const rowActions = safeParse<Array<Record<string, unknown>>>(rowActionsStr, []);
      for (const rowAction of rowActions) {
        if (typeof rowAction.concept === 'string' && typeof rowAction.action === 'string') {
          await queryProgramHandler.invoke({
            program: programId,
            concept: rowAction.concept,
            action: rowAction.action as string,
            input: '{}',
            bindAs: `${rowAction.concept}_${rowAction.action}_result`,
          }, qpStorage);
        }
      }
    }
  }

  // pure() terminates the program — must be last
  await queryProgramHandler.pure({ program: programId, variant: 'ok', output: 'projected' }, qpStorage);

  // ── 4. Read the built program record ─────────────────────────────────────
  const programRecord = await qpStorage.get('queryProgram', programId);
  if (!programRecord) {
    throw new Error(`QueryProgram record not found after build: "${programId}"`);
  }

  // ── 5. Extract analysis values ───────────────────────────────────────────
  //
  // The QueryProgram handler maintains purity, readFields, and invokedActions
  // incrementally during construction (see ProgramRecord helpers). We read
  // these directly from the stored record — more reliable than running the
  // analysis providers against instruction JSON strings (which use 'type' not
  // 'tag', causing the providers' walkers to skip entries).
  //
  // For InvokeEffectProvider we also read directly: invocations = invokedActions,
  // and invokeCount = number of invoke-type instructions in the record.
  //
  // QueryCompletionCoverage still uses the provider because it cross-references
  // conceptSpecs; for static analysis we pass an empty spec map.

  // From QueryPurityProvider's tracked fields (already in the record):
  const purity         = (programRecord.purity         as string  | undefined) ?? 'pure';
  const readFields     = (programRecord.readFields     as string[] | undefined) ?? [];
  const invokedActions = (programRecord.invokedActions as string[] | undefined) ?? [];

  // From InvokeEffectProvider: reuse the record's tracked invocations
  const invocations = [...invokedActions];
  const invokeCount = invocations.length;

  // Build a normalized program representation for the coverage provider.
  // Parse instruction JSON strings to objects so the provider can walk them.
  const storedInstructions    = (programRecord.instructions as string[] | undefined) ?? [];
  const parsedInstructions = storedInstructions.map((s) => {
    try { return JSON.parse(s); } catch { return null; }
  }).filter(Boolean);

  const programForProviders = JSON.stringify({
    ...programRecord,
    instructions: parsedInstructions,
  });

  // QueryCompletionCoverage (no conceptSpecs for static analysis — empty object)
  const coverageResult = await queryCompletionCoverageHandler.check(
    { program: programForProviders, conceptSpecs: '{}' },
    qpStorage,
  );
  const coveredVariants   = safeParse<string[]>(coverageResult.covered   as string | undefined, []);
  const uncoveredVariants = safeParse<string[]>(coverageResult.uncovered as string | undefined, []);
  const totalVariants     = coveredVariants.length + uncoveredVariants.length;
  const coveredCount      = coveredVariants.length;

  // ── 6. Extract field sets from child specs ────────────────────────────────
  const sourceFields    = extractSourceFields(sourceConfig);
  const filterFields    = extractFilterFields(filterTree);
  const sortFieldsList  = extractSortFields(sortKeys);
  const groupFieldsList = extractGroupFields(groupConfig || '[]');
  const projectedFields = extractProjectedFields(projectionFields);

  // ── 7. Extract QueryProgram state ─────────────────────────────────────────
  // storedInstructions is already extracted above for the provider input
  const instructions = storedInstructions;
  const bindings     = (programRecord.bindings     as string[] | undefined) ?? [];
  const terminated   = (programRecord.terminated   as boolean | undefined) ?? false;

  // ── 8. Return ViewAnalysis ────────────────────────────────────────────────
  return {
    purity,
    readFields,
    invokedActions,

    invocations,
    invokeCount,

    coveredVariants,
    uncoveredVariants,
    totalVariants,
    coveredCount,

    instructions,
    bindings,
    terminated,

    sourceFields,
    filterFields,
    sortFields: sortFieldsList,
    groupFields: groupFieldsList,
    projectedFields,
  };
}
