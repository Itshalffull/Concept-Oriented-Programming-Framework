// ============================================================
// Generator & Provider Registration Tests
//
// Validates that all generators and providers implement the
// provider/PluginRegistry pattern by exposing a register action
// that returns static metadata compatible with the generation
// kit's RegisterGeneratorKinds and EnsureKindsDefined syncs.
//
// See generation kit syncs: register-generator-kinds.sync,
// ensure-kinds-defined.sync
// See interface kit syncs: register-interface-provider-kinds.sync
// See deploy kit syncs: register-deploy-provider-kinds.sync
// ============================================================

import { describe, it, expect } from 'vitest';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler.js';
import { rustGenHandler } from '../handlers/ts/framework/rust-gen.handler.js';
import { swiftGenHandler } from '../handlers/ts/framework/swift-gen.handler.js';
import { solidityGenHandler } from '../handlers/ts/framework/solidity-gen.handler.js';

// Interface target providers
import { restTargetHandler } from '../handlers/ts/framework/providers/rest-target.handler.js';
import { graphqlTargetHandler } from '../handlers/ts/framework/providers/graphql-target.handler.js';
import { grpcTargetHandler } from '../handlers/ts/framework/providers/grpc-target.handler.js';
import { cliTargetHandler } from '../handlers/ts/framework/providers/cli-target.handler.js';
import { mcpTargetHandler } from '../handlers/ts/framework/providers/mcp-target.handler.js';
import { claudeSkillsTargetHandler } from '../handlers/ts/framework/providers/claude-skills-target.handler.js';

// Interface SDK providers
import { tsSdkTargetHandler } from '../handlers/ts/framework/providers/ts-sdk-target.handler.js';
import { pySdkTargetHandler } from '../handlers/ts/framework/providers/py-sdk-target.handler.js';
import { goSdkTargetHandler } from '../handlers/ts/framework/providers/go-sdk-target.handler.js';
import { javaSdkTargetHandler } from '../handlers/ts/framework/providers/java-sdk-target.handler.js';
import { rustSdkTargetHandler } from '../handlers/ts/framework/providers/rust-sdk-target.handler.js';
import { swiftSdkTargetHandler } from '../handlers/ts/framework/providers/swift-sdk-target.handler.js';

// Interface spec providers
import { openapiTargetHandler } from '../handlers/ts/framework/providers/openapi-target.handler.js';
import { asyncapiTargetHandler } from '../handlers/ts/framework/providers/asyncapi-target.handler.js';

// Deploy IaC providers
import { terraformProviderHandler } from '../handlers/ts/app/terraform-provider.handler.js';
import { cloudformationProviderHandler } from '../handlers/ts/app/cloudformation-provider.handler.js';
import { pulumiProviderHandler } from '../handlers/ts/app/pulumi-provider.handler.js';
import { dockerComposeIacProviderHandler } from '../handlers/ts/app/docker-compose-iac-provider.handler.js';

// Deploy GitOps providers
import { argocdProviderHandler } from '../handlers/ts/app/argocd-provider.handler.js';
import { fluxProviderHandler } from '../handlers/ts/app/flux-provider.handler.js';

// All generators/providers must return these fields from register() so
// the kit syncs can bind ?meta.name, ?meta.inputKind, and ?meta.outputKind.
interface GeneratorRegistration {
  variant: string;
  name: string;
  inputKind: string;
  outputKind: string;
  capabilities: string; // JSON-serialized list
  [key: string]: unknown;
}

describe('Framework Generator PluginRegistry Registration', () => {
  // ---------------------------------------------------------
  // SchemaGen
  // ---------------------------------------------------------
  describe('SchemaGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await schemaGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('SchemaGen');
      expect(result.inputKind).toBe('ConceptAST');
      expect(result.outputKind).toBe('ConceptManifest');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('graphql');
      expect(caps).toContain('json-schema');
      expect(caps).toContain('invariants');
    });
  });

  // ---------------------------------------------------------
  // TypeScriptGen
  // ---------------------------------------------------------
  describe('TypeScriptGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await typescriptGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('TypeScriptGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('TypeScriptSource');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('types');
      expect(caps).toContain('handler');
      expect(caps).toContain('adapter');
      expect(caps).toContain('conformance-tests');
    });
  });

  // ---------------------------------------------------------
  // RustGen
  // ---------------------------------------------------------
  describe('RustGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await rustGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('RustGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('RustSource');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('types');
      expect(caps).toContain('handler');
      expect(caps).toContain('adapter');
      expect(caps).toContain('conformance-tests');
    });
  });

  // ---------------------------------------------------------
  // SwiftGen
  // ---------------------------------------------------------
  describe('SwiftGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await swiftGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('SwiftGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('SwiftSource');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('types');
      expect(caps).toContain('handler');
      expect(caps).toContain('adapter');
      expect(caps).toContain('conformance-tests');
    });
  });

  // ---------------------------------------------------------
  // SolidityGen
  // ---------------------------------------------------------
  describe('SolidityGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await solidityGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('SolidityGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('SoliditySource');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('contract');
      expect(caps).toContain('events');
      expect(caps).toContain('foundry-tests');
    });
  });

  // ---------------------------------------------------------
  // Cross-generator consistency
  // ---------------------------------------------------------
  describe('Cross-generator consistency', () => {
    it('all language generators share ConceptManifest as inputKind', async () => {
      const generators = [
        typescriptGenHandler,
        rustGenHandler,
        swiftGenHandler,
        solidityGenHandler,
      ];

      for (const gen of generators) {
        const result = await gen.register({}, null as any) as GeneratorRegistration;
        expect(result.inputKind).toBe('ConceptManifest');
      }
    });

    it('all language generators produce distinct outputKinds', async () => {
      const generators = [
        typescriptGenHandler,
        rustGenHandler,
        swiftGenHandler,
        solidityGenHandler,
      ];

      const outputKinds = new Set<string>();
      for (const gen of generators) {
        const result = await gen.register({}, null as any) as GeneratorRegistration;
        outputKinds.add(result.outputKind);
      }

      expect(outputKinds.size).toBe(generators.length);
    });

    it('SchemaGen output feeds into language generator input', async () => {
      const schemaResult = await schemaGenHandler.register({}, null as any) as GeneratorRegistration;
      const tsResult = await typescriptGenHandler.register({}, null as any) as GeneratorRegistration;

      // SchemaGen's outputKind must match language generators' inputKind
      expect(schemaResult.outputKind).toBe(tsResult.inputKind);
    });

    it('all generators return valid JSON capabilities', async () => {
      const generators = [
        schemaGenHandler,
        typescriptGenHandler,
        rustGenHandler,
        swiftGenHandler,
        solidityGenHandler,
      ];

      for (const gen of generators) {
        const result = await gen.register({}, null as any) as GeneratorRegistration;
        expect(() => JSON.parse(result.capabilities)).not.toThrow();
        const caps = JSON.parse(result.capabilities);
        expect(Array.isArray(caps)).toBe(true);
        expect(caps.length).toBeGreaterThan(0);
      }
    });
  });
});

// =============================================================
// Interface Target Provider Registration
// =============================================================

describe('Interface Target Provider PluginRegistry Registration', () => {
  const targets: Array<{ handler: any; name: string; targetKey: string; outputKind: string }> = [
    { handler: restTargetHandler, name: 'RestTarget', targetKey: 'rest', outputKind: 'RestRoutes' },
    { handler: graphqlTargetHandler, name: 'GraphqlTarget', targetKey: 'graphql', outputKind: 'GraphQLSchema' },
    { handler: grpcTargetHandler, name: 'GrpcTarget', targetKey: 'grpc', outputKind: 'GrpcProto' },
    { handler: cliTargetHandler, name: 'CliTarget', targetKey: 'cli', outputKind: 'CliCommands' },
    { handler: mcpTargetHandler, name: 'McpTarget', targetKey: 'mcp', outputKind: 'McpTools' },
    { handler: claudeSkillsTargetHandler, name: 'ClaudeSkillsTarget', targetKey: 'claude-skills', outputKind: 'ClaudeSkills' },
  ];

  for (const { handler, name, targetKey, outputKind } of targets) {
    it(`${name} register action returns valid metadata`, async () => {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      expect(result.variant).toBe('ok');
      expect(result.name).toBe(name);
      expect(result.inputKind).toBe('InterfaceProjection');
      expect(result.outputKind).toBe(outputKind);
      expect(result.targetKey).toBe(targetKey);
      expect(result.providerType).toBe('target');
      const caps = JSON.parse(result.capabilities);
      expect(Array.isArray(caps)).toBe(true);
      expect(caps.length).toBeGreaterThan(0);
    });
  }

  it('all interface targets share InterfaceProjection as inputKind', async () => {
    for (const { handler } of targets) {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      expect(result.inputKind).toBe('InterfaceProjection');
    }
  });

  it('all interface targets produce distinct outputKinds', async () => {
    const outputKinds = new Set<string>();
    for (const { handler } of targets) {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      outputKinds.add(result.outputKind);
    }
    expect(outputKinds.size).toBe(targets.length);
  });
});

// =============================================================
// Interface SDK Provider Registration
// =============================================================

describe('Interface SDK Provider PluginRegistry Registration', () => {
  const sdks: Array<{ handler: any; name: string; targetKey: string; outputKind: string }> = [
    { handler: tsSdkTargetHandler, name: 'TsSdkTarget', targetKey: 'typescript', outputKind: 'TypeScriptSdk' },
    { handler: pySdkTargetHandler, name: 'PySdkTarget', targetKey: 'python', outputKind: 'PythonSdk' },
    { handler: goSdkTargetHandler, name: 'GoSdkTarget', targetKey: 'go', outputKind: 'GoSdk' },
    { handler: javaSdkTargetHandler, name: 'JavaSdkTarget', targetKey: 'java', outputKind: 'JavaSdk' },
    { handler: rustSdkTargetHandler, name: 'RustSdkTarget', targetKey: 'rust', outputKind: 'RustSdk' },
    { handler: swiftSdkTargetHandler, name: 'SwiftSdkTarget', targetKey: 'swift', outputKind: 'SwiftSdk' },
  ];

  for (const { handler, name, targetKey, outputKind } of sdks) {
    it(`${name} register action returns valid metadata`, async () => {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      expect(result.variant).toBe('ok');
      expect(result.name).toBe(name);
      expect(result.inputKind).toBe('InterfaceProjection');
      expect(result.outputKind).toBe(outputKind);
      expect(result.targetKey).toBe(targetKey);
      expect(result.providerType).toBe('sdk');
      const caps = JSON.parse(result.capabilities);
      expect(Array.isArray(caps)).toBe(true);
      expect(caps.length).toBeGreaterThan(0);
    });
  }

  it('all SDK providers produce distinct outputKinds', async () => {
    const outputKinds = new Set<string>();
    for (const { handler } of sdks) {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      outputKinds.add(result.outputKind);
    }
    expect(outputKinds.size).toBe(sdks.length);
  });
});

// =============================================================
// Interface Spec Provider Registration
// =============================================================

describe('Interface Spec Provider PluginRegistry Registration', () => {
  const specs: Array<{ handler: any; name: string; targetKey: string; outputKind: string }> = [
    { handler: openapiTargetHandler, name: 'OpenapiTarget', targetKey: 'openapi', outputKind: 'OpenApiSpec' },
    { handler: asyncapiTargetHandler, name: 'AsyncapiTarget', targetKey: 'asyncapi', outputKind: 'AsyncApiSpec' },
  ];

  for (const { handler, name, targetKey, outputKind } of specs) {
    it(`${name} register action returns valid metadata`, async () => {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      expect(result.variant).toBe('ok');
      expect(result.name).toBe(name);
      expect(result.inputKind).toBe('InterfaceProjection');
      expect(result.outputKind).toBe(outputKind);
      expect(result.targetKey).toBe(targetKey);
      expect(result.providerType).toBe('spec');
      const caps = JSON.parse(result.capabilities);
      expect(Array.isArray(caps)).toBe(true);
      expect(caps.length).toBeGreaterThan(0);
    });
  }
});

// =============================================================
// Deploy IaC Provider Registration
// =============================================================

describe('Deploy IaC Provider PluginRegistry Registration', () => {
  const iacProviders: Array<{ handler: any; name: string; providerKey: string; outputKind: string }> = [
    { handler: terraformProviderHandler, name: 'TerraformProvider', providerKey: 'terraform', outputKind: 'TerraformHCL' },
    { handler: cloudformationProviderHandler, name: 'CloudFormationProvider', providerKey: 'cloudformation', outputKind: 'CloudFormationTemplate' },
    { handler: pulumiProviderHandler, name: 'PulumiProvider', providerKey: 'pulumi', outputKind: 'PulumiStack' },
    { handler: dockerComposeIacProviderHandler, name: 'DockerComposeIacProvider', providerKey: 'docker-compose', outputKind: 'DockerComposeYaml' },
  ];

  for (const { handler, name, providerKey, outputKind } of iacProviders) {
    it(`${name} register action returns valid metadata`, async () => {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      expect(result.variant).toBe('ok');
      expect(result.name).toBe(name);
      expect(result.inputKind).toBe('DeployPlan');
      expect(result.outputKind).toBe(outputKind);
      expect(result.providerKey).toBe(providerKey);
      expect(result.providerType).toBe('iac');
      const caps = JSON.parse(result.capabilities);
      expect(Array.isArray(caps)).toBe(true);
      expect(caps.length).toBeGreaterThan(0);
    });
  }

  it('all IaC providers share DeployPlan as inputKind', async () => {
    for (const { handler } of iacProviders) {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      expect(result.inputKind).toBe('DeployPlan');
    }
  });

  it('all IaC providers produce distinct outputKinds', async () => {
    const outputKinds = new Set<string>();
    for (const { handler } of iacProviders) {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      outputKinds.add(result.outputKind);
    }
    expect(outputKinds.size).toBe(iacProviders.length);
  });
});

// =============================================================
// Deploy GitOps Provider Registration
// =============================================================

describe('Deploy GitOps Provider PluginRegistry Registration', () => {
  const gitopsProviders: Array<{ handler: any; name: string; providerKey: string; outputKind: string }> = [
    { handler: argocdProviderHandler, name: 'ArgoCDProvider', providerKey: 'argocd', outputKind: 'ArgoCDManifest' },
    { handler: fluxProviderHandler, name: 'FluxProvider', providerKey: 'flux', outputKind: 'FluxKustomization' },
  ];

  for (const { handler, name, providerKey, outputKind } of gitopsProviders) {
    it(`${name} register action returns valid metadata`, async () => {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      expect(result.variant).toBe('ok');
      expect(result.name).toBe(name);
      expect(result.inputKind).toBe('DeployPlan');
      expect(result.outputKind).toBe(outputKind);
      expect(result.providerKey).toBe(providerKey);
      expect(result.providerType).toBe('gitops');
      const caps = JSON.parse(result.capabilities);
      expect(Array.isArray(caps)).toBe(true);
      expect(caps.length).toBeGreaterThan(0);
    });
  }
});

// =============================================================
// Cross-family consistency
// =============================================================

describe('Cross-family registration consistency', () => {
  it('all providers return valid JSON capabilities', async () => {
    const allHandlers = [
      // Framework generators
      schemaGenHandler, typescriptGenHandler, rustGenHandler, swiftGenHandler, solidityGenHandler,
      // Interface targets
      restTargetHandler, graphqlTargetHandler, grpcTargetHandler, cliTargetHandler, mcpTargetHandler, claudeSkillsTargetHandler,
      // SDK targets
      tsSdkTargetHandler, pySdkTargetHandler, goSdkTargetHandler, javaSdkTargetHandler, rustSdkTargetHandler, swiftSdkTargetHandler,
      // Spec targets
      openapiTargetHandler, asyncapiTargetHandler,
      // Deploy IaC
      terraformProviderHandler, cloudformationProviderHandler, pulumiProviderHandler, dockerComposeIacProviderHandler,
      // Deploy GitOps
      argocdProviderHandler, fluxProviderHandler,
    ];

    for (const handler of allHandlers) {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      expect(result.variant).toBe('ok');
      expect(typeof result.name).toBe('string');
      expect(typeof result.inputKind).toBe('string');
      expect(typeof result.outputKind).toBe('string');
      expect(() => JSON.parse(result.capabilities)).not.toThrow();
    }
  });

  it('all 25 generators/providers produce unique outputKinds', async () => {
    const allHandlers = [
      schemaGenHandler, typescriptGenHandler, rustGenHandler, swiftGenHandler, solidityGenHandler,
      restTargetHandler, graphqlTargetHandler, grpcTargetHandler, cliTargetHandler, mcpTargetHandler, claudeSkillsTargetHandler,
      tsSdkTargetHandler, pySdkTargetHandler, goSdkTargetHandler, javaSdkTargetHandler, rustSdkTargetHandler, swiftSdkTargetHandler,
      openapiTargetHandler, asyncapiTargetHandler,
      terraformProviderHandler, cloudformationProviderHandler, pulumiProviderHandler, dockerComposeIacProviderHandler,
      argocdProviderHandler, fluxProviderHandler,
    ];

    const outputKinds = new Set<string>();
    for (const handler of allHandlers) {
      const result = await handler.register({}, null as any) as GeneratorRegistration;
      outputKinds.add(result.outputKind);
    }
    expect(outputKinds.size).toBe(allHandlers.length);
  });
});
