// @clef-handler style=functional concept=RustGen
// @migrated dsl-constructs 2026-03-18
// ============================================================
// RustGen Concept Implementation
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

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { normalizeValue } from './normalize-input.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type {
  ConceptManifest,
  ResolvedType,
  InvariantSchema,
  InvariantStep,
  InvariantValue,
} from '../../../runtime/types.js';

type Result = { variant: string; [key: string]: unknown };

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
      const fields = t.fields.map(f => `${snakeCase(f.name)}: ${resolvedTypeToRust(f.type)}`);
      return `{ ${fields.join(', ')} }`;
    }
    case 'enum':
      return 'String';
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
    `// generated: ${snakeCase(conceptName)}/types.stub.rs`,
    '',
    ...collectImports(manifest),
    '',
  ];

  for (const action of manifest.actions) {
    const inputStructName = `${conceptName}${capitalize(action.name)}Input`;
    const inputHasHashSet = action.params.some(p => typeUsesHashSet(p.type));
    lines.push(`#[derive(${derivesForStruct(inputHasHashSet)})]`);
    lines.push(`pub struct ${inputStructName} {`);
    for (const p of action.params) {
      lines.push(`    pub ${snakeCase(p.name)}: ${resolvedTypeToRust(p.type)},`);
    }
    lines.push(`}`);
    lines.push('');

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
    `// generated: ${modName}/handler.stub.rs`,
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
    `// generated: ${modName}/adapter.stub.rs`,
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
    `// generated: ${modName}/conformance.stub.rs`,
    '',
    `#[cfg(test)]`,
    `mod tests {`,
    `    use super::super::handler::${conceptName}Handler;`,
    `    use super::super::types::*;`,
    `    use crate::storage::create_in_memory_storage;`,
    '',
  ];

  let invNum = 0;
  for (let invIdx = 0; invIdx < manifest.invariants.length; invIdx++) {
    const inv = manifest.invariants[invIdx];

    // Skip invariants with no operational steps (e.g., 'always' universal properties)
    if (inv.setup.length === 0 && inv.assertions.length === 0) {
      continue;
    }
    invNum++;

    lines.push(`    #[tokio::test]`);
    lines.push(`    async fn ${modName}_invariant_${invNum}() {`);
    lines.push(`        // ${inv.description}`);
    lines.push(`        let storage = create_in_memory_storage();`);
    lines.push(`        let handler = create_test_handler(); // provided by implementor`);
    lines.push('');

    for (const fv of inv.freeVariables) {
      lines.push(`        let ${snakeCase(fv.name)} = "${fv.testValue}".to_string();`);
    }
    if (inv.freeVariables.length > 0) lines.push('');

    let stepNum = 1;
    lines.push(`        // --- AFTER clause ---`);
    for (const step of inv.setup) {
      lines.push(...generateRustStepCode(step, stepNum));
      stepNum++;
    }
    lines.push('');

    lines.push(`        // --- THEN clause ---`);
    for (const step of inv.assertions) {
      lines.push(...generateRustStepCode(step, stepNum));
      stepNum++;
    }

    lines.push(`    }`);
    lines.push('');
  }

  // If all invariants were skipped, return null
  if (invNum === 0) {
    return null;
  }

  lines.push(`}`);
  return lines.join('\n');
}

function invariantValueToRust(v: InvariantValue): string {
  switch (v.kind) {
    case 'literal': {
      const val = v.value;
      if (typeof val === 'string') return `"${val}".to_string()`;
      if (typeof val === 'boolean') return `${val}`;
      return `${val}`;
    }
    case 'variable':
      return `${snakeCase(v.name)}.clone()`;
    case 'record': {
      const fieldStrs = v.fields.map(
        f => `${f.name}: ${invariantValueToRust(f.value)}`
      ).join(', ');
      return `todo!("record: {{ ${fieldStrs.replace(/"/g, '\\"')} }}")`;
    }
    case 'list': {
      const itemStrs = v.items.map(
        item => invariantValueToRust(item)
      ).join(', ');
      return `todo!("list: [${itemStrs.replace(/"/g, '\\"')}]")`;
    }
  }
}

function invariantValueToComment(v: InvariantValue): string {
  switch (v.kind) {
    case 'literal':
      return JSON.stringify(v.value);
    case 'variable':
      return v.name;
    case 'record': {
      const fields = v.fields.map(f => `${f.name}: ${invariantValueToComment(f.value)}`).join(', ');
      return `{ ${fields} }`;
    }
    case 'list': {
      const items = v.items.map(item => invariantValueToComment(item)).join(', ');
      return `[${items}]`;
    }
  }
}

function generateRustStepCode(
  step: InvariantStep,
  stepNum: number,
): string[] {
  const lines: string[] = [];
  const varName = `step${stepNum}`;

  const inputStr = step.inputs.map(a =>
    `${a.name}: ${invariantValueToComment(a.value)}`
  ).join(', ');
  const outputStr = step.expectedOutputs.map(a =>
    `${a.name}: ${invariantValueToComment(a.value)}`
  ).join(', ');
  lines.push(`        // ${step.action}(${inputStr}) -> ${step.expectedVariant}(${outputStr})`);

  const inputFields = step.inputs.map(a =>
    `${snakeCase(a.name)}: ${invariantValueToRust(a.value)}`
  ).join(', ');

  lines.push(`        let ${varName} = handler.${snakeCase(step.action)}(`);
  lines.push(`            ${capitalize(step.action)}Input { ${inputFields} },`);
  lines.push(`            &storage,`);
  lines.push(`        ).await.unwrap();`);

  const variantName = capitalize(step.expectedVariant);
  if (step.expectedOutputs.length > 0) {
    const bindings = step.expectedOutputs.map(o => snakeCase(o.name)).join(', ');
    lines.push(`        match ${varName} {`);
    lines.push(`            ${capitalize(step.action)}Output::${variantName} { ${bindings}, .. } => {`);

    for (const out of step.expectedOutputs) {
      const expected = invariantValueToRust(out.value);
      lines.push(`                assert_eq!(${snakeCase(out.name)}, ${expected});`);
    }

    lines.push(`            },`);
    lines.push(`            other => panic!("Expected ${variantName}, got {:?}", other),`);
    lines.push(`        }`);
  } else {
    lines.push(`        assert!(matches!(${varName}, ${capitalize(step.action)}Output::${variantName}));`);
  }

  return lines;
}

// --- StorageProgram DSL Runtime File (Rust) ---

function generateDslRuntimeFile(): string {
  return `// generated: storage_program.dsl.stub.rs
//
// StorageProgram DSL — Free Monad for Concept Handlers (Rust)
// Provides typed lenses/optics, effect tracking, algebraic effects,
// transport effects, and functorial mapping for render programs.

use std::collections::HashSet;
use serde::{Serialize, Deserialize};
use serde_json::Value;

// ── Lens Types ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind")]
pub enum LensSegment {
    #[serde(rename = "relation")]
    Relation { name: String },
    #[serde(rename = "key")]
    Key { value: String },
    #[serde(rename = "field")]
    Field { name: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StateLens {
    pub segments: Vec<LensSegment>,
    pub source_type: String,
    pub focus_type: String,
}

impl StateLens {
    pub fn relation(name: &str) -> Self {
        Self {
            segments: vec![LensSegment::Relation { name: name.to_string() }],
            source_type: "store".to_string(),
            focus_type: format!("relation<{}>", name),
        }
    }

    pub fn at(mut self, key: &str) -> Self {
        self.segments.push(LensSegment::Key { value: key.to_string() });
        self.focus_type = "record".to_string();
        self
    }

    pub fn field(mut self, name: &str) -> Self {
        self.segments.push(LensSegment::Field { name: name.to_string() });
        self.focus_type = name.to_string();
        self
    }

    pub fn compose(mut self, inner: StateLens) -> Self {
        self.segments.extend(inner.segments);
        self.focus_type = inner.focus_type;
        self
    }

    pub fn relation_name(&self) -> Option<&str> {
        match self.segments.first()? {
            LensSegment::Relation { name } => Some(name.as_str()),
            _ => None,
        }
    }
}

// ── Effect Set ──────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EffectSet {
    pub reads: HashSet<String>,
    pub writes: HashSet<String>,
    pub completion_variants: HashSet<String>,
    pub performs: HashSet<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Purity {
    Pure,
    ReadOnly,
    ReadWrite,
}

impl EffectSet {
    pub fn new() -> Self { Self::default() }

    pub fn merge(&self, other: &EffectSet) -> Self {
        Self {
            reads: self.reads.union(&other.reads).cloned().collect(),
            writes: self.writes.union(&other.writes).cloned().collect(),
            completion_variants: self.completion_variants.union(&other.completion_variants).cloned().collect(),
            performs: self.performs.union(&other.performs).cloned().collect(),
        }
    }

    pub fn purity(&self) -> Purity {
        if !self.writes.is_empty() { Purity::ReadWrite }
        else if !self.reads.is_empty() { Purity::ReadOnly }
        else { Purity::Pure }
    }

    pub fn validate_purity(&self, declared: Purity) -> Option<String> {
        match declared {
            Purity::Pure if !self.reads.is_empty() || !self.writes.is_empty() =>
                Some("Declared pure but has storage effects".to_string()),
            Purity::ReadOnly if !self.writes.is_empty() =>
                Some(format!("Declared read-only but writes to: {}", self.writes.iter().cloned().collect::<Vec<_>>().join(", "))),
            _ => None,
        }
    }
}

// ── Instruction Types ───────────────────────────────────────

pub type Bindings = serde_json::Map<String, Value>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "tag")]
pub enum Instruction {
    #[serde(rename = "get")]
    Get { relation: String, key: String, bind_as: String },
    #[serde(rename = "find")]
    Find { relation: String, criteria: Value, bind_as: String },
    #[serde(rename = "put")]
    Put { relation: String, key: String, value: Value },
    #[serde(rename = "merge")]
    Merge { relation: String, key: String, fields: Value },
    #[serde(rename = "del")]
    Del { relation: String, key: String },
    #[serde(rename = "getLens")]
    GetLens { lens: StateLens, bind_as: String },
    #[serde(rename = "putLens")]
    PutLens { lens: StateLens, value: Value },
    #[serde(rename = "perform")]
    Perform { protocol: String, operation: String, payload: Value, bind_as: String },
    #[serde(rename = "pure")]
    Pure { value: Value },
}

// ── StorageProgram ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageProgram {
    pub instructions: Vec<Instruction>,
    pub terminated: bool,
    pub effects: EffectSet,
}

impl StorageProgram {
    pub fn new() -> Self {
        Self { instructions: vec![], terminated: false, effects: EffectSet::new() }
    }

    pub fn get(mut self, relation: &str, key: &str, bind_as: &str) -> Self {
        self.effects.reads.insert(relation.to_string());
        self.instructions.push(Instruction::Get { relation: relation.to_string(), key: key.to_string(), bind_as: bind_as.to_string() });
        self
    }

    pub fn put(mut self, relation: &str, key: &str, value: Value) -> Self {
        self.effects.writes.insert(relation.to_string());
        self.instructions.push(Instruction::Put { relation: relation.to_string(), key: key.to_string(), value });
        self
    }

    pub fn get_lens(mut self, lens: StateLens, bind_as: &str) -> Self {
        if let Some(rel) = lens.relation_name() { self.effects.reads.insert(rel.to_string()); }
        self.instructions.push(Instruction::GetLens { lens, bind_as: bind_as.to_string() });
        self
    }

    pub fn put_lens(mut self, lens: StateLens, value: Value) -> Self {
        if let Some(rel) = lens.relation_name() { self.effects.writes.insert(rel.to_string()); }
        self.instructions.push(Instruction::PutLens { lens, value });
        self
    }

    pub fn perform(mut self, protocol: &str, operation: &str, payload: Value, bind_as: &str) -> Self {
        self.effects.performs.insert(format!("{}:{}", protocol, operation));
        self.instructions.push(Instruction::Perform { protocol: protocol.to_string(), operation: operation.to_string(), payload, bind_as: bind_as.to_string() });
        self
    }

    pub fn pure(mut self, value: Value) -> Self {
        self.instructions.push(Instruction::Pure { value });
        self.terminated = true;
        self
    }

    pub fn complete(mut self, variant: &str, output: Value) -> Self {
        self.effects.completion_variants.insert(variant.to_string());
        let mut map = match output {
            Value::Object(m) => m,
            _ => serde_json::Map::new(),
        };
        map.insert("variant".to_string(), Value::String(variant.to_string()));
        self.instructions.push(Instruction::Pure { value: Value::Object(map) });
        self.terminated = true;
        self
    }

    pub fn extract_completion_variants(&self) -> HashSet<String> {
        let mut variants = HashSet::new();
        for instr in &self.instructions {
            if let Instruction::Pure { value } = instr {
                if let Some(v) = value.get("variant").and_then(|v| v.as_str()) {
                    variants.insert(v.to_string());
                }
            }
        }
        variants
    }

    pub fn extract_perform_set(&self) -> HashSet<String> {
        let mut performs = HashSet::new();
        for instr in &self.instructions {
            if let Instruction::Perform { protocol, operation, .. } = instr {
                performs.insert(format!("{}:{}", protocol, operation));
            }
        }
        performs
    }
}

// ── Render Program (Functorial Mapping) ─────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "tag")]
pub enum RenderInstruction {
    #[serde(rename = "token")]
    Token { path: String, value: Value },
    #[serde(rename = "aria")]
    Aria { role: Option<String>, label: Option<String>, attributes: Option<Value> },
    #[serde(rename = "bind")]
    Bind { field: String, expr: String },
    #[serde(rename = "element")]
    Element { name: String, attributes: Option<Value> },
    #[serde(rename = "focus")]
    Focus { strategy: String, target: Option<String> },
    #[serde(rename = "keyboard")]
    Keyboard { key: String, action: String, modifiers: Option<Vec<String>> },
    #[serde(rename = "pure")]
    RenderPure { value: Value },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderProgram {
    pub instructions: Vec<RenderInstruction>,
    pub terminated: bool,
}

impl RenderProgram {
    pub fn map<F>(&self, transform: F) -> Self
    where
        F: Fn(&RenderInstruction) -> RenderInstruction,
    {
        Self {
            instructions: self.instructions.iter().map(|i| transform(i)).collect(),
            terminated: self.terminated,
        }
    }
}
`;
}

// --- Handler ---

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'RustGen',
      inputKind: 'ConceptManifest',
      outputKind: 'RustSource',
      capabilities: JSON.stringify(['types', 'handler', 'adapter', 'conformance-tests', 'dsl-runtime']),
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    if (!input.manifest || (typeof input.manifest === 'string' && (input.manifest as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'manifest is required' }) as StorageProgram<Result>;
    }
    const spec = input.spec as string;
    const manifest = normalizeValue(input.manifest) as ConceptManifest;

    if (!manifest || !manifest.name) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Invalid manifest: missing concept name' }) as StorageProgram<Result>;
    }

    try {
      const modName = snakeCase(manifest.name);
      const files: { path: string; content: string }[] = [
        { path: `${modName}/types.stub.rs`, content: generateTypesFile(manifest) },
        { path: `${modName}/handler.stub.rs`, content: generateHandlerFile(manifest) },
        { path: `${modName}/adapter.stub.rs`, content: generateAdapterFile(manifest) },
        { path: `storage_program_dsl.stub.rs`, content: generateDslRuntimeFile() },
      ];

      const conformanceTest = generateConformanceTestFile(manifest);
      if (conformanceTest) {
        files.push({ path: `${modName}/conformance.stub.rs`, content: conformanceTest });
      }

      const p = createProgram();
      return complete(p, 'ok', { files }) as StorageProgram<Result>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const p = createProgram();
      return complete(p, 'error', { message, ...(stack ? { stack } : {}) }) as StorageProgram<Result>;
    }
  },
};

export const rustGenHandler = autoInterpret(_handler);
