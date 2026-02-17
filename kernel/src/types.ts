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

export interface ConceptStorage {
  put(relation: string, key: string, value: Record<string, unknown>): Promise<void>;
  get(relation: string, key: string): Promise<Record<string, unknown> | null>;
  find(relation: string, criteria?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  del(relation: string, key: string): Promise<void>;
  delMany(relation: string, criteria: Record<string, unknown>): Promise<number>;
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
}

// --- Concept Registry ---

export interface ConceptRegistry {
  register(uri: string, transport: ConceptTransport): void;
  resolve(uri: string): ConceptTransport | undefined;
  available(uri: string): boolean;
  /** Phase 11: swap transport for an existing concept (hot reload) */
  reloadConcept?(uri: string, transport: ConceptTransport): void;
  /** Phase 11: remove a concept, returns true if it existed */
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

export type WhereEntry = WhereClause | WhereQuery;

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
  value:
    | { type: 'literal'; value: string | number | boolean }
    | { type: 'variable'; name: string };
}

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

// --- ConceptManifest (Stage 4: language-neutral IR) ---
// Architecture doc Section 10.1, Stage 4.
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
  | { kind: 'variable'; name: string };

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
}

// --- Utility ---

export function generateId(): string {
  return randomUUID();
}

export function timestamp(): string {
  return new Date().toISOString();
}
