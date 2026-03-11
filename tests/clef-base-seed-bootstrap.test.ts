import { describe, expect, it } from 'vitest';
import { ensureSeeded, getKernel } from '../clef-base/lib/kernel.js';

describe('clef-base seed bootstrap', () => {
  it('loads declarative seed files through SeedData and syncs destinations into Navigator', async () => {
    await ensureSeeded();
    const kernel = getKernel();

    const seeds = await kernel.queryConcept('urn:clef/SeedData', 'seed-data');
    expect(seeds.length).toBeGreaterThan(0);
    expect(seeds.every((seed) => seed.applied === true)).toBe(true);

    const destinations = await kernel.queryConcept('urn:clef/DestinationCatalog', 'destination');
    expect(destinations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dashboard', href: '/admin' }),
        expect.objectContaining({ id: 'themes', href: '/admin/themes' }),
      ]),
    );

    const navigators = await kernel.queryConcept('urn:clef/Navigator', 'navigator');
    const shellNavigator = navigators.find((record) =>
      String(record.destinations ?? '').includes('"name":"dashboard"'),
    );
    expect(shellNavigator).toBeTruthy();

    const registered = JSON.parse(String(shellNavigator?.destinations ?? '[]')) as Array<Record<string, unknown>>;
    expect(registered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dashboard', targetConcept: 'AppShell' }),
        expect.objectContaining({ name: 'access', targetConcept: 'Authorization' }),
      ]),
    );

    const views = await kernel.queryConcept('urn:clef/View', 'view');
    expect(views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ view: 'content-list', title: 'Content' }),
        expect.objectContaining({ view: 'installed-suites', title: 'Installed Suites' }),
      ]),
    );

    const layouts = await kernel.queryConcept('urn:clef/Layout', 'layout');
    expect(layouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ layout: 'dashboard', title: 'Dashboard' }),
        expect.objectContaining({ layout: 'concept-browser', title: 'Concept Browser' }),
      ]),
    );

    const workflows = await kernel.queryConcept('urn:clef/Workflow', 'workflow');
    expect(workflows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workflow: 'content-lifecycle' }),
        expect.objectContaining({ workflow: 'schema-evolution' }),
      ]),
    );

    const automationRules = await kernel.queryConcept('urn:clef/AutomationRule', 'automationRule');
    expect(automationRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'auto-tag-on-create' }),
        expect.objectContaining({ rule: 'notify-on-publish' }),
      ]),
    );

    const grants = await kernel.queryConcept('urn:clef/ResourceGrantPolicy', 'grant');
    expect(grants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'schema:*:view' }),
        expect.objectContaining({ id: 'node:*:edit' }),
      ]),
    );

    const accessCatalogEntries = await kernel.queryConcept('urn:clef/AccessCatalog', 'entry');
    expect(accessCatalogEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'permission:admin.access', kind: 'permission' }),
        expect.objectContaining({ id: 'role:admin', kind: 'role' }),
        expect.objectContaining({ id: 'resource-action:schema:view', kind: 'resource-action' }),
      ]),
    );

    const runtimeProfiles = await kernel.queryConcept('urn:clef/RuntimeProfile', 'profile');
    expect(runtimeProfiles).toEqual([
      expect.objectContaining({ id: 'runtime-profile:clef-base-admin', platform: 'browser' }),
    ]);

    const platformBindings = await kernel.queryConcept('urn:clef/PlatformBindingCatalog', 'binding');
    expect(platformBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'binding:browser:navigation:*', platform: 'browser' }),
        expect.objectContaining({ id: 'binding:desktop:navigation:*', platform: 'desktop' }),
      ]),
    );

    const installations = await kernel.queryConcept('urn:clef/AppInstallation', 'installation');
    expect(installations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'installation:ui-app', status: 'installed' }),
        expect.objectContaining({ id: 'installation:infrastructure', status: 'installed' }),
      ]),
    );

    const interactors = await kernel.queryConcept('urn:clef/Interactor', 'interactor');
    expect(interactors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ interactor: 'records-collection', category: 'output' }),
        expect.objectContaining({ interactor: 'record-detail', category: 'entity' }),
      ]),
    );

    const affordances = await kernel.queryConcept('urn:clef/Affordance', 'affordance');
    expect(affordances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ affordance: 'admin-records-collection-table', widget: 'admin-table-display' }),
        expect.objectContaining({ affordance: 'admin-records-collection-card-grid', widget: 'admin-card-grid-display' }),
      ]),
    );

    const resolvers = await kernel.queryConcept('urn:clef/WidgetResolver', 'resolver');
    expect(resolvers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resolver: 'clef-base-view-resolver' }),
      ]),
    );
  });
});
