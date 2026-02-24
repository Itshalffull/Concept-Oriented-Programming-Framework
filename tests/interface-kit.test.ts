// ============================================================
// Interface Kit Tests
//
// Validates all concept specs, sync definitions, and kit.yaml
// for the interface generation kit parse correctly.
// See Architecture doc: Textual Interface Layer Extension.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl';
import { parseSyncFile } from '../implementations/typescript/framework/sync-parser.impl';

const INTERFACE_DIR = resolve(__dirname, '../kits/interface');
const CONCEPTS_DIR = resolve(INTERFACE_DIR, 'concepts');
const PROVIDERS_DIR = resolve(CONCEPTS_DIR, 'providers');

function readConcept(name: string): ReturnType<typeof parseConceptFile> {
  const source = readFileSync(resolve(CONCEPTS_DIR, name), 'utf-8');
  return parseConceptFile(source);
}

function readProvider(name: string): ReturnType<typeof parseConceptFile> {
  const source = readFileSync(resolve(PROVIDERS_DIR, name), 'utf-8');
  return parseConceptFile(source);
}

function readSync(name: string) {
  const source = readFileSync(resolve(INTERFACE_DIR, 'syncs', name), 'utf-8');
  return parseSyncFile(source);
}

function readRoutingSync(name: string) {
  const source = readFileSync(resolve(INTERFACE_DIR, 'syncs', 'routing', name), 'utf-8');
  return parseSyncFile(source);
}

// ============================================================
// Orchestration Concepts
// ============================================================

describe('Orchestration Concepts', () => {

  it('parses Projection', () => {
    const ast = readConcept('projection.concept');
    expect(ast.name).toBe('Projection');
    expect(ast.typeParams).toEqual(['P']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions.map(a => a.name)).toEqual(['project', 'validate', 'diff', 'inferResources']);
    // project has 4 variants: ok, annotationError, unresolvedReference, traitConflict
    expect(ast.actions[0].variants).toHaveLength(4);
    // validate has 3 variants: ok, breakingChange, incompleteAnnotation
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
    expect(ast.state.length).toBeGreaterThan(0);
  });

  it('parses Generator', () => {
    const ast = readConcept('generator.concept');
    expect(ast.name).toBe('Generator');
    expect(ast.typeParams).toEqual(['G']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions.map(a => a.name)).toEqual(['plan', 'generate', 'status', 'regenerate']);
    // plan has 4 variants: ok, noTargetsConfigured, missingProvider, projectionFailed
    expect(ast.actions[0].variants).toHaveLength(4);
    // generate has 3 variants: ok, partial, blocked
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Emitter', () => {
    const ast = readConcept('emitter.concept');
    expect(ast.name).toBe('Emitter');
    expect(ast.typeParams).toEqual(['E']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(4);
    expect(ast.actions.map(a => a.name)).toEqual(['write', 'format', 'clean', 'manifest']);
    // write has 2 variants: ok, directoryError
    expect(ast.actions[0].variants).toHaveLength(2);
    // format has 3 variants: ok, formatterUnavailable, formatError
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Surface', () => {
    const ast = readConcept('surface.concept');
    expect(ast.name).toBe('Surface');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['compose', 'entrypoint']);
    // compose has 3 variants: ok, conflictingRoutes, cyclicDependency
    expect(ast.actions[0].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Middleware', () => {
    const ast = readConcept('middleware.concept');
    expect(ast.name).toBe('Middleware');
    expect(ast.typeParams).toEqual(['M']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions.map(a => a.name)).toEqual(['resolve', 'inject', 'register']);
    // resolve has 3 variants: ok, missingImplementation, incompatibleTraits
    expect(ast.actions[0].variants).toHaveLength(3);
    // register has 2 variants: ok, duplicateRegistration
    expect(ast.actions[2].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Grouping', () => {
    const ast = readConcept('grouping.concept');
    expect(ast.name).toBe('Grouping');
    expect(ast.typeParams).toEqual(['G']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['group', 'classify']);
    // group has 3 variants: ok, invalidStrategy, emptyInput
    expect(ast.actions[0].variants).toHaveLength(3);
    // classify has 1 variant: ok
    expect(ast.actions[1].variants).toHaveLength(1);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Workflow', () => {
    const ast = readConcept('workflow.concept');
    expect(ast.name).toBe('Workflow');
    expect(ast.typeParams).toEqual(['W']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['define', 'render']);
    // define has 3 variants: ok, invalidAction, emptySteps
    expect(ast.actions[0].variants).toHaveLength(3);
    // render has 2 variants: ok, unknownFormat
    expect(ast.actions[1].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
    // Both actions have description blocks
    expect(ast.actions[0].description).toContain('ordered');
    expect(ast.actions[1].description).toContain('Render');
  });

  it('parses Annotation', () => {
    const ast = readConcept('annotation.concept');
    expect(ast.name).toBe('Annotation');
    expect(ast.typeParams).toEqual(['N']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['annotate', 'resolve']);
    // annotate has 2 variants: ok, invalidScope
    expect(ast.actions[0].variants).toHaveLength(2);
    // resolve has 2 variants: ok, notFound
    expect(ast.actions[1].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
    // Both actions have description blocks
    expect(ast.actions[0].description).toContain('metadata');
    expect(ast.actions[1].description).toContain('annotations');
  });
});

// ============================================================
// Coordination Concepts
// ============================================================

describe('Coordination Concepts', () => {

  it('parses Target', () => {
    const ast = readConcept('target.concept');
    expect(ast.name).toBe('Target');
    expect(ast.typeParams).toEqual(['T']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['generate', 'diff']);
    // generate has 3 variants: ok, unsupportedAction, targetError
    expect(ast.actions[0].variants).toHaveLength(3);
    // diff has 2 variants: ok, noPrevious
    expect(ast.actions[1].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Sdk', () => {
    const ast = readConcept('sdk.concept');
    expect(ast.name).toBe('Sdk');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['generate', 'publish']);
    // generate has 3 variants: ok, unsupportedType, languageError
    expect(ast.actions[0].variants).toHaveLength(3);
    // publish has 3 variants: ok, versionExists, registryUnavailable
    expect(ast.actions[1].variants).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses Spec', () => {
    const ast = readConcept('spec.concept');
    expect(ast.name).toBe('Spec');
    expect(ast.typeParams).toEqual(['D']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toEqual(['emit', 'validate']);
    // emit has 2 variants: ok, formatError
    expect(ast.actions[0].variants).toHaveLength(2);
    // validate has 2 variants: ok, invalid
    expect(ast.actions[1].variants).toHaveLength(2);
    expect(ast.invariants).toHaveLength(1);
  });
});

// ============================================================
// Target Provider Concepts
// ============================================================

describe('Target Provider Concepts', () => {

  it('parses RestTarget', () => {
    const ast = readProvider('rest-target.concept');
    expect(ast.name).toBe('RestTarget');
    expect(ast.typeParams).toEqual(['R']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.actions[0].variants.length).toBeGreaterThanOrEqual(1);
    expect(ast.invariants).toHaveLength(1);
    expect(ast.state.length).toBeGreaterThan(0);
  });

  it('parses GraphqlTarget', () => {
    const ast = readProvider('graphql-target.concept');
    expect(ast.name).toBe('GraphqlTarget');
    expect(ast.typeParams).toEqual(['Q']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses GrpcTarget', () => {
    const ast = readProvider('grpc-target.concept');
    expect(ast.name).toBe('GrpcTarget');
    expect(ast.typeParams).toEqual(['G']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses CliTarget', () => {
    const ast = readProvider('cli-target.concept');
    expect(ast.name).toBe('CliTarget');
    expect(ast.typeParams).toEqual(['C']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses McpTarget', () => {
    const ast = readProvider('mcp-target.concept');
    expect(ast.name).toBe('McpTarget');
    expect(ast.typeParams).toEqual(['M']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.invariants).toHaveLength(1);
  });
});

// ============================================================
// Spec Provider Concepts
// ============================================================

describe('Spec Provider Concepts', () => {

  it('parses OpenApiTarget', () => {
    const ast = readProvider('openapi-target.concept');
    expect(ast.name).toBe('OpenApiTarget');
    expect(ast.typeParams).toEqual(['O']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses AsyncApiTarget', () => {
    const ast = readProvider('asyncapi-target.concept');
    expect(ast.name).toBe('AsyncApiTarget');
    expect(ast.typeParams).toEqual(['A']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.invariants).toHaveLength(1);
  });
});

// ============================================================
// SDK Provider Concepts
// ============================================================

describe('SDK Provider Concepts', () => {

  it('parses TsSdkTarget', () => {
    const ast = readProvider('ts-sdk-target.concept');
    expect(ast.name).toBe('TsSdkTarget');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses PySdkTarget', () => {
    const ast = readProvider('py-sdk-target.concept');
    expect(ast.name).toBe('PySdkTarget');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(1);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses GoSdkTarget', () => {
    const ast = readProvider('go-sdk-target.concept');
    expect(ast.name).toBe('GoSdkTarget');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(1);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses RustSdkTarget', () => {
    const ast = readProvider('rust-sdk-target.concept');
    expect(ast.name).toBe('RustSdkTarget');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(1);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses JavaSdkTarget', () => {
    const ast = readProvider('java-sdk-target.concept');
    expect(ast.name).toBe('JavaSdkTarget');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(1);
    expect(ast.invariants).toHaveLength(1);
  });

  it('parses SwiftSdkTarget', () => {
    const ast = readProvider('swift-sdk-target.concept');
    expect(ast.name).toBe('SwiftSdkTarget');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.version).toBe(1);
    expect(ast.actions).toHaveLength(1);
    expect(ast.invariants).toHaveLength(1);
  });
});

// ============================================================
// Bulk Concept Validation
// ============================================================

describe('Bulk Concept Validation', () => {

  const allConcepts = [
    'projection.concept', 'generator.concept', 'emitter.concept',
    'surface.concept', 'middleware.concept', 'grouping.concept',
    'workflow.concept', 'annotation.concept',
    'target.concept', 'sdk.concept', 'spec.concept',
  ];

  const allProviders = [
    'rest-target.concept', 'graphql-target.concept', 'grpc-target.concept',
    'cli-target.concept', 'mcp-target.concept',
    'openapi-target.concept', 'asyncapi-target.concept',
    'ts-sdk-target.concept', 'py-sdk-target.concept',
    'go-sdk-target.concept', 'rust-sdk-target.concept',
    'java-sdk-target.concept', 'swift-sdk-target.concept',
  ];

  it('all orchestration and provider concepts parse without error and have required fields', () => {
    for (const file of allConcepts) {
      const ast = readConcept(file);
      expect(ast.name, `${file} should have a name`).toBeTruthy();
      expect(ast.typeParams.length, `${file} should have type params`).toBeGreaterThan(0);
      expect(ast.version, `${file} should have @version`).toBe(1);
      expect(ast.actions.length, `${file} should have actions`).toBeGreaterThan(0);
      expect(ast.state.length, `${file} should have state`).toBeGreaterThan(0);
    }

    for (const file of allProviders) {
      const ast = readProvider(file);
      expect(ast.name, `${file} should have a name`).toBeTruthy();
      expect(ast.typeParams.length, `${file} should have type params`).toBeGreaterThan(0);
      expect(ast.version, `${file} should have @version`).toBe(1);
      expect(ast.actions.length, `${file} should have actions`).toBeGreaterThan(0);
      expect(ast.state.length, `${file} should have state`).toBeGreaterThan(0);
    }
  });

  it('all orchestration and provider concepts have at least one invariant', () => {
    for (const file of allConcepts) {
      const ast = readConcept(file);
      expect(ast.invariants.length, `${file} should have invariants`).toBeGreaterThan(0);
    }
    for (const file of allProviders) {
      const ast = readProvider(file);
      expect(ast.invariants.length, `${file} should have invariants`).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Core Sync Parsing
// ============================================================

describe('Core Syncs', () => {

  it('parses ProjectOnManifest', () => {
    const syncs = readSync('project-on-manifest.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ProjectOnManifest');
    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[0].when).toHaveLength(1);
    expect(syncs[0].then).toHaveLength(1);
    expect(syncs[0].then[0].concept).toContain('Projection');
  });

  it('parses ValidateProjection', () => {
    const syncs = readSync('validate-projection.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ValidateProjection');
    expect(syncs[0].then[0].concept).toContain('Projection');
  });

  it('parses PlanOnValid', () => {
    const syncs = readSync('plan-on-valid.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('PlanOnValid');
    expect(syncs[0].then[0].concept).toContain('Generator');
  });

  it('parses BlockOnBreaking', () => {
    const syncs = readSync('block-on-breaking.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('BlockOnBreaking');
    expect(syncs[0].then[0].concept).toContain('Generator');
  });

  it('parses GenerateOnPlan', () => {
    const syncs = readSync('generate-on-plan.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('GenerateOnPlan');
    expect(syncs[0].then[0].concept).toContain('Generator');
  });

  it('parses DispatchToTarget', () => {
    const syncs = readSync('dispatch-to-target.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('DispatchToTarget');
    expect(syncs[0].then[0].concept).toContain('Target');
  });

  it('parses DispatchToSdk', () => {
    const syncs = readSync('dispatch-to-sdk.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('DispatchToSdk');
    expect(syncs[0].then[0].concept).toContain('Sdk');
  });

  it('parses DispatchToSpec', () => {
    const syncs = readSync('dispatch-to-spec.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('DispatchToSpec');
    expect(syncs[0].then[0].concept).toContain('Spec');
  });

  it('parses ApplyMiddleware', () => {
    const syncs = readSync('apply-middleware.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ApplyMiddleware');
    expect(syncs[0].then[0].concept).toContain('Middleware');
  });

  it('parses WriteOnInject', () => {
    const syncs = readSync('write-on-inject.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('WriteOnInject');
    expect(syncs[0].then[0].concept).toContain('Emitter');
  });

  it('parses FormatOnWrite', () => {
    const syncs = readSync('format-on-write.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('FormatOnWrite');
    expect(syncs[0].then[0].concept).toContain('Emitter');
  });

  it('parses ComposeOnComplete', () => {
    const syncs = readSync('compose-on-complete.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('ComposeOnComplete');
    expect(syncs[0].then[0].concept).toContain('Surface');
  });

  it('parses WriteEntrypoint', () => {
    const syncs = readSync('write-entrypoint.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('WriteEntrypoint');
    expect(syncs[0].then[0].concept).toContain('Emitter');
  });

  it('parses CleanOrphans as eventual', () => {
    const syncs = readSync('clean-orphans.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('CleanOrphans');
    expect(syncs[0].annotations).toContain('eventual');
    expect(syncs[0].then[0].concept).toContain('Emitter');
  });

  it('parses GroupBeforeDispatch', () => {
    const syncs = readSync('group-before-dispatch.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('GroupBeforeDispatch');
    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[0].then[0].concept).toContain('Grouping');
  });

  it('parses WorkflowBeforeRender', () => {
    const syncs = readSync('workflow-before-render.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('WorkflowBeforeRender');
    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[0].then[0].concept).toContain('Workflow');
  });

  it('parses AnnotateBeforeGenerate', () => {
    const syncs = readSync('annotate-before-generate.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('AnnotateBeforeGenerate');
    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[0].then[0].concept).toContain('Annotation');
  });
});

// ============================================================
// Routing Syncs
// ============================================================

describe('Routing Syncs', () => {

  // --- Target Routing ---

  it('parses RouteToRest', () => {
    const syncs = readRoutingSync('route-to-rest.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToRest');
    expect(syncs[0].when[0].concept).toContain('Target');
    expect(syncs[0].then[0].concept).toContain('RestTarget');
  });

  it('parses RouteToGraphql', () => {
    const syncs = readRoutingSync('route-to-graphql.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToGraphql');
    expect(syncs[0].then[0].concept).toContain('GraphqlTarget');
  });

  it('parses RouteToGrpc', () => {
    const syncs = readRoutingSync('route-to-grpc.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToGrpc');
    expect(syncs[0].then[0].concept).toContain('GrpcTarget');
  });

  it('parses RouteToCli', () => {
    const syncs = readRoutingSync('route-to-cli.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToCli');
    expect(syncs[0].then[0].concept).toContain('CliTarget');
  });

  it('parses RouteToMcp', () => {
    const syncs = readRoutingSync('route-to-mcp.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToMcp');
    expect(syncs[0].then[0].concept).toContain('McpTarget');
  });

  // --- Spec Routing ---

  it('parses RouteToOpenApi', () => {
    const syncs = readRoutingSync('route-to-openapi.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToOpenApi');
    expect(syncs[0].then[0].concept).toContain('OpenApiTarget');
  });

  it('parses RouteToAsyncApi', () => {
    const syncs = readRoutingSync('route-to-asyncapi.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToAsyncApi');
    expect(syncs[0].then[0].concept).toContain('AsyncApiTarget');
  });

  // --- SDK Routing ---

  it('parses RouteToTsSdk', () => {
    const syncs = readRoutingSync('route-to-ts-sdk.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToTsSdk');
    expect(syncs[0].then[0].concept).toContain('TsSdkTarget');
  });

  it('parses RouteToPySdk', () => {
    const syncs = readRoutingSync('route-to-py-sdk.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToPySdk');
    expect(syncs[0].then[0].concept).toContain('PySdkTarget');
  });

  it('parses RouteToGoSdk', () => {
    const syncs = readRoutingSync('route-to-go-sdk.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToGoSdk');
    expect(syncs[0].then[0].concept).toContain('GoSdkTarget');
  });

  it('parses RouteToRustSdk', () => {
    const syncs = readRoutingSync('route-to-rust-sdk.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToRustSdk');
    expect(syncs[0].then[0].concept).toContain('RustSdkTarget');
  });

  it('parses RouteToJavaSdk', () => {
    const syncs = readRoutingSync('route-to-java-sdk.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToJavaSdk');
    expect(syncs[0].then[0].concept).toContain('JavaSdkTarget');
  });

  it('parses RouteToSwiftSdk', () => {
    const syncs = readRoutingSync('route-to-swift-sdk.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('RouteToSwiftSdk');
    expect(syncs[0].then[0].concept).toContain('SwiftSdkTarget');
  });

  // --- Middleware Injection ---

  it('parses InjectMiddlewareRest', () => {
    const syncs = readRoutingSync('inject-middleware-rest.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('InjectMiddlewareRest');
    expect(syncs[0].when[0].concept).toContain('RestTarget');
    expect(syncs[0].then[0].concept).toContain('Middleware');
  });

  it('parses InjectMiddlewareGraphql', () => {
    const syncs = readRoutingSync('inject-middleware-graphql.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('InjectMiddlewareGraphql');
    expect(syncs[0].then[0].concept).toContain('Middleware');
  });

  it('parses InjectMiddlewareGrpc', () => {
    const syncs = readRoutingSync('inject-middleware-grpc.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('InjectMiddlewareGrpc');
    expect(syncs[0].then[0].concept).toContain('Middleware');
  });

  it('parses InjectMiddlewareCli', () => {
    const syncs = readRoutingSync('inject-middleware-cli.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('InjectMiddlewareCli');
    expect(syncs[0].then[0].concept).toContain('Middleware');
  });

  it('parses InjectMiddlewareMcp', () => {
    const syncs = readRoutingSync('inject-middleware-mcp.sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('InjectMiddlewareMcp');
    expect(syncs[0].then[0].concept).toContain('Middleware');
  });
});

// ============================================================
// Bulk Sync Validation
// ============================================================

describe('Bulk Sync Validation', () => {

  const coreSyncs = [
    'project-on-manifest.sync',
    'validate-projection.sync',
    'plan-on-valid.sync',
    'block-on-breaking.sync',
    'generate-on-plan.sync',
    'dispatch-to-target.sync',
    'dispatch-to-sdk.sync',
    'dispatch-to-spec.sync',
    'apply-middleware.sync',
    'write-on-inject.sync',
    'format-on-write.sync',
    'compose-on-complete.sync',
    'write-entrypoint.sync',
    'clean-orphans.sync',
    'group-before-dispatch.sync',
    'workflow-before-render.sync',
    'annotate-before-generate.sync',
  ];

  const routingSyncs = [
    'route-to-rest.sync', 'route-to-graphql.sync', 'route-to-grpc.sync',
    'route-to-cli.sync', 'route-to-mcp.sync',
    'route-to-openapi.sync', 'route-to-asyncapi.sync',
    'route-to-ts-sdk.sync', 'route-to-py-sdk.sync',
    'route-to-go-sdk.sync', 'route-to-rust-sdk.sync',
    'route-to-java-sdk.sync', 'route-to-swift-sdk.sync',
    'inject-middleware-rest.sync', 'inject-middleware-graphql.sync',
    'inject-middleware-grpc.sync', 'inject-middleware-cli.sync',
    'inject-middleware-mcp.sync',
  ];

  it('all sync files parse without error', () => {
    for (const file of coreSyncs) {
      const syncs = readSync(file);
      expect(syncs.length, `${file} should produce at least one sync`).toBeGreaterThan(0);
      expect(syncs[0].name, `${file} should have a name`).toBeTruthy();
      expect(syncs[0].when.length, `${file} should have when patterns`).toBeGreaterThan(0);
      expect(syncs[0].then.length, `${file} should have then actions`).toBeGreaterThan(0);
    }
    for (const file of routingSyncs) {
      const syncs = readRoutingSync(file);
      expect(syncs.length, `routing/${file} should produce at least one sync`).toBeGreaterThan(0);
      expect(syncs[0].name, `routing/${file} should have a name`).toBeTruthy();
      expect(syncs[0].when.length, `routing/${file} should have when patterns`).toBeGreaterThan(0);
      expect(syncs[0].then.length, `routing/${file} should have then actions`).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Kit YAML Validation
// ============================================================

describe('Kit YAML', () => {

  it('kit.yaml exists and references valid files', () => {
    const kitPath = resolve(INTERFACE_DIR, 'kit.yaml');
    expect(existsSync(kitPath)).toBe(true);

    const content = readFileSync(kitPath, 'utf-8');
    expect(content).toContain('name: interface');
    expect(content).toContain('version: 0.1.0');

    // Verify all concept spec paths reference existing files
    const specPaths = content.match(/spec:\s+\.\/[\w/.-]+\.concept/g) || [];
    expect(specPaths.length).toBe(26);
    for (const match of specPaths) {
      const relPath = match.replace('spec: ', '').trim();
      const fullPath = resolve(INTERFACE_DIR, relPath);
      expect(existsSync(fullPath), `spec path should exist: ${relPath}`).toBe(true);
    }

    // Verify all sync paths reference existing files
    const syncPaths = content.match(/path:\s+\.\/syncs\/[\w/.-]+\.sync/g) || [];
    expect(syncPaths.length).toBe(38);
    for (const match of syncPaths) {
      const relPath = match.replace('path: ', '').trim();
      const fullPath = resolve(INTERFACE_DIR, relPath);
      expect(existsSync(fullPath), `sync path should exist: ${relPath}`).toBe(true);
    }
  });
});
