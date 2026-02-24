// ============================================================
// COPF Kernel - Shared Types
// ============================================================

import { randomUUID } from 'crypto';

// --- Action Messages (IR) ---

export interface ActionInvocation {
  id: string;
  concept: string;
  action: string;
  input: Record<string, unknown>;
  flow: string;
  sync?: string;
  timestamp: string;
}

export interface ActionCompletion {
  id: string;
  concept: string;
  action: string;
  input: Record<string, unknown>;
  variant: string;
  output: Record<string, unknown>;
  flow: string;
  timestamp: string;
}

// --- Action Log ---

export interface ActionRecord {
  id: string;
  type: 'invocation' | 'completion';
  concept: string;
  action: string;
  input: Record<string, unknown>;
  variant?: string;
  output?: Record<string, unknown>;
  flow: string;
  sync?: string;
  parent?: string;
  timestamp: string;
}

// --- Storage Interface ---

/** Metadata for a stored entry. */
export interface EntryMeta {
  lastWrittenAt: string;
}

/** Conflict resolution result returned by onConflict callback. */
export type ConflictResolution =
  | { action: 'keep-existing' }
  | { action: 'accept-incoming' }
  | { action: 'merge'; merged: Record<string, unknown> }
  | { action: 'escalate' };

/** Conflict details passed to onConflict callback. */
export interface ConflictInfo {
  relation: string;
  key: string;
  existing: { fields: Record<string, unknown>; writtenAt: string };
  incoming: { fields: Record<string, unknown>; writtenAt: string };
}

export interface ConceptStorage {
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  del(relation: string, key: string): Promise<void>;
  delMany(relation: string, criteria: Record<string, unknown>): Promise<number>;
  /** Retrieve write timestamp metadata for a stored entry. */
  getMeta?(relation: string, key: string): Promise<EntryMeta | null>;
  /** Conflict detection callback for concurrent writes. */
  onConflict?: (info: ConflictInfo) => ConflictResolution;
}

// --- Concept Handler ---

export interface ConceptHandler {
  [actionName: string]: (
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) => Promise<{ variant: string; [key: string]: unknown }>;
}

// --- Transport Interface ---

export interface ConceptTransport {
  invoke(invocation: ActionInvocation): Promise<ActionCompletion>;
  query(request: ConceptQuery): Promise<Record<string, unknown>[]>;
  health(): Promise<{ available: boolean; latency: number }>;
  queryMode: 'graphql' | 'lite';
}

export interface ConceptQuery {
  relation: string;
  args?: Record<string, unknown>;
  graphql?: string;
}

// --- Concept Registry ---

export interface ConceptRegistry {
  register(uri: string, transport: ConceptTransport): void;
  resolve(uri: string): ConceptTransport | undefined;
  available(uri: string): boolean;
  /** Swap transport for an existing concept (hot reload). */
  reloadConcept?(uri: string, transport: ConceptTransport): void;
  /** Remove a concept, returns true if it existed. */
  deregisterConcept?(uri: string): boolean;
}

// --- Compiled Sync ---

export interface WhenPattern {
  concept: string;
  action: string;
  inputFields: FieldPattern[];
  outputFields: FieldPattern[];
}

export interface FieldPattern {
  name: string;
  match:
    | { type: 'literal'; value: unknown }
    | { type: 'variable'; name: string }
    | { type: 'wildcard' };
}

export interface WhereClause {
  type: 'bind';
  expr: string;
  as: string;
}

export interface WhereQuery {
  type: 'query';
  concept: string;
  bindings: QueryBinding[];
}

export interface QueryBinding {
  variable: string;
  field: string;
}

export interface WhereFilter {
  type: 'filter';
  expr: string;
}

export type WhereEntry = WhereClause | WhereQuery | WhereFilter;

export interface ThenAction {
  concept: string;
  action: string;
  fields: ThenField[];
}

export interface ThenField {
  name: string;
  value:
    | { type: 'literal'; value: unknown }
    | { type: 'variable'; name: string };
}

export interface CompiledSync {
  name: string;
  annotations?: string[];
  when: WhenPattern[];
  where: WhereEntry[];
  then: ThenAction[];
}

// --- Binding ---

export interface Binding {
  [variableName: string]: unknown;
  __matchedCompletionIds: string[];
}

// --- Concept AST ---

export interface ConceptAST {
  name: string;
  typeParams: string[];
  purpose?: string;
  /** Schema version declared via @version(N). Undefined means unversioned. */
  version?: number;
  /** Annotations parsed from @-prefixed decorators (e.g. @gate, @category, @visibility). */
  annotations?: { gate?: boolean; category?: string; visibility?: string };
  state: StateEntry[];
  actions: ActionDecl[];
  invariants: InvariantDecl[];
  capabilities: string[];
}

export interface StateEntry {
  name: string;
  type: TypeExpr;
  group?: string;
}

export type TypeExpr =
  | { kind: 'primitive'; name: string }
  | { kind: 'param'; name: string }
  | { kind: 'set'; inner: TypeExpr }
  | { kind: 'list'; inner: TypeExpr }
  | { kind: 'option'; inner: TypeExpr }
  | { kind: 'relation'; from: TypeExpr; to: TypeExpr }
  | { kind: 'record'; fields: { name: string; type: TypeExpr }[] };

export interface ActionDecl {
  name: string;
  /** Action-level description from `description { ... }` block. */
  description?: string;
  params: ParamDecl[];
  variants: ReturnVariant[];
}

export interface ParamDecl {
  name: string;
  type: TypeExpr;
}

export interface ReturnVariant {
  name: string;
  params: ParamDecl[];
  description?: string;
}

export interface InvariantDecl {
  afterPatterns: ActionPattern[];
  thenPatterns: ActionPattern[];
}

export interface ActionPattern {
  actionName: string;
  inputArgs: ArgPattern[];
  variantName: string;
  outputArgs: ArgPattern[];
}

export interface ArgPattern {
  name: string;
  value: ArgPatternValue;
}

export type ArgPatternValue =
  | { type: 'literal'; value: string | number | boolean }
  | { type: 'variable'; name: string }
  | { type: 'record'; fields: ArgPattern[] }
  | { type: 'list'; items: ArgPatternValue[] };

// --- Sync AST ---

export interface SyncAST {
  name: string;
  annotations: string[];
  when: SyncWhenPattern[];
  where: SyncWhereEntry[];
  then: SyncThenAction[];
}

export interface SyncWhenPattern {
  concept: string;
  action: string;
  inputFields: SyncFieldPattern[];
  outputFields: SyncFieldPattern[];
}

export interface SyncFieldPattern {
  name: string;
  match:
    | { type: 'literal'; value: unknown }
    | { type: 'variable'; name: string }
    | { type: 'wildcard' };
}

export interface SyncWhereEntry {
  type: 'bind' | 'query' | 'filter';
  expr?: string;
  as?: string;
  concept?: string;
  bindings?: QueryBinding[];
}

export interface SyncThenAction {
  concept: string;
  action: string;
  fields: SyncThenField[];
}

export interface SyncThenField {
  name: string;
  value:
    | { type: 'literal'; value: unknown }
    | { type: 'variable'; name: string };
}

// --- ConceptManifest (language-neutral IR) ---
// Architecture doc Section 10.1.
// SchemaGen produces a ConceptManifest containing everything
// a per-language code generator needs.

export interface TypeParamInfo {
  name: string;
  wireType: 'string';
  description?: string;
}

export interface RelationSchema {
  name: string;
  source: 'merged' | 'explicit' | 'set-valued';
  keyField: { name: string; paramRef: string };
  fields: FieldSchema[];
}

export interface FieldSchema {
  name: string;
  type: ResolvedType;
  optional: boolean;
}

/**
 * Recursive type tree — each generator maps this to its own type system.
 * Extends the architecture doc's definition with 'map' for relation types.
 */
export type ResolvedType =
  | { kind: 'primitive'; primitive: string }
  | { kind: 'param'; paramRef: string }
  | { kind: 'set'; inner: ResolvedType }
  | { kind: 'list'; inner: ResolvedType }
  | { kind: 'option'; inner: ResolvedType }
  | { kind: 'map'; keyType: ResolvedType; inner: ResolvedType }
  | { kind: 'record'; fields: FieldSchema[] };

export interface ActionSchema {
  name: string;
  /** Action-level description propagated from concept spec. */
  description?: string;
  params: ActionParamSchema[];
  variants: VariantSchema[];
}

export interface ActionParamSchema {
  name: string;
  type: ResolvedType;
}

export interface VariantSchema {
  tag: string;
  fields: ActionParamSchema[];
  prose?: string;
}

export interface InvariantSchema {
  description: string;
  setup: InvariantStep[];
  assertions: InvariantStep[];
  freeVariables: { name: string; testValue: string }[];
}

export interface InvariantStep {
  action: string;
  inputs: { name: string; value: InvariantValue }[];
  expectedVariant: string;
  expectedOutputs: { name: string; value: InvariantValue }[];
}

export type InvariantValue =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'variable'; name: string }
  | { kind: 'record'; fields: { name: string; value: InvariantValue }[] }
  | { kind: 'list'; items: InvariantValue[] };

export interface ConceptManifest {
  uri: string;
  name: string;
  typeParams: TypeParamInfo[];
  relations: RelationSchema[];
  actions: ActionSchema[];
  invariants: InvariantSchema[];
  graphqlSchema: string;
  jsonSchemas: {
    invocations: Record<string, object>;
    completions: Record<string, Record<string, object>>;
  };
  capabilities: string[];
  purpose: string;
  /** True if concept has @gate annotation (async gate convention). */
  gate?: boolean;
  /** Concept category from @category annotation (e.g. "devtools"). */
  category?: string;
  /** Visibility level from @visibility annotation (e.g. "framework", "public", "internal"). */
  visibility?: string;
  /** Generation kit metadata — set when concept is declared as a generator. */
  generation?: {
    family: string;
    inputKind: string;
    outputKind: string;
    deterministic: boolean;
    pure: boolean;
  };
}

// --- Kit Manifest (Section 9) ---

/** A single external concept declared in a kit's uses section. */
export interface UsesConceptEntry {
  name: string;
  params?: Record<string, { as: string; description?: string }>;
}

/**
 * A uses declaration grouping external concepts by source kit.
 *
 * When `optional` is true, the entry's syncs only load if the named
 * kit is present (what was previously the `integrations` section).
 * When false or omitted, the concepts are required for this kit to
 * function — the compiler errors if they're unavailable.
 */
export interface UsesEntry {
  kit: string;
  optional?: boolean;
  concepts: UsesConceptEntry[];
  syncs?: Array<{ path: string; description?: string }>;
}

/** Parsed kit manifest structure (kit.yaml). */
export interface KitManifest {
  kit: { name: string; version: string; description: string };
  concepts: Record<string, {
    spec: string;
    params: Record<string, { as: string; description?: string }>;
  }>;
  syncs: {
    required: Array<{ path: string; description: string }>;
    recommended: Array<{ path: string; name: string; description: string }>;
  };
  uses: UsesEntry[];
  dependencies: Array<{ name: string; version: string }>;
}

// --- Lite Query Protocol (Section 4.2) ---

export interface LiteFilter {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface ConceptStateSnapshot {
  asOf: string;
  relations: Record<string, Record<string, unknown>[]>;
}

export interface LiteQueryProtocol {
  snapshot(): Promise<ConceptStateSnapshot>;
  lookup?(relation: string, key: string): Promise<Record<string, unknown> | null>;
  filter?(criteria: LiteFilter[]): Promise<Record<string, unknown>[]>;
}

// --- Utility ---

export function generateId(): string {
  return randomUUID();
}

export function timestamp(): string {
  return new Date().toISOString();
}
