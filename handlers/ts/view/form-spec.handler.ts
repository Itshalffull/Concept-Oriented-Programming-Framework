// @clef-handler style=functional concept=FormSpec
// ============================================================
// FormSpec Concept Implementation — Functional (StorageProgram) style
//
// Manages named form specifications that declare how a schema's fields are
// presented for editing — field order, grouping, conditional visibility,
// widget overrides, and multi-step flow. Supports create, update, field
// management, condition management, step management, get, list, resolve,
// and remove. See architecture doc Section 10.1 (ConceptManifest IR) for
// concept patterns.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  del,
  delFrom,
  complete,
  completeFrom,
  branch,
  mergeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_MODES = new Set(['create', 'edit', 'both']);

// ─── Helper: make a composite duplicate-check key ──────────────────────────

function dupKey(schema: string, name: string, mode: string): string {
  return `${schema}:${name}:${mode}`;
}

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'FormSpec' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const form      = input.form   as string;
    const schema    = input.schema as string;
    const name      = input.name   as string;
    const mode      = input.mode   as string;

    if (!schema || schema.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'schema is required',
      }) as StorageProgram<Result>;
    }
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }
    if (!VALID_MODES.has(mode)) {
      return complete(createProgram(), 'error', {
        message: `mode must be "create", "edit", or "both" — got "${mode}"`,
      }) as StorageProgram<Result>;
    }

    // Check for duplicate using the composite uniqueness key (separate relation)
    const key = dupKey(schema, name, mode);
    let p = createProgram();
    p = get(p, 'form-dup', key, 'dupEntry');

    return branch(
      p,
      'dupEntry',
      // duplicate exists
      (b) =>
        completeFrom(b, 'duplicate', (bindings) => ({
          form: (bindings.dupEntry as Record<string, unknown>).form as string,
        })),
      // new — store primary record and uniqueness sentinel
      (b) => {
        let b2 = put(b, 'form', form, {
          form,
          schema,
          name,
          mode,
          steps:      '[]',
          layout:     '{}',
          conditions: '[]',
          defaults:   '{}',
          overrides:  '{}',
        });
        b2 = put(b2, 'form-dup', key, { form });
        return complete(b2, 'ok', { form });
      },
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const form       = input.form       as string;
    const layout     = input.layout     as string | undefined;
    const steps      = input.steps      as string | undefined;
    const conditions = input.conditions as string | undefined;
    const defaults   = input.defaults   as string | undefined;
    const overrides  = input.overrides  as string | undefined;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      // found — merge provided fields
      (b) => {
        const fields: Record<string, unknown> = {};
        if (layout     !== undefined && layout     !== null) fields.layout     = layout;
        if (steps      !== undefined && steps      !== null) fields.steps      = steps;
        if (conditions !== undefined && conditions !== null) fields.conditions = conditions;
        if (defaults   !== undefined && defaults   !== null) fields.defaults   = defaults;
        if (overrides  !== undefined && overrides  !== null) fields.overrides  = overrides;

        const b2 = mergeFrom(b, 'form', form, (_bindings) => fields);
        return complete(b2, 'ok', { form });
      },
      // not found
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  addField(input: Record<string, unknown>) {
    const form     = input.form     as string;
    const fieldId  = input.fieldId  as string;
    const group    = input.group    as string | undefined;
    const position = input.position as number | undefined;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = mergeFrom(b, 'form', form, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let layoutObj: Record<string, unknown> = {};
          try {
            layoutObj = JSON.parse((existing.layout as string) || '{}') as Record<string, unknown>;
          } catch {
            layoutObj = {};
          }
          const groups = (layoutObj.groups as Array<Record<string, unknown>>) ?? [];
          const targetGroup = group ?? '_default';
          let grp = groups.find((g) => g.id === targetGroup);
          if (!grp) {
            grp = { id: targetGroup, label: targetGroup, fieldIds: [] };
            groups.push(grp);
          }
          const fieldIds = (grp.fieldIds as string[]) ?? [];
          if (!fieldIds.includes(fieldId)) {
            if (position !== undefined && position !== null) {
              fieldIds.splice(position, 0, fieldId);
            } else {
              fieldIds.push(fieldId);
            }
          }
          grp.fieldIds = fieldIds;
          layoutObj.groups = groups;
          return { layout: JSON.stringify(layoutObj) };
        });
        return complete(b2, 'ok', { form });
      },
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  removeField(input: Record<string, unknown>) {
    const form    = input.form    as string;
    const fieldId = input.fieldId as string;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = mergeFrom(b, 'form', form, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let layoutObj: Record<string, unknown> = {};
          try {
            layoutObj = JSON.parse((existing.layout as string) || '{}') as Record<string, unknown>;
          } catch {
            layoutObj = {};
          }
          const groups = (layoutObj.groups as Array<Record<string, unknown>>) ?? [];
          for (const grp of groups) {
            const fieldIds = (grp.fieldIds as string[]) ?? [];
            grp.fieldIds = fieldIds.filter((id) => id !== fieldId);
          }
          layoutObj.groups = groups;
          return { layout: JSON.stringify(layoutObj) };
        });
        return complete(b2, 'ok', { form });
      },
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  reorderField(input: Record<string, unknown>) {
    const form     = input.form     as string;
    const fieldId  = input.fieldId  as string;
    const position = input.position as number;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = mergeFrom(b, 'form', form, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let layoutObj: Record<string, unknown> = {};
          try {
            layoutObj = JSON.parse((existing.layout as string) || '{}') as Record<string, unknown>;
          } catch {
            layoutObj = {};
          }
          const groups = (layoutObj.groups as Array<Record<string, unknown>>) ?? [];
          for (const grp of groups) {
            const fieldIds = (grp.fieldIds as string[]) ?? [];
            const idx = fieldIds.indexOf(fieldId);
            if (idx !== -1) {
              fieldIds.splice(idx, 1);
              const target = Math.max(0, Math.min(position, fieldIds.length));
              fieldIds.splice(target, 0, fieldId);
              grp.fieldIds = fieldIds;
            }
          }
          layoutObj.groups = groups;
          return { layout: JSON.stringify(layoutObj) };
        });
        return complete(b2, 'ok', { form });
      },
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  addCondition(input: Record<string, unknown>) {
    const form      = input.form      as string;
    const fieldId   = input.fieldId   as string;
    const condition = input.condition as string;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = mergeFrom(b, 'form', form, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let conds: Array<Record<string, unknown>> = [];
          try {
            conds = JSON.parse((existing.conditions as string) || '[]') as Array<Record<string, unknown>>;
          } catch {
            conds = [];
          }
          // Replace any existing condition for this fieldId
          const filtered = conds.filter((c) => c.fieldId !== fieldId);
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(condition) as Record<string, unknown>;
          } catch {
            parsed = { raw: condition };
          }
          filtered.push({ fieldId, ...parsed });
          return { conditions: JSON.stringify(filtered) };
        });
        return complete(b2, 'ok', { form });
      },
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  removeCondition(input: Record<string, unknown>) {
    const form    = input.form    as string;
    const fieldId = input.fieldId as string;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = mergeFrom(b, 'form', form, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let conds: Array<Record<string, unknown>> = [];
          try {
            conds = JSON.parse((existing.conditions as string) || '[]') as Array<Record<string, unknown>>;
          } catch {
            conds = [];
          }
          return { conditions: JSON.stringify(conds.filter((c) => c.fieldId !== fieldId)) };
        });
        return complete(b2, 'ok', { form });
      },
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  addStep(input: Record<string, unknown>) {
    const form     = input.form     as string;
    const title    = input.title    as string;
    const position = input.position as number | undefined;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = mergeFrom(b, 'form', form, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let steps: Array<Record<string, unknown>> = [];
          try {
            steps = JSON.parse((existing.steps as string) || '[]') as Array<Record<string, unknown>>;
          } catch {
            steps = [];
          }
          const step = { title, fieldIds: [] };
          if (position !== undefined && position !== null) {
            const target = Math.max(0, Math.min(position, steps.length));
            steps.splice(target, 0, step);
          } else {
            steps.push(step);
          }
          return { steps: JSON.stringify(steps) };
        });
        return complete(b2, 'ok', { form });
      },
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  removeStep(input: Record<string, unknown>) {
    const form      = input.form      as string;
    const stepIndex = input.stepIndex as number;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        const b2 = mergeFrom(b, 'form', form, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let steps: Array<Record<string, unknown>> = [];
          try {
            steps = JSON.parse((existing.steps as string) || '[]') as Array<Record<string, unknown>>;
          } catch {
            steps = [];
          }
          if (stepIndex >= 0 && stepIndex < steps.length) {
            steps.splice(stepIndex, 1);
          }
          return { steps: JSON.stringify(steps) };
        });
        return complete(b2, 'ok', { form });
      },
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const form = input.form as string;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            form:       existing.form       as string,
            schema:     existing.schema     as string,
            name:       existing.name       as string,
            mode:       existing.mode       as string,
            layout:     existing.layout     as string,
            steps:      existing.steps      as string,
            conditions: existing.conditions as string,
            defaults:   existing.defaults   as string,
            overrides:  existing.overrides  as string,
          };
        }),
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const schema = input.schema as string | undefined;

    let p = createProgram();
    const criteria = schema ? { schema } : {};
    p = find(p, 'form', criteria, 'allForms');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allForms as Array<Record<string, unknown>>) ?? [];
      const items = all.map((f) => ({
        form:   f.form,
        schema: f.schema,
        name:   f.name,
        mode:   f.mode,
      }));
      return { items: JSON.stringify(items) };
    }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const mode   = input.mode   as string;

    // Find all forms for the given schema, then select best match in-process
    let p = createProgram();
    p = find(p, 'form', { schema }, 'schemaForms');

    // Compute a match result binding so branch can inspect it
    p = mapBindings(p, (bindings) => {
      const all = (bindings.schemaForms as Array<Record<string, unknown>>) ?? [];
      const exact    = all.find((f) => f.mode === mode);
      const fallback = all.find((f) => f.mode === 'both');
      return exact ?? fallback ?? null;
    }, '_match');

    return branch(
      p,
      '_match',
      // found
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const match = bindings._match as Record<string, unknown>;
          return {
            form:       match.form       as string,
            layout:     match.layout     as string,
            steps:      match.steps      as string,
            conditions: match.conditions as string,
            defaults:   match.defaults   as string,
            overrides:  match.overrides  as string,
          };
        }),
      // not found
      (b) => complete(b, 'notfound', { schema, mode }),
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const form = input.form as string;

    let p = createProgram();
    p = get(p, 'form', form, 'existing');

    return branch(
      p,
      'existing',
      (b) => {
        // Delete primary record
        let b2 = del(b, 'form', form);
        // Delete uniqueness sentinel — key derived from the loaded record
        b2 = delFrom(b2, 'form-dup', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return dupKey(
            existing.schema as string,
            existing.name   as string,
            existing.mode   as string,
          );
        });
        return complete(b2, 'ok', { form });
      },
      (b) => complete(b, 'notfound', { form }),
    ) as StorageProgram<Result>;
  },

};

export const formSpecHandler = autoInterpret(_handler);
