// ============================================================
// Stage 5 — RustGen Concept Implementation
//
// Generates Rust skeleton code from a ConceptManifest.
// Follows the same pattern as TypeScriptGen but maps
// ResolvedType to Rust syntax per Section 10.1.
//
// Type mapping table:
//   String  → String       Int    → i64
//   Float   → f64          Bool   → bool
//   Bytes   → Vec<u8>      DateTime → DateTime<Utc>
//   ID      → String       option T → Option<T>
//   set T   → HashSet<T>   list T   → Vec<T>
//   A -> B  → HashMap<A,B> params   → String (opaque)
//
// Generated files:
//   - types.rs         (struct definitions for inputs/outputs)
//   - handler.rs       (handler trait with async methods)
//   - adapter.rs       (transport adapter: deser/dispatch/ser)
//   - conformance.rs   (conformance tests from invariants)
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ResolvedType,
  ActionSchema,
  VariantSchema,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
} from '../../../kernel/src/types.js';

// --- ResolvedType → Rust mapping (Section 10.1) ---

function resolvedTypeToRust(t: ResolvedType): string {
  switch (t.kind) {
    case 'primitive':
      return primitiveToRust(t.primitive);
    case 'param':
      return 'String'; // type parameters are opaque string IDs on wire
    case 'set':
      return `HashSet<${resolvedTypeToRust(t.inner)}>`;
    case 'list':
      return `Vec<${resolvedTypeToRust(t.inner)}>`;
    case 'option':
      return `Option<${resolvedTypeToRust(t.inner)}>`;
    case 'map':
      return `HashMap<${resolvedTypeToRust(t.keyType)}, ${resolvedTypeToRust(t.inner)}>`;
    case 'record': {
      // Inline records become structs elsewhere; for inline use, map to a tuple-like comment
      const fields = t.fields.map(f => `${snakeCase(f.name)}: ${resolvedTypeToRust(f.type)}`);
      return `{ ${fields.join(', ')} }`;
    }
  }
}

function primitiveToRust(name: string): string {
  switch (name) {
    case 'String': return 'String';
    case 'Int': return 'i64';
    case 'Float': return 'f64';
    case 'Bool': return 'bool';
    case 'Bytes': return 'Vec<u8>';
    case 'DateTime': return 'DateTime<Utc>';
    case 'ID': return 'String';
    default: return 'serde_json::Value';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function snakeCase(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

// --- Derive macros needed based on types ---

function derivesForStruct(hasHashSet: boolean): string {
  const derives = ['Debug', 'Clone', 'Serialize', 'Deserialize'];
  if (!hasHashSet) {
    derives.push('PartialEq');
  }
  return derives.join(', ');
}

function typeUsesHashSet(t: ResolvedType): boolean {
  switch (t.kind) {
    case 'set': return true;
    case 'list': return typeUsesHashSet(t.inner);
    case 'option': return typeUsesHashSet(t.inner);
    case 'map': return typeUsesHashSet(t.keyType) || typeUsesHashSet(t.inner);
    case 'record': return t.fields.some(f => typeUsesHashSet(f.type));
    default: return false;
  }
}

// --- Collect use declarations ---

function collectImports(manifest: ConceptManifest): string[] {
  const imports = new Set<string>();
  imports.add('use serde::{Serialize, Deserialize};');

  const needsHashSet = manifest.actions.some(a =>
    a.params.some(p => typeNeedsCollection(p.type, 'set')) ||
    a.variants.some(v => v.fields.some(f => typeNeedsCollection(f.type, 'set')))
  );
  const needsHashMap = manifest.actions.some(a =>
    a.params.some(p => typeNeedsCollection(p.type, 'map')) ||
    a.variants.some(v => v.fields.some(f => typeNeedsCollection(f.type, 'map')))
  );
  const needsDateTime = manifest.actions.some(a =>
    a.params.some(p => typeNeedsPrimitive(p.type, 'DateTime')) ||
    a.variants.some(v => v.fields.some(f => typeNeedsPrimitive(f.type, 'DateTime')))
  );

  if (needsHashSet) imports.add('use std::collections::HashSet;');
  if (needsHashMap) imports.add('use std::collections::HashMap;');
  if (needsDateTime) imports.add('use chrono::{DateTime, Utc};');

  return Array.from(imports).sort();
}

function typeNeedsCollection(t: ResolvedType, kind: 'set' | 'map'): boolean {
  if (t.kind === kind) return true;
  if (t.kind === 'list' || t.kind === 'option' || t.kind === 'set') return typeNeedsCollection(t.inner, kind);
  if (t.kind === 'map') return typeNeedsCollection(t.keyType, kind) || typeNeedsCollection(t.inner, kind);
  if (t.kind === 'record') return t.fields.some(f => typeNeedsCollection(f.type, kind));
  return false;
}

function typeNeedsPrimitive(t: ResolvedType, prim: string): boolean {
  if (t.kind === 'primitive') return t.primitive === prim;
  if (t.kind === 'list' || t.kind === 'option' || t.kind === 'set') return typeNeedsPrimitive(t.inner, prim);
  if (t.kind === 'map') return typeNeedsPrimitive(t.keyType, prim) || typeNeedsPrimitive(t.inner, prim);
  if (t.kind === 'record') return t.fields.some(f => typeNeedsPrimitive(f.type, prim));
  return false;
}

// --- Type Definitions File (types.rs) ---

function generateTypesFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const lines: string[] = [
    `// generated: ${snakeCase(conceptName)}/types.rs`,
    '',
    ...collectImports(manifest),
    '',
  ];

  for (const action of manifest.actions) {
    // Input struct
    const inputStructName = `${conceptName}${capitalize(action.name)}Input`;
    const inputHasHashSet = action.params.some(p => typeUsesHashSet(p.type));
    lines.push(`#[derive(${derivesForStruct(inputHasHashSet)})]`);
    lines.push(`pub struct ${inputStructName} {`);
    for (const p of action.params) {
      lines.push(`    pub ${snakeCase(p.name)}: ${resolvedTypeToRust(p.type)},`);
    }
    lines.push(`}`);
    lines.push('');

    // Output enum (tagged union of variants)
    const outputEnumName = `${conceptName}${capitalize(action.name)}Output`;
    const enumHasHashSet = action.variants.some(v =>
      v.fields.some(f => typeUsesHashSet(f.type))
    );
    lines.push(`#[derive(${derivesForStruct(enumHasHashSet)})]`);
    lines.push(`#[serde(tag = "variant")]`);
    lines.push(`pub enum ${outputEnumName} {`);

    for (const v of action.variants) {
      const variantName = capitalize(v.tag);
      if (v.fields.length === 0) {
        lines.push(`    ${variantName},`);
      } else {
        lines.push(`    ${variantName} {`);
        for (const f of v.fields) {
          lines.push(`        ${snakeCase(f.name)}: ${resolvedTypeToRust(f.type)},`);
        }
        lines.push(`    },`);
      }
    }

    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

// --- Handler Trait File (handler.rs) ---

function generateHandlerFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const modName = snakeCase(conceptName);
  const lines: string[] = [
    `// generated: ${modName}/handler.rs`,
    '',
    `use async_trait::async_trait;`,
    `use crate::storage::ConceptStorage;`,
    `use super::types::*;`,
    '',
    `#[async_trait]`,
    `pub trait ${conceptName}Handler: Send + Sync {`,
  ];

  for (const action of manifest.actions) {
    const inputType = `${conceptName}${capitalize(action.name)}Input`;
    const outputType = `${conceptName}${capitalize(action.name)}Output`;
    lines.push(`    async fn ${snakeCase(action.name)}(`);
    lines.push(`        &self,`);
    lines.push(`        input: ${inputType},`);
    lines.push(`        storage: &dyn ConceptStorage,`);
    lines.push(`    ) -> Result<${outputType}, Box<dyn std::error::Error>>;`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

// --- Adapter File (adapter.rs) ---

function generateAdapterFile(manifest: ConceptManifest): string {
  const conceptName = manifest.name;
  const modName = snakeCase(conceptName);
  const lines: string[] = [
    `// generated: ${modName}/adapter.rs`,
    '',
    `use serde_json::Value;`,
    `use crate::transport::{`,
    `    ActionInvocation, ActionCompletion,`,
    `    ConceptTransport, ConceptQuery,`,
    `};`,
    `use crate::storage::ConceptStorage;`,
    `use super::handler::${conceptName}Handler;`,
    `use super::types::*;`,
    '',
    `pub struct ${conceptName}Adapter<H: ${conceptName}Handler> {`,
    `    handler: H,`,
    `    storage: Box<dyn ConceptStorage>,`,
    `}`,
    '',
    `impl<H: ${conceptName}Handler> ${conceptName}Adapter<H> {`,
    `    pub fn new(handler: H, storage: Box<dyn ConceptStorage>) -> Self {`,
    `        Self { handler, storage }`,
    `    }`,
    `}`,
    '',
    `#[async_trait::async_trait]`,
    `impl<H: ${conceptName}Handler + 'static> ConceptTransport for ${conceptName}Adapter<H> {`,
    `    async fn invoke(&self, invocation: ActionInvocation) -> Result<ActionCompletion, Box<dyn std::error::Error>> {`,
    `        let result: Value = match invocation.action.as_str() {`,
  ];

  for (const action of manifest.actions) {
    const inputType = `${conceptName}${capitalize(action.name)}Input`;
    lines.push(`            "${action.name}" => {`);
    lines.push(`                let input: ${inputType} = serde_json::from_value(invocation.input.clone())?;`);
    lines.push(`                let output = self.handler.${snakeCase(action.name)}(input, self.storage.as_ref()).await?;`);
    lines.push(`                serde_json::to_value(output)?`);
    lines.push(`            },`);
  }

  lines.push(`            _ => return Err(format!("Unknown action: {}", invocation.action).into()),`);
  lines.push(`        };`);
  lines.push('');
  lines.push(`        let variant = result.get("variant")`);
  lines.push(`            .and_then(|v| v.as_str())`);
  lines.push(`            .unwrap_or("ok")`);
  lines.push(`            .to_string();`);
  lines.push('');
  lines.push(`        Ok(ActionCompletion {`);
  lines.push(`            id: invocation.id,`);
  lines.push(`            concept: invocation.concept,`);
  lines.push(`            action: invocation.action,`);
  lines.push(`            input: invocation.input,`);
  lines.push(`            variant,`);
  lines.push(`            output: result,`);
  lines.push(`            flow: invocation.flow,`);
  lines.push(`            timestamp: chrono::Utc::now().to_rfc3339(),`);
  lines.push(`        })`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    async fn query(&self, request: ConceptQuery) -> Result<Vec<Value>, Box<dyn std::error::Error>> {`);
  lines.push(`        self.storage.find(&request.relation, request.args.as_ref()).await`);
  lines.push(`    }`);
  lines.push('');
  lines.push(`    async fn health(&self) -> Result<(bool, u64), Box<dyn std::error::Error>> {`);
  lines.push(`        Ok((true, 0))`);
  lines.push(`    }`);
  lines.push(`}`);

  return lines.join('\n');
}

// --- Conformance Test File (conformance.rs) ---

function generateConformanceTestFile(manifest: ConceptManifest): string | null {
  if (manifest.invariants.length === 0) {
    return null;
  }

  const conceptName = manifest.name;
  const modName = snakeCase(conceptName);

  const lines: string[] = [
    `// generated: ${modName}/conformance.rs`,
    '',
    `#[cfg(test)]`,
    `mod tests {`,
    `    use super::super::handler::${conceptName}Handler;`,
    `    use super::super::types::*;`,
    `    use crate::storage::create_in_memory_storage;`,
    '',
  ];

  for (let invIdx = 0; invIdx < manifest.invariants.length; invIdx++) {
    const inv = manifest.invariants[invIdx];

    lines.push(`    #[tokio::test]`);
    lines.push(`    async fn ${modName}_invariant_${invIdx + 1}() {`);
    lines.push(`        // ${inv.description}`);
    lines.push(`        let storage = create_in_memory_storage();`);
    lines.push(`        let handler = create_test_handler(); // provided by implementor`);
    lines.push('');

    // Declare free variable bindings
    for (const fv of inv.freeVariables) {
      lines.push(`        let ${snakeCase(fv.name)} = "${fv.testValue}".to_string();`);
    }
    if (inv.freeVariables.length > 0) lines.push('');

    // After clause (setup)
    let stepNum = 1;
    lines.push(`        // --- AFTER clause ---`);
    for (const step of inv.setup) {
      lines.push(...generateRustStepCode(step, stepNum));
      stepNum++;
    }
    lines.push('');

    // Then clause (assertions)
    lines.push(`        // --- THEN clause ---`);
    for (const step of inv.assertions) {
      lines.push(...generateRustStepCode(step, stepNum));
      stepNum++;
    }

    lines.push(`    }`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

function generateRustStepCode(
  step: InvariantStep,
  stepNum: number,
): string[] {
  const lines: string[] = [];
  const varName = `step${stepNum}`;

  // Comment
  const inputStr = step.inputs.map(a => {
    if (a.value.kind === 'literal') return `${a.name}: ${JSON.stringify(a.value.value)}`;
    return `${a.name}: ${a.value.name}`;
  }).join(', ');
  const outputStr = step.expectedOutputs.map(a => {
    if (a.value.kind === 'literal') return `${a.name}: ${JSON.stringify(a.value.value)}`;
    return `${a.name}: ${a.value.name}`;
  }).join(', ');
  lines.push(`        // ${step.action}(${inputStr}) -> ${step.expectedVariant}(${outputStr})`);

  // Build input struct fields
  const inputFields = step.inputs.map(a => {
    if (a.value.kind === 'literal') {
      const val = a.value.value;
      if (typeof val === 'string') return `${snakeCase(a.name)}: "${val}".to_string()`;
      if (typeof val === 'boolean') return `${snakeCase(a.name)}: ${val}`;
      return `${snakeCase(a.name)}: ${val}`;
    }
    return `${snakeCase(a.name)}: ${snakeCase(a.value.name)}.clone()`;
  }).join(', ');

  // Build the struct name: ConceptNameActionInput
  // We don't have concept name here, so we'll use a placeholder
  lines.push(`        let ${varName} = handler.${snakeCase(step.action)}(`);
  lines.push(`            ${capitalize(step.action)}Input { ${inputFields} },`);
  lines.push(`            &storage,`);
  lines.push(`        ).await.unwrap();`);

  // Assert variant via pattern match
  const variantName = capitalize(step.expectedVariant);
  if (step.expectedOutputs.length > 0) {
    const bindings = step.expectedOutputs.map(o => snakeCase(o.name)).join(', ');
    lines.push(`        match ${varName} {`);
    lines.push(`            ${capitalize(step.action)}Output::${variantName} { ${bindings}, .. } => {`);

    for (const out of step.expectedOutputs) {
      if (out.value.kind === 'literal') {
        const val = out.value.value;
        if (typeof val === 'string') {
          lines.push(`                assert_eq!(${snakeCase(out.name)}, "${val}");`);
        } else if (typeof val === 'boolean') {
          lines.push(`                assert_eq!(${snakeCase(out.name)}, ${val});`);
        } else {
          lines.push(`                assert_eq!(${snakeCase(out.name)}, ${val});`);
        }
      } else {
        lines.push(`                assert_eq!(${snakeCase(out.name)}, ${snakeCase(out.value.name)});`);
      }
    }

    lines.push(`            },`);
    lines.push(`            other => panic!("Expected ${variantName}, got {:?}", other),`);
    lines.push(`        }`);
  } else {
    lines.push(`        assert!(matches!(${varName}, ${capitalize(step.action)}Output::${variantName}));`);
  }

  return lines;
}

// --- Handler ---

export const rustGenHandler: ConceptHandler = {
  async generate(input, storage) {
    const spec = input.spec as string;
    const manifest = input.manifest as ConceptManifest;

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Invalid manifest: missing concept name' };
    }

    try {
      const modName = snakeCase(manifest.name);
      const files: { path: string; content: string }[] = [
        { path: `${modName}/types.rs`, content: generateTypesFile(manifest) },
        { path: `${modName}/handler.rs`, content: generateHandlerFile(manifest) },
        { path: `${modName}/adapter.rs`, content: generateAdapterFile(manifest) },
      ];

      // Add conformance tests if the manifest has invariants
      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${modName}/conformance.rs`, content: conformanceTest });
      }

      // Store the output keyed by spec reference
      await storage.put('outputs', spec, { spec, files });

      return { variant: 'ok', files };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
