// ============================================================
// HandlerDescriptor — normalized input for handlers-as-values renderers.
//
// Unifies the three shapes the TestPlan IR consumes:
//   1. StorageProgram descriptions (reads/writes/performs/variants
//      extracted via read-write-set-provider + transport-effect-provider)
//   2. ExternalHandler manifests (method/path/auth/FieldTransforms
//      produced by ExternalHandlerGen)
//   3. Scenario invariants (pre-existing TestPlan IR input, unchanged)
//
// The four new renderer plugins (MockHandlerRenderer, ReplayHandlerRenderer,
// EffectContractRenderer, FieldTransformFuzzRenderer) accept the JSON-
// encoded form of this descriptor via their render(descriptor: String)
// action.
// ============================================================

export type HandlerKind = 'storage' | 'external';

export interface FieldTransform {
  from: string;
  to: string;
}

export interface HandlerDescriptor {
  /** PascalCase concept name, e.g. "User". */
  conceptName: string;
  /** camelCase action name, e.g. "create". */
  actionName: string;
  /** "storage" for StorageProgram-derived, "external" for manifest-derived. */
  kind: HandlerKind;
  /** Storage relations the handler reads. Extracted via read-write-set-provider. */
  reads: string[];
  /** Storage relations the handler writes. */
  writes: string[];
  /** Transport effects as "protocol:operation" pairs, e.g. "http:GET". */
  performs: string[];
  /** Completion variants reachable through the handler. */
  variants: string[];
  /** Request-side FieldTransforms (only for kind === "external"). */
  requestFields?: FieldTransform[];
  /** Response-side FieldTransforms (only for kind === "external"). */
  responseFields?: FieldTransform[];
  /** HTTP method (only for kind === "external"). */
  method?: string;
  /** HTTP path template (only for kind === "external"). */
  path?: string;
  /** Auth header name (only for kind === "external"). */
  authHeader?: string;
}

/** Parse + validate a JSON-encoded HandlerDescriptor string. */
export function parseDescriptor(
  raw: string,
): { ok: true; descriptor: HandlerDescriptor } | { ok: false; message: string } {
  if (!raw || raw.trim() === '') {
    return { ok: false, message: 'descriptor is required' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      message: `descriptor is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: 'descriptor must be a JSON object' };
  }
  const d = parsed as Record<string, unknown>;
  if (typeof d.conceptName !== 'string' || d.conceptName === '') {
    return { ok: false, message: 'descriptor.conceptName is required' };
  }
  if (typeof d.actionName !== 'string' || d.actionName === '') {
    return { ok: false, message: 'descriptor.actionName is required' };
  }
  if (d.kind !== 'storage' && d.kind !== 'external') {
    return { ok: false, message: 'descriptor.kind must be "storage" or "external"' };
  }
  const descriptor: HandlerDescriptor = {
    conceptName: d.conceptName,
    actionName: d.actionName,
    kind: d.kind,
    reads: Array.isArray(d.reads) ? (d.reads as string[]) : [],
    writes: Array.isArray(d.writes) ? (d.writes as string[]) : [],
    performs: Array.isArray(d.performs) ? (d.performs as string[]) : [],
    variants: Array.isArray(d.variants) && d.variants.length > 0
      ? (d.variants as string[])
      : ['ok'],
    requestFields: Array.isArray(d.requestFields)
      ? (d.requestFields as FieldTransform[])
      : undefined,
    responseFields: Array.isArray(d.responseFields)
      ? (d.responseFields as FieldTransform[])
      : undefined,
    method: typeof d.method === 'string' ? d.method : undefined,
    path: typeof d.path === 'string' ? d.path : undefined,
    authHeader: typeof d.authHeader === 'string' ? d.authHeader : undefined,
  };
  return { ok: true, descriptor };
}

/** camelCase -> PascalCase helper. */
export function pascal(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

// ── Descriptor extraction from the three input shapes ─────────

import type { StorageProgram } from '../../../../runtime/storage-program.ts';

/** Build a HandlerDescriptor from a StorageProgram's tracked EffectSet. */
export function descriptorFromProgram(
  conceptName: string,
  actionName: string,
  program: StorageProgram<unknown>,
): HandlerDescriptor {
  return {
    conceptName,
    actionName,
    kind: 'storage',
    reads: Array.from(program.effects.reads),
    writes: Array.from(program.effects.writes),
    performs: Array.from(program.effects.performs),
    variants: Array.from(program.effects.completionVariants),
  };
}

/**
 * Build a HandlerDescriptor from an ExternalHandlerGen manifest action mapping.
 * Shape matches the ActionMapping interface in external-handler-gen.handler.ts.
 */
export interface ExternalActionMapping {
  name: string;
  method: string;
  path: string;
  fieldTransforms: {
    request: FieldTransform[];
    response: FieldTransform[];
  };
}

export function descriptorFromExternalMapping(
  conceptName: string,
  mapping: ExternalActionMapping,
  authHeader?: string,
  variants: string[] = ['ok', 'error'],
): HandlerDescriptor {
  return {
    conceptName,
    actionName: mapping.name,
    kind: 'external',
    reads: [],
    writes: [],
    performs: [`http:${mapping.method.toUpperCase()}`],
    variants,
    requestFields: mapping.fieldTransforms.request,
    responseFields: mapping.fieldTransforms.response,
    method: mapping.method.toUpperCase(),
    path: mapping.path,
    authHeader,
  };
}
