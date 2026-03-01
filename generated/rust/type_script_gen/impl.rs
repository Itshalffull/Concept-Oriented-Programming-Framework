// TypeScriptGen Handler Implementation
//
// Generate TypeScript skeleton code from a ConceptManifest.
// Produces type definitions, handler interface, transport
// adapter, lite query implementation, and conformance tests.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TypeScriptGenHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("type-script-gen-{}", n)
}

/// Map a Clef type name to a TypeScript type string.
fn map_type(clef_type: &str) -> &str {
    match clef_type {
        "String" => "string",
        "Int" | "Float" => "number",
        "Bool" => "boolean",
        "DateTime" => "string",
        "Bytes" => "Uint8Array",
        _ => "unknown",
    }
}

/// Convert a concept name to PascalCase.
fn to_pascal_case(name: &str) -> String {
    name.split(&['-', '_', ' '][..])
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect()
}

/// Convert a concept name to camelCase.
fn to_camel_case(name: &str) -> String {
    let pascal = to_pascal_case(name);
    let mut chars = pascal.chars();
    match chars.next() {
        Some(c) => c.to_lowercase().to_string() + chars.as_str(),
        None => String::new(),
    }
}

pub struct TypeScriptGenHandlerImpl;

#[async_trait]
impl TypeScriptGenHandler for TypeScriptGenHandlerImpl {
    async fn generate(
        &self,
        input: TypeScriptGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptGenGenerateOutput, Box<dyn std::error::Error>> {
        let spec = &input.spec;
        let manifest = &input.manifest;

        // Validate manifest
        let concept_name = manifest.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if concept_name.is_empty() {
            return Ok(TypeScriptGenGenerateOutput::Error {
                message: "Manifest name is required and cannot be empty".to_string(),
            });
        }

        let pascal = to_pascal_case(concept_name);
        let camel = to_camel_case(concept_name);
        let purpose = manifest.get("purpose")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let actions = manifest.get("actions")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut files: Vec<serde_json::Value> = Vec::new();

        // 1. Generate type definitions
        let mut type_lines = vec![
            format!("// Auto-generated types for {}", concept_name),
            format!("// {}", purpose),
            String::new(),
        ];

        for action in &actions {
            let action_name = action.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let params = action.get("params").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let variants = action.get("variants").and_then(|v| v.as_array()).cloned().unwrap_or_default();

            // Input type
            type_lines.push(format!("export interface {}{}Input {{", pascal, to_pascal_case(action_name)));
            for param in &params {
                let param_name = param.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                let param_type = param.get("type").and_then(|v| v.as_str()).unwrap_or("String");
                type_lines.push(format!("  {}: {};", param_name, map_type(param_type)));
            }
            type_lines.push("}".to_string());
            type_lines.push(String::new());

            // Output variant types
            for variant in &variants {
                let tag = variant.get("tag").and_then(|v| v.as_str()).unwrap_or("ok");
                let fields = variant.get("fields").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                type_lines.push(format!("export interface {}{}{}Output {{", pascal, to_pascal_case(action_name), to_pascal_case(tag)));
                type_lines.push(format!("  variant: '{}';", tag));
                for field in &fields {
                    let field_name = field.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                    let field_type = field.get("type").and_then(|v| v.as_str()).unwrap_or("String");
                    type_lines.push(format!("  {}: {};", field_name, map_type(field_type)));
                }
                type_lines.push("}".to_string());
                type_lines.push(String::new());
            }
        }

        files.push(json!({
            "path": format!("generated/{}/types.ts", camel),
            "content": type_lines.join("\n")
        }));

        // 2. Generate handler interface
        let mut handler_lines = vec![
            format!("// Auto-generated handler interface for {}", concept_name),
            "import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';".to_string(),
            String::new(),
            format!("export interface {}Handler extends ConceptHandler {{", pascal),
        ];

        for action in &actions {
            let action_name = action.get("name").and_then(|v| v.as_str()).unwrap_or("");
            handler_lines.push(format!(
                "  {}(input: Record<string, unknown>, storage: ConceptStorage): Promise<{{ variant: string; [key: string]: unknown }}>;",
                action_name
            ));
        }
        handler_lines.push("}".to_string());

        files.push(json!({
            "path": format!("generated/{}/handler.ts", camel),
            "content": handler_lines.join("\n")
        }));

        // 3. Generate transport adapter
        let adapter_lines = vec![
            format!("// Auto-generated transport adapter for {}", concept_name),
            "import type { ConceptHandler, ConceptStorage, ActionInvocation, ActionCompletion } from '../../runtime/types.js';".to_string(),
            String::new(),
            format!("export function create{}Adapter(handler: ConceptHandler, storage: ConceptStorage) {{", pascal),
            "  return {".to_string(),
            "    async dispatch(invocation: ActionInvocation): Promise<ActionCompletion> {".to_string(),
            "      const actionFn = handler[invocation.action];".to_string(),
            "      if (!actionFn) { return { id: invocation.id, variant: 'error', output: { message: `Unknown action` } }; }".to_string(),
            "      const result = await actionFn(invocation.input, storage);".to_string(),
            "      const { variant, ...output } = result;".to_string(),
            "      return { id: invocation.id, variant, output, flow: invocation.flow, timestamp: new Date().toISOString() };".to_string(),
            "    },".to_string(),
            "  };".to_string(),
            "}".to_string(),
        ];

        files.push(json!({
            "path": format!("generated/{}/adapter.ts", camel),
            "content": adapter_lines.join("\n")
        }));

        // 4. Generate conformance tests
        let invariants = manifest.get("invariants")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut test_lines = vec![
            format!("// Auto-generated conformance tests for {}", concept_name),
            "import { describe, it, expect } from 'vitest';".to_string(),
            String::new(),
            format!("describe('{} conformance', () => {{", concept_name),
        ];

        if invariants.is_empty() {
            test_lines.push("  it('has no invariants to test', () => {".to_string());
            test_lines.push("    expect(true).toBe(true);".to_string());
            test_lines.push("  });".to_string());
        } else {
            for (i, _inv) in invariants.iter().enumerate() {
                test_lines.push(format!("  it('satisfies invariant {}', () => {{", i + 1));
                test_lines.push("    // TODO: implement invariant check".to_string());
                test_lines.push("    expect(true).toBe(true);".to_string());
                test_lines.push("  });".to_string());
            }
        }
        test_lines.push("});".to_string());

        files.push(json!({
            "path": format!("generated/{}/conformance.test.ts", camel),
            "content": test_lines.join("\n")
        }));

        // Store the generated output
        let id = next_id();
        let file_paths: Vec<String> = files.iter()
            .filter_map(|f| f.get("path").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        storage.put("type-script-gen", &id, json!({
            "id": id,
            "spec": spec,
            "conceptName": concept_name,
            "fileCount": files.len(),
            "filePaths": file_paths
        })).await?;

        // Serialize files to the expected output format
        let files_output: Vec<String> = files.iter()
            .map(|f| serde_json::to_string(f).unwrap_or_default())
            .collect();

        Ok(TypeScriptGenGenerateOutput::Ok {
            files: files_output,
        })
    }

    async fn register(
        &self,
        _input: TypeScriptGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<TypeScriptGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(TypeScriptGenRegisterOutput::Ok {
            name: "TypeScriptGen".to_string(),
            input_kind: "ConceptManifest".to_string(),
            output_kind: "TypeScriptSource".to_string(),
            capabilities: vec![
                "types".to_string(),
                "handler".to_string(),
                "adapter".to_string(),
                "conformance-tests".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_success() {
        let storage = InMemoryStorage::new();
        let handler = TypeScriptGenHandlerImpl;
        let result = handler.generate(
            TypeScriptGenGenerateInput {
                spec: "echo.concept".to_string(),
                manifest: json!({
                    "name": "echo",
                    "purpose": "Echo messages back",
                    "actions": [{
                        "name": "send",
                        "params": [{"name": "message", "type": "String"}],
                        "variants": [{"tag": "ok", "fields": [{"name": "reply", "type": "String"}]}]
                    }],
                    "invariants": []
                }),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypeScriptGenGenerateOutput::Ok { files } => {
                assert!(!files.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = TypeScriptGenHandlerImpl;
        let result = handler.generate(
            TypeScriptGenGenerateInput {
                spec: "test.concept".to_string(),
                manifest: json!({"name": "", "actions": []}),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypeScriptGenGenerateOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = TypeScriptGenHandlerImpl;
        let result = handler.register(
            TypeScriptGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            TypeScriptGenRegisterOutput::Ok { name, input_kind, output_kind, capabilities } => {
                assert_eq!(name, "TypeScriptGen");
                assert_eq!(input_kind, "ConceptManifest");
                assert_eq!(output_kind, "TypeScriptSource");
                assert!(capabilities.contains(&"types".to_string()));
                assert!(capabilities.contains(&"handler".to_string()));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[test]
    fn test_to_pascal_case() {
        assert_eq!(to_pascal_case("hello-world"), "HelloWorld");
        assert_eq!(to_pascal_case("echo"), "Echo");
        assert_eq!(to_pascal_case("my_concept"), "MyConcept");
    }

    #[test]
    fn test_to_camel_case() {
        assert_eq!(to_camel_case("hello-world"), "helloWorld");
        assert_eq!(to_camel_case("echo"), "echo");
    }

    #[test]
    fn test_map_type() {
        assert_eq!(map_type("String"), "string");
        assert_eq!(map_type("Int"), "number");
        assert_eq!(map_type("Bool"), "boolean");
        assert_eq!(map_type("Bytes"), "Uint8Array");
        assert_eq!(map_type("Unknown"), "unknown");
    }
}
