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

// --- Utility ---

export function generateId(): string {
  return randomUUID();
}

export function timestamp(): string {
  return new Date().toISOString();
}
