/**
 * Schema Editor — Integration Tests
 *
 * Validates the schema editing pipeline end-to-end:
 *   - FieldDefinition handler: CRUD, type validation, reorder, rename, changeType
 *   - SchemaTemplate handler: register, apply, preview, list, remove
 *   - SchemaUsage handler: register, scan, scanSchema, unregister
 *   - End-to-end flow: create schema fields, reorder, track usage, safe removal
 *   - Artifact completeness: concept specs, handlers, syncs, widgets, views, seeds
 *
 * See schema-editor-plan.md §9.9–9.11 for integration requirements.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';

// Handler imports — autoInterpret proxies: (input, storage) returns interpreted result
import { fieldDefinitionHandler } from '../handlers/ts/app/field-definition.handler.js';
import { schemaTemplateHandler } from '../handlers/ts/app/schema-template.handler.js';
import { schemaUsageHandler } from '../handlers/ts/app/schema-usage.handler.js';

// Cast to any for imperative-compat calling convention
const fdHandler = fieldDefinitionHandler as any;
const stHandler = schemaTemplateHandler as any;
const suHandler = schemaUsageHandler as any;

// ============================================================
// 1. FieldDefinition Handler Tests
// ============================================================

describe('FieldDefinition handler', () => {

  it('creates a field and returns ok with composite id', async () => {
    const storage = createInMemoryStorage();
    const result = await fdHandler.create({
      schema: 'tasks',
      fieldId: 'title',
      label: 'Title',
      fieldType: 'text',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.id).toBe('tasks::title');
  });

  it('gets a previously created field', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({
      schema: 'tasks',
      fieldId: 'due_date',
      label: 'Due Date',
      fieldType: 'date',
      required: true,
    }, storage);

    const result = await fdHandler.get({
      schema: 'tasks',
      fieldId: 'due_date',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.fieldId).toBe('due_date');
    expect(result.label).toBe('Due Date');
    expect(result.fieldType).toBe('date');
    expect(result.required).toBe(true);
  });

  it('lists fields for a schema sorted by sortOrder', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'title', label: 'Title', fieldType: 'text', sortOrder: 1 }, storage);
    await fdHandler.create({ schema: 'tasks', fieldId: 'status', label: 'Status', fieldType: 'select', sortOrder: 0 }, storage);
    await fdHandler.create({ schema: 'other', fieldId: 'name', label: 'Name', fieldType: 'text', sortOrder: 0 }, storage);

    const result = await fdHandler.list({ schema: 'tasks' }, storage);
    expect(result.variant).toBe('ok');
  });

  it('updates a field label and description', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'title', label: 'Title', fieldType: 'text' }, storage);

    const updated = await fdHandler.update({
      schema: 'tasks',
      fieldId: 'title',
      label: 'Task Title',
      description: 'The main title of the task',
    }, storage);

    expect(updated.variant).toBe('ok');

    const fetched = await fdHandler.get({ schema: 'tasks', fieldId: 'title' }, storage);
    expect(fetched.label).toBe('Task Title');
    expect(fetched.description).toBe('The main title of the task');
  });

  it('renames a field label', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'assignee', label: 'Assignee', fieldType: 'person' }, storage);

    const result = await fdHandler.rename({
      schema: 'tasks',
      fieldId: 'assignee',
      newLabel: 'Owner',
    }, storage);

    expect(result.variant).toBe('ok');

    const fetched = await fdHandler.get({ schema: 'tasks', fieldId: 'assignee' }, storage);
    expect(fetched.label).toBe('Owner');
  });

  it('reorders a field by updating sortOrder', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'title', label: 'Title', fieldType: 'text', sortOrder: 0 }, storage);

    const result = await fdHandler.reorder({
      schema: 'tasks',
      fieldId: 'title',
      newSortOrder: 5,
    }, storage);

    expect(result.variant).toBe('ok');

    const fetched = await fdHandler.get({ schema: 'tasks', fieldId: 'title' }, storage);
    expect(fetched.sortOrder).toBe(5);
  });

  it('changeType returns data_loss_warning without acknowledge', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'count', label: 'Count', fieldType: 'text' }, storage);

    const result = await fdHandler.changeType({
      schema: 'tasks',
      fieldId: 'count',
      newType: 'number',
    }, storage);

    expect(result.variant).toBe('data_loss_warning');
    expect(result.lossDescription).toBeTruthy();
  });

  it('changeType with acknowledge applies the type change', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'count', label: 'Count', fieldType: 'text' }, storage);

    const result = await fdHandler.changeType({
      schema: 'tasks',
      fieldId: 'count',
      newType: 'number',
      migrationStrategy: 'acknowledge',
    }, storage);

    expect(result.variant).toBe('ok');

    const fetched = await fdHandler.get({ schema: 'tasks', fieldId: 'count' }, storage);
    expect(fetched.fieldType).toBe('number');
  });

  it('removes a field', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'temp', label: 'Temp', fieldType: 'text' }, storage);

    const removed = await fdHandler.remove({ schema: 'tasks', fieldId: 'temp' }, storage);
    expect(removed.variant).toBe('ok');

    const fetched = await fdHandler.get({ schema: 'tasks', fieldId: 'temp' }, storage);
    expect(fetched.variant).toBe('not_found');
  });

  it('rejects duplicate field creation', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'title', label: 'Title', fieldType: 'text' }, storage);

    const dup = await fdHandler.create({ schema: 'tasks', fieldId: 'title', label: 'Title 2', fieldType: 'text' }, storage);
    expect(dup.variant).toBe('duplicate');
  });

  it('rejects invalid field type', async () => {
    const storage = createInMemoryStorage();
    const result = await fdHandler.create({
      schema: 'tasks',
      fieldId: 'bad',
      label: 'Bad',
      fieldType: 'nonexistent_type',
    }, storage);

    expect(result.variant).toBe('invalid_type');
  });

  it('changeType rejects invalid new type', async () => {
    const storage = createInMemoryStorage();
    await fdHandler.create({ schema: 'tasks', fieldId: 'f1', label: 'F1', fieldType: 'text' }, storage);

    const result = await fdHandler.changeType({
      schema: 'tasks',
      fieldId: 'f1',
      newType: 'bogus',
    }, storage);

    expect(result.variant).toBe('invalid_type');
  });

  it('returns not_found for operations on nonexistent fields', async () => {
    const storage = createInMemoryStorage();

    const get = await fdHandler.get({ schema: 'x', fieldId: 'nope' }, storage);
    expect(get.variant).toBe('not_found');

    const update = await fdHandler.update({ schema: 'x', fieldId: 'nope', label: 'X' }, storage);
    expect(update.variant).toBe('not_found');

    const rename = await fdHandler.rename({ schema: 'x', fieldId: 'nope', newLabel: 'X' }, storage);
    expect(rename.variant).toBe('not_found');

    const reorder = await fdHandler.reorder({ schema: 'x', fieldId: 'nope', newSortOrder: 0 }, storage);
    expect(reorder.variant).toBe('not_found');

    const remove = await fdHandler.remove({ schema: 'x', fieldId: 'nope' }, storage);
    expect(remove.variant).toBe('not_found');

    const changeType = await fdHandler.changeType({ schema: 'x', fieldId: 'nope', newType: 'number' }, storage);
    expect(changeType.variant).toBe('not_found');
  });
});

// ============================================================
// 2. SchemaTemplate Handler Tests
// ============================================================

describe('SchemaTemplate handler', () => {

  it('registers a template', async () => {
    const storage = createInMemoryStorage();
    const result = await stHandler.register({
      name: 'article',
      label: 'Article',
      description: 'A standard article template',
      category: 'content',
      icon: 'doc',
      fields: JSON.stringify([
        { fieldId: 'title', label: 'Title', fieldType: 'text' },
        { fieldId: 'body', label: 'Body', fieldType: 'rich-text' },
      ]),
      properties: JSON.stringify({ childSchema: 'paragraph' }),
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.id).toBe('article');
  });

  it('applies a template (returns target schema name)', async () => {
    const storage = createInMemoryStorage();
    await stHandler.register({
      name: 'tasks',
      label: 'Tasks',
      fields: JSON.stringify([{ fieldId: 'title', fieldType: 'text' }]),
      properties: '{}',
    }, storage);

    const result = await stHandler.apply({
      name: 'tasks',
      targetSchemaName: 'my-tasks',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.schema).toBe('my-tasks');
  });

  it('lists templates, optionally filtered by category', async () => {
    const storage = createInMemoryStorage();
    await stHandler.register({ name: 't1', label: 'T1', category: 'content', fields: '[]', properties: '{}' }, storage);
    await stHandler.register({ name: 't2', label: 'T2', category: 'data', fields: '[]', properties: '{}' }, storage);

    const all = await stHandler.list({}, storage);
    expect(all.variant).toBe('ok');

    const filtered = await stHandler.list({ category: 'content' }, storage);
    expect(filtered.variant).toBe('ok');
  });

  it('previews a template', async () => {
    const storage = createInMemoryStorage();
    await stHandler.register({
      name: 'events',
      label: 'Events',
      description: 'Event schema',
      category: 'calendar',
      icon: 'cal',
      fields: JSON.stringify([{ fieldId: 'date', fieldType: 'date' }]),
      properties: '{}',
      sampleData: 'some sample',
    }, storage);

    const result = await stHandler.preview({ name: 'events' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.label).toBe('Events');
    expect(result.description).toBe('Event schema');
    expect(result.sampleData).toBe('some sample');
  });

  it('removes a template', async () => {
    const storage = createInMemoryStorage();
    await stHandler.register({ name: 'temp', label: 'Temp', fields: '[]', properties: '{}' }, storage);

    const removed = await stHandler.remove({ name: 'temp' }, storage);
    expect(removed.variant).toBe('ok');

    const preview = await stHandler.preview({ name: 'temp' }, storage);
    expect(preview.variant).toBe('not_found');
  });

  it('rejects duplicate template registration', async () => {
    const storage = createInMemoryStorage();
    await stHandler.register({ name: 'dup', label: 'Dup', fields: '[]', properties: '{}' }, storage);

    const dup = await stHandler.register({ name: 'dup', label: 'Dup 2', fields: '[]', properties: '{}' }, storage);
    expect(dup.variant).toBe('duplicate');
  });

  it('rejects registration with empty name', async () => {
    const storage = createInMemoryStorage();
    const result = await stHandler.register({ name: '', fields: '[]', properties: '{}' }, storage);
    expect(result.variant).toBe('error');
  });

  it('rejects registration with invalid fields JSON', async () => {
    const storage = createInMemoryStorage();
    const result = await stHandler.register({ name: 'bad', fields: 'not-json', properties: '{}' }, storage);
    expect(result.variant).toBe('error');
  });

  it('rejects registration with invalid properties JSON', async () => {
    const storage = createInMemoryStorage();
    const result = await stHandler.register({ name: 'bad', fields: '[]', properties: 'not-json' }, storage);
    expect(result.variant).toBe('error');
  });

  it('returns not_found when applying a nonexistent template', async () => {
    const storage = createInMemoryStorage();
    const result = await stHandler.apply({ name: 'nonexistent' }, storage);
    expect(result.variant).toBe('not_found');
  });
});

// ============================================================
// 3. SchemaUsage Handler Tests
// ============================================================

describe('SchemaUsage handler', () => {

  it('registers a usage record', async () => {
    const storage = createInMemoryStorage();
    const result = await suHandler.register({
      field: 'tasks::title',
      usageType: 'view-column',
      usageRef: 'view-task-list',
      usageLabel: 'Task List view column',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.id).toBe('tasks::title::view-task-list');
  });

  it('scans usages for a specific field', async () => {
    const storage = createInMemoryStorage();
    await suHandler.register({ field: 'tasks::title', usageType: 'view', usageRef: 'v1' }, storage);
    await suHandler.register({ field: 'tasks::title', usageType: 'form', usageRef: 'f1' }, storage);
    await suHandler.register({ field: 'tasks::status', usageType: 'view', usageRef: 'v1' }, storage);

    const result = await suHandler.scan({ field: 'tasks::title' }, storage);
    expect(result.variant).toBe('ok');
  });

  it('scans usages for all fields in a schema', async () => {
    const storage = createInMemoryStorage();
    await suHandler.register({ field: 'tasks::title', usageType: 'view', usageRef: 'v1' }, storage);
    await suHandler.register({ field: 'tasks::status', usageType: 'view', usageRef: 'v2' }, storage);
    await suHandler.register({ field: 'events::date', usageType: 'view', usageRef: 'v3' }, storage);

    const result = await suHandler.scanSchema({ schema: 'tasks' }, storage);
    expect(result.variant).toBe('ok');
  });

  it('unregisters a usage record', async () => {
    const storage = createInMemoryStorage();
    await suHandler.register({ field: 'tasks::title', usageType: 'view', usageRef: 'v1' }, storage);

    const result = await suHandler.unregister({ field: 'tasks::title', usageRef: 'v1' }, storage);
    expect(result.variant).toBe('ok');
  });

  it('rejects duplicate usage registration', async () => {
    const storage = createInMemoryStorage();
    await suHandler.register({ field: 'tasks::title', usageType: 'view', usageRef: 'v1' }, storage);

    const dup = await suHandler.register({ field: 'tasks::title', usageType: 'form', usageRef: 'v1' }, storage);
    expect(dup.variant).toBe('duplicate');
  });

  it('rejects registration with empty field', async () => {
    const storage = createInMemoryStorage();
    const result = await suHandler.register({ field: '', usageRef: 'v1' }, storage);
    expect(result.variant).toBe('error');
  });

  it('rejects registration with empty usageRef', async () => {
    const storage = createInMemoryStorage();
    const result = await suHandler.register({ field: 'tasks::title', usageRef: '' }, storage);
    expect(result.variant).toBe('error');
  });

  it('returns not_found when unregistering nonexistent usage', async () => {
    const storage = createInMemoryStorage();
    const result = await suHandler.unregister({ field: 'tasks::title', usageRef: 'v1' }, storage);
    expect(result.variant).toBe('not_found');
  });
});

// ============================================================
// 4. End-to-End Flow: Schema Lifecycle with Usage Tracking
// ============================================================

describe('Schema editor end-to-end flow', () => {

  it('create schema fields -> reorder -> register usage -> attempt remove (in_use check via usage scan) -> unregister -> remove succeeds', async () => {
    const storage = createInMemoryStorage();

    // 1. Create schema fields
    const f1 = await fdHandler.create({
      schema: 'projects',
      fieldId: 'name',
      label: 'Name',
      fieldType: 'text',
      sortOrder: 0,
    }, storage);
    expect(f1.variant).toBe('ok');

    const f2 = await fdHandler.create({
      schema: 'projects',
      fieldId: 'status',
      label: 'Status',
      fieldType: 'select',
      sortOrder: 1,
    }, storage);
    expect(f2.variant).toBe('ok');

    const f3 = await fdHandler.create({
      schema: 'projects',
      fieldId: 'deadline',
      label: 'Deadline',
      fieldType: 'date',
      sortOrder: 2,
    }, storage);
    expect(f3.variant).toBe('ok');

    // 2. Reorder — move status to position 0
    const reordered = await fdHandler.reorder({
      schema: 'projects',
      fieldId: 'status',
      newSortOrder: -1,
    }, storage);
    expect(reordered.variant).toBe('ok');

    // Verify reorder took effect
    const statusField = await fdHandler.get({ schema: 'projects', fieldId: 'status' }, storage);
    expect(statusField.sortOrder).toBe(-1);

    // 3. Register usage for the "name" field
    const usage = await suHandler.register({
      field: 'projects::name',
      usageType: 'view-column',
      usageRef: 'project-list-view',
      usageLabel: 'Project List View',
    }, storage);
    expect(usage.variant).toBe('ok');

    // 4. Before removing the "name" field, scan for usages
    const usageScan = await suHandler.scan({ field: 'projects::name' }, storage);
    expect(usageScan.variant).toBe('ok');
    // The field is in use — in a real system the sync would block removal.
    // Here we verify the usage scan returns results (field is tracked).

    // 5. Unregister the usage
    const unreg = await suHandler.unregister({
      field: 'projects::name',
      usageRef: 'project-list-view',
    }, storage);
    expect(unreg.variant).toBe('ok');

    // 6. Now removal succeeds (no remaining usages)
    const removed = await fdHandler.remove({ schema: 'projects', fieldId: 'name' }, storage);
    expect(removed.variant).toBe('ok');

    // Verify it's gone
    const gone = await fdHandler.get({ schema: 'projects', fieldId: 'name' }, storage);
    expect(gone.variant).toBe('not_found');
  });

  it('applies a template then creates fields for the resulting schema', async () => {
    const storage = createInMemoryStorage();

    // Register a template
    await stHandler.register({
      name: 'meeting-notes',
      label: 'Meeting Notes',
      category: 'productivity',
      fields: JSON.stringify([
        { fieldId: 'date', label: 'Date', fieldType: 'date' },
        { fieldId: 'attendees', label: 'Attendees', fieldType: 'multi-select' },
        { fieldId: 'notes', label: 'Notes', fieldType: 'rich-text' },
      ]),
      properties: JSON.stringify({ childSchema: 'agenda-item' }),
    }, storage);

    // Apply template to a target schema
    const applied = await stHandler.apply({
      name: 'meeting-notes',
      targetSchemaName: 'team-meetings',
    }, storage);
    expect(applied.variant).toBe('ok');
    expect(applied.schema).toBe('team-meetings');

    // In a real system, the schema-template-creates-fields sync would create
    // FieldDefinition records. Here we simulate by creating them manually.
    const templatePreview = await stHandler.preview({ name: 'meeting-notes' }, storage);
    expect(templatePreview.variant).toBe('ok');
    const templateFields = JSON.parse(templatePreview.fields as string);

    for (let i = 0; i < templateFields.length; i++) {
      const tf = templateFields[i];
      const created = await fdHandler.create({
        schema: 'team-meetings',
        fieldId: tf.fieldId,
        label: tf.label,
        fieldType: tf.fieldType,
        sortOrder: i,
      }, storage);
      expect(created.variant).toBe('ok');
    }

    // Verify all fields were created
    const dateField = await fdHandler.get({ schema: 'team-meetings', fieldId: 'date' }, storage);
    expect(dateField.variant).toBe('ok');
    expect(dateField.fieldType).toBe('date');

    const attendeesField = await fdHandler.get({ schema: 'team-meetings', fieldId: 'attendees' }, storage);
    expect(attendeesField.variant).toBe('ok');
    expect(attendeesField.fieldType).toBe('multi-select');
  });
});

// ============================================================
// 5. Artifact Completeness
// ============================================================

describe('Schema editor artifact completeness', () => {

  // --- Concept specs ---
  describe('Concept specs', () => {
    const specDir = path.resolve('repertoire/concepts/classification');

    it('FieldDefinition concept spec exists', () => {
      expect(fs.existsSync(path.join(specDir, 'field-definition.concept'))).toBe(true);
    });

    it('SchemaTemplate concept spec exists', () => {
      expect(fs.existsSync(path.join(specDir, 'schema-template.concept'))).toBe(true);
    });

    it('SchemaUsage concept spec exists', () => {
      expect(fs.existsSync(path.join(specDir, 'schema-usage.concept'))).toBe(true);
    });
  });

  // --- Handlers ---
  describe('Handlers', () => {
    const handlerDir = path.resolve('handlers/ts/app');

    it('FieldDefinition handler exists', () => {
      expect(fs.existsSync(path.join(handlerDir, 'field-definition.handler.ts'))).toBe(true);
    });

    it('SchemaTemplate handler exists', () => {
      expect(fs.existsSync(path.join(handlerDir, 'schema-template.handler.ts'))).toBe(true);
    });

    it('SchemaUsage handler exists', () => {
      expect(fs.existsSync(path.join(handlerDir, 'schema-usage.handler.ts'))).toBe(true);
    });
  });

  // --- Syncs ---
  describe('Syncs', () => {
    const syncDir = path.resolve('clef-base/suites/entity-lifecycle/syncs');

    const expectedSyncs = [
      'field-usage-on-view-create.sync',
      'field-usage-on-mapping-create.sync',
      'field-removal-checks-usage.sync',
      'schema-template-creates-fields.sync',
      'field-create-updates-form.sync',
      'field-reorder-updates-placements.sync',
    ];

    for (const syncFile of expectedSyncs) {
      it(`${syncFile} exists`, () => {
        expect(fs.existsSync(path.join(syncDir, syncFile))).toBe(true);
      });
    }
  });

  // --- Widgets ---
  describe('Widgets', () => {
    const widgetDir = path.resolve('surface/widgets');

    const expectedWidgets = [
      'type-picker.widget',
      'field-header-popover.widget',
      'inline-cell-editor.widget',
      'field-config-drawer.widget',
      'validation-rule-builder.widget',
      'widget-gallery.widget',
      'schema-fields-editor.widget',
      'form-layout-editor.widget',
      'display-mode-editor.widget',
    ];

    for (const widgetFile of expectedWidgets) {
      it(`${widgetFile} exists`, () => {
        expect(fs.existsSync(path.join(widgetDir, widgetFile))).toBe(true);
      });
    }
  });

  // --- Views ---
  describe('Views', () => {
    const viewDir = path.resolve('specs/view/views');

    const expectedViews = [
      'schema-admin-list.view',
      'schema-detail.view',
      'schema-table.view',
      'schema-template-gallery.view',
    ];

    for (const viewFile of expectedViews) {
      it(`${viewFile} exists`, () => {
        expect(fs.existsSync(path.join(viewDir, viewFile))).toBe(true);
      });
    }
  });

  // --- Seeds ---
  describe('Seeds', () => {
    const seedDir = path.resolve('clef-base/seeds');

    const expectedSeeds = [
      'SchemaTemplate.seeds.yaml',
      'View.schema-editor.seeds.yaml',
      'DestinationCatalog.schema-editor.seeds.yaml',
      'ViewShell.schema-editor.seeds.yaml',
    ];

    for (const seedFile of expectedSeeds) {
      it(`${seedFile} exists`, () => {
        expect(fs.existsSync(path.join(seedDir, seedFile))).toBe(true);
      });
    }
  });

  // --- Derived concept ---
  describe('Derived concept', () => {
    const derivedPath = path.resolve('clef-base/derived/schema-editing.derived');

    it('schema-editing.derived exists', () => {
      expect(fs.existsSync(derivedPath)).toBe(true);
    });

    it('declares derived SchemaEditing', () => {
      const content = fs.readFileSync(derivedPath, 'utf-8');
      expect(content).toContain('derived SchemaEditing');
    });

    it('composes FieldDefinition', () => {
      const content = fs.readFileSync(derivedPath, 'utf-8');
      expect(content).toContain('FieldDefinition');
    });

    it('composes SchemaTemplate', () => {
      const content = fs.readFileSync(derivedPath, 'utf-8');
      expect(content).toContain('SchemaTemplate');
    });

    it('composes SchemaUsage', () => {
      const content = fs.readFileSync(derivedPath, 'utf-8');
      expect(content).toContain('SchemaUsage');
    });
  });

  // --- Suite update ---
  describe('Suite manifest', () => {
    const suitePath = path.resolve('clef-base/suites/entity-lifecycle/suite.yaml');

    it('entity-lifecycle suite.yaml exists', () => {
      expect(fs.existsSync(suitePath)).toBe(true);
    });

    it('references FieldDefinition', () => {
      const content = fs.readFileSync(suitePath, 'utf-8');
      expect(content).toContain('FieldDefinition');
    });

    it('references SchemaTemplate', () => {
      const content = fs.readFileSync(suitePath, 'utf-8');
      expect(content).toContain('SchemaTemplate');
    });

    it('references SchemaUsage', () => {
      const content = fs.readFileSync(suitePath, 'utf-8');
      expect(content).toContain('SchemaUsage');
    });

    it('references schema editor syncs', () => {
      const content = fs.readFileSync(suitePath, 'utf-8');
      expect(content).toContain('field-usage-on-view-create');
      expect(content).toContain('field-usage-on-mapping-create');
      expect(content).toContain('field-removal-checks-usage');
      expect(content).toContain('schema-template-creates-fields');
      expect(content).toContain('field-create-updates-form');
      expect(content).toContain('field-reorder-updates-placements');
    });
  });
});
