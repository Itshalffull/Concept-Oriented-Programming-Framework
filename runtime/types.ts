// ============================================================
// Clef Kernel - Shared Types
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
  matchedIds?: string[];
  timestamp: string;
  /** Stack of derived concept context tags (e.g. ["Trash/moveToTrash", "FileLifecycle/delete"]). */
  derivedContext?: string[];
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
  purpose?: string;
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
  | { kind: 'record'; fields: { name: string; type: TypeExpr }[] }
  | { kind: 'enum'; values: string[] };

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
  /** Sequence of action patterns and/or property assertions. */
  thenPatterns: InvariantASTStep[];
  /** Optional `when` guard clause. */
  whenClause?: InvariantWhenClause;
}

/**
 * A step in an invariant's `then` chain: either an action invocation
 * or a property assertion (e.g. `d.status = "complete"`).
 */
export type InvariantASTStep =
  | ({ kind: 'action' } & ActionPattern)
  | ({ kind: 'assertion' } & InvariantAssertion);

export interface ActionPattern {
  actionName: string;
  inputArgs: ArgPattern[];
  variantName: string;
  outputArgs: ArgPattern[];
}

/**
 * A property assertion like `d.status = "complete"` or `i.generation > 0`.
 */
export interface InvariantAssertion {
  left: AssertionExpr;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in';
  right: AssertionExpr;
}

export type AssertionExpr =
  | { type: 'dot_access'; variable: string; field: string }
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'variable'; name: string }
  | { type: 'list'; items: AssertionExpr[] };

/**
 * A `when` guard clause with one or more conditions joined by `and`.
 */
export interface InvariantWhenClause {
  conditions: InvariantAssertion[];
}

export interface ArgPattern {
  name: string;
  value: ArgPatternValue;
}

export type ArgPatternValue =
  | { type: 'literal'; value: string | number | boolean }
  | { type: 'variable'; name: string }
  | { type: 'dot_access'; variable: string; field: string }
  | { type: 'spread' }
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

// --- Derived Concept AST ---

/** Entry in a derived concept's composes section. */
export interface ComposesEntry {
  /** Name of the composed concept or derived concept. */
  name: string;
  /** Type parameters applied to this composed concept. */
  typeParams: string[];
  /** True if this composes a derived concept (uses `derived` keyword). */
  isDerived: boolean;
}

/** A surface action declaration in a derived concept. */
export interface DerivedSurfaceAction {
  /** Action name (e.g. "moveToTrash"). */
  name: string;
  /** Parameters for this surface action. */
  params: ParamDecl[];
  /** Entry pattern match — either a concept/action reference or derivedContext match. */
  matches: DerivedActionMatch;
  /** Triggered actions after entry match (entry/triggers form). */
  triggers?: DerivedActionTrigger[];
}

/** A triggered action in an entry/triggers surface action. */
export interface DerivedActionTrigger {
  concept: string;
  action: string;
  args: Record<string, string>;
}

/** How a surface action matches against constituent concept actions. */
export type DerivedActionMatch =
  /** Match on a constituent concept's action invocation input fields. */
  | { type: 'action'; concept: string; action: string; fields?: Record<string, unknown> }
  /** Match on a derivedContext tag (for derived-of-derived composition). */
  | { type: 'derivedContext'; tag: string }
  /** Entry match with field bindings (entry/triggers form). */
  | { type: 'entry'; concept: string; action: string; fields?: Record<string, string> };

/** A surface query declaration in a derived concept. */
export interface DerivedSurfaceQuery {
  /** Query name (e.g. "trashedItems"). */
  name: string;
  /** Parameters for this query. */
  params: ParamDecl[];
  /** Concept and action to delegate to. */
  target: { concept: string; action: string; args: Record<string, string> };
}

/** Operational principle step for a derived concept. */
export interface DerivedPrincipleStep {
  kind: 'after' | 'then' | 'and';
  /** Natural language or structured assertion. */
  text: string;
  /** If structured: surface action or query name. */
  actionName?: string;
  /** Arguments for the action or query. */
  args?: Record<string, string>;
  /** Assertion keyword (e.g. "includes", "excludes", "succeeds", "returns"). */
  assertion?: string;
}

/** Full operational principle of a derived concept. */
export interface DerivedPrinciple {
  steps: DerivedPrincipleStep[];
}

/** AST node for a parsed .derived file. */
export interface DerivedAST {
  /** Name of the derived concept (e.g. "Trash"). */
  name: string;
  /** Type parameters (e.g. ["T"]). */
  typeParams: string[];
  /** Purpose statement in prose. */
  purpose?: string;
  /** Concepts and derived concepts that participate in this composition. */
  composes: ComposesEntry[];
  /** Sync files claimed by this derived concept (defines the runtime boundary). */
  syncs: { required: string[]; recommended?: string[] };
  /** Surface declarations — actions and queries. */
  surface: {
    actions: DerivedSurfaceAction[];
    queries: DerivedSurfaceQuery[];
  };
  /** Operational principle of the composition. */
  principle?: DerivedPrinciple;
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
  /** Generation suite metadata — set when concept is declared as a generator. */
  generation?: {
    family: string;
    inputKind: string;
    outputKind: string;
    deterministic: boolean;
    pure: boolean;
  };
}

// --- Widget Manifest (Surface IR) ---

/** Anatomy part in a widget specification. */
export interface WidgetAnatomyPart {
  name: string;
  role?: string;
  required?: boolean;
  children?: WidgetAnatomyPart[];
}

/** State in a widget state machine. */
export interface WidgetState {
  name: string;
  initial: boolean;
  transitions: { event: string; target: string }[];
  entryActions?: string[];
  exitActions?: string[];
}

/** Accessibility contract for a widget. */
export interface WidgetAccessibility {
  role: string;
  keyboard: { key: string; action: string }[];
  focus: { trap?: boolean; initial?: string; roving?: boolean };
  ariaAttrs?: { name: string; value: string; dynamic?: boolean }[];
}

/** Affordance declaration binding a widget to concept state. */
export interface WidgetAffordance {
  serves: string;
  specificity?: number;
  when?: string;
  binds: { field: string; source: string }[];
}

/** Property declaration for a widget. */
export interface WidgetProp {
  name: string;
  type: string;
  defaultValue?: string;
}

/** Language-neutral IR for a parsed .widget file. */
export interface WidgetManifest {
  name: string;
  purpose: string;
  version?: number;
  category?: string;
  anatomy: WidgetAnatomyPart[];
  states: WidgetState[];
  props: WidgetProp[];
  slots: string[];
  accessibility: WidgetAccessibility;
  affordance?: WidgetAffordance;
  composedWidgets: string[];
}

// --- Theme Manifest (Surface IR) ---

/** Language-neutral IR for a parsed .theme file. */
export interface ThemeManifest {
  name: string;
  purpose: string;
  extends?: string;
  palette: Record<string, string>;
  colorRoles: Record<string, string>;
  typography: Record<string, unknown>;
  spacing: { unit?: string; scale: Record<string, string> };
  motion: Record<string, unknown>;
  elevation: Record<string, unknown>;
  radius: Record<string, string>;
}

// --- Suite Manifest (Section 9) ---

/** A single external concept declared in a suite's uses section. */
export interface UsesConceptEntry {
  name: string;
  params?: Record<string, { as: string; description?: string }>;
}

/**
 * A uses declaration grouping external concepts by source suite.
 *
 * When `optional` is true, the entry's syncs only load if the named
 * suite is present (what was previously the `integrations` section).
 * When false or omitted, the concepts are required for this suite to
 * function — the compiler errors if they're unavailable.
 */
export interface UsesEntry {
  suite: string;
  optional?: boolean;
  concepts: UsesConceptEntry[];
  syncs?: Array<{ path: string; description?: string }>;
}

/** Parsed suite manifest structure (suite.yaml). */
export interface SuiteManifest {
  suite: { name: string; version: string; description: string };
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
