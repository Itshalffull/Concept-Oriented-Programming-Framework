// HandlerScaffoldGen concept implementation
// Generates handler scaffold code (TypeScript) from concept definitions with action signatures.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::HandlerScaffoldGenHandler;
use serde_json::json;

pub struct HandlerScaffoldGenHandlerImpl;

/// Convert a concept name to PascalCase for type names
fn to_pascal_case(s: &str) -> String {
    s.split(|c: char| c == '-' || c == '_' || c == ' ')
        .filter(|seg| !seg.is_empty())
        .map(|seg| {
            let mut chars = seg.chars();
            match chars.next() {
                Some(first) => {
                    let upper: String = first.to_uppercase().collect();
                    format!("{}{}", upper, chars.collect::<String>())
                }
                None => String::new(),
            }
        })
        .collect()
}

/// Convert a concept name to camelCase for function/method names
fn to_camel_case(s: &str) -> String {
    let pascal = to_pascal_case(s);
    let mut chars = pascal.chars();
    match chars.next() {
        Some(first) => {
            let lower: String = first.to_lowercase().collect();
            format!("{}{}", lower, chars.collect::<String>())
        }
        None => String::new(),
    }
}

/// Generate a TypeScript handler file for a concept
fn generate_handler_code(concept_name: &str, actions: &[serde_json::Value]) -> String {
    let pascal = to_pascal_case(concept_name);
    let mut code = String::new();

    // Imports
    code.push_str(&format!(
        "import {{ ConceptStorage }} from '@clef/kernel';\n\n"
    ));

    // Handler class
    code.push_str(&format!("export class {}Handler {{\n", pascal));
    code.push_str("  constructor(private storage: ConceptStorage) {}\n\n");

    for action in actions {
        let action_name = action.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("action");
        let camel = to_camel_case(action_name);
        let action_pascal = to_pascal_case(action_name);

        // Extract input fields for type generation
        let input_fields = action.get("input")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let output_variants = action.get("output")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        // Method signature
        code.push_str(&format!(
            "  async {}(input: {}{}Input): Promise<{}{}Output> {{\n",
            camel, pascal, action_pascal, pascal, action_pascal
        ));

        // Stub body with storage interaction pattern
        code.push_str("    // TODO: Implement handler logic\n");

        // Generate a basic implementation pattern based on action name
        if action_name.starts_with("create") || action_name.starts_with("add") || action_name.starts_with("register") {
            code.push_str(&format!(
                "    await this.storage.put('{}', input.id ?? crypto.randomUUID(), input);\n",
                concept_name
            ));
            code.push_str("    return { variant: 'ok' };\n");
        } else if action_name.starts_with("get") || action_name.starts_with("find") {
            code.push_str(&format!(
                "    const record = await this.storage.get('{}', input.id);\n",
                concept_name
            ));
            code.push_str("    if (!record) return { variant: 'notfound' };\n");
            code.push_str("    return { variant: 'ok', ...record };\n");
        } else if action_name.starts_with("delete") || action_name.starts_with("remove") {
            code.push_str(&format!(
                "    await this.storage.del('{}', input.id);\n",
                concept_name
            ));
            code.push_str("    return { variant: 'ok' };\n");
        } else if action_name.starts_with("list") {
            code.push_str(&format!(
                "    const records = await this.storage.find('{}', {{}});\n",
                concept_name
            ));
            code.push_str("    return { variant: 'ok', items: records };\n");
        } else {
            code.push_str("    return { variant: 'ok' };\n");
        }

        code.push_str("  }\n\n");
    }

    code.push_str("}\n");
    code
}

/// Generate TypeScript type definitions for a concept
fn generate_types_code(concept_name: &str, actions: &[serde_json::Value]) -> String {
    let pascal = to_pascal_case(concept_name);
    let mut code = String::new();

    for action in actions {
        let action_name = action.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("action");
        let action_pascal = to_pascal_case(action_name);

        // Input type
        code.push_str(&format!("export interface {}{}Input {{\n", pascal, action_pascal));
        if let Some(fields) = action.get("input").and_then(|v| v.as_array()) {
            for field in fields {
                let fname = field.get("name").and_then(|v| v.as_str()).unwrap_or("field");
                let ftype = field.get("type").and_then(|v| v.as_str()).unwrap_or("string");
                let optional = field.get("optional").and_then(|v| v.as_bool()).unwrap_or(false);
                let ts_type = match ftype {
                    "number" | "integer" | "int" | "float" | "double" => "number",
                    "boolean" | "bool" => "boolean",
                    "bytes" => "Uint8Array",
                    _ => "string",
                };
                let opt = if optional { "?" } else { "" };
                code.push_str(&format!("  {}{}: {};\n", fname, opt, ts_type));
            }
        }
        code.push_str("}\n\n");

        // Output type (union of variants)
        code.push_str(&format!("export type {}{}Output =\n", pascal, action_pascal));
        if let Some(variants) = action.get("output").and_then(|v| v.as_array()) {
            for (i, variant) in variants.iter().enumerate() {
                let vname = variant.get("variant").and_then(|v| v.as_str()).unwrap_or("ok");
                code.push_str(&format!("  | {{ variant: '{}' }}", vname));
                if i < variants.len() - 1 {
                    code.push('\n');
                }
            }
        } else {
            code.push_str("  | { variant: 'ok' }");
        }
        code.push_str(";\n\n");
    }

    code
}

#[async_trait]
impl HandlerScaffoldGenHandler for HandlerScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: HandlerScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HandlerScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.concept_name.trim().is_empty() {
            return Ok(HandlerScaffoldGenGenerateOutput::Error {
                message: "Concept name cannot be empty".to_string(),
            });
        }

        let handler_code = generate_handler_code(&input.concept_name, &input.actions);
        let types_code = generate_types_code(&input.concept_name, &input.actions);

        let handler_file = json!({
            "path": format!("handlers/ts/{}.handler.ts", input.concept_name),
            "content": handler_code,
        });

        let types_file = json!({
            "path": format!("handlers/ts/{}.types.ts", input.concept_name),
            "content": types_code,
        });

        let files = vec![handler_file, types_file];
        let files_generated = files.len() as i64;

        // Store the generated scaffold
        storage.put("scaffold", &input.concept_name, json!({
            "concept": input.concept_name,
            "filesGenerated": files_generated,
            "actionCount": input.actions.len(),
        })).await?;

        Ok(HandlerScaffoldGenGenerateOutput::Ok {
            files,
            files_generated,
        })
    }

    async fn preview(
        &self,
        input: HandlerScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HandlerScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        if input.concept_name.trim().is_empty() {
            return Ok(HandlerScaffoldGenPreviewOutput::Error {
                message: "Concept name cannot be empty".to_string(),
            });
        }

        // Check if already generated
        let existing = storage.get("scaffold", &input.concept_name).await?;
        if existing.is_some() {
            return Ok(HandlerScaffoldGenPreviewOutput::Cached);
        }

        let handler_code = generate_handler_code(&input.concept_name, &input.actions);
        let types_code = generate_types_code(&input.concept_name, &input.actions);

        let handler_file = json!({
            "path": format!("handlers/ts/{}.handler.ts", input.concept_name),
            "content": handler_code,
            "action": "write",
        });

        let types_file = json!({
            "path": format!("handlers/ts/{}.types.ts", input.concept_name),
            "content": types_code,
            "action": "write",
        });

        let files = vec![handler_file, types_file];
        let would_write = files.len() as i64;

        Ok(HandlerScaffoldGenPreviewOutput::Ok {
            files,
            would_write,
            would_skip: 0,
        })
    }

    async fn register(
        &self,
        _input: HandlerScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<HandlerScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(HandlerScaffoldGenRegisterOutput::Ok {
            name: "handler-scaffold-gen".to_string(),
            input_kind: "ConceptAST".to_string(),
            output_kind: "FileArtifact".to_string(),
            capabilities: vec![
                "typescript-handler".to_string(),
                "typescript-types".to_string(),
                "concept-scaffolding".to_string(),
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
        let handler = HandlerScaffoldGenHandlerImpl;
        let actions = vec![serde_json::json!({
            "name": "create",
            "input": [{"name": "name", "type": "string"}],
            "output": [{"variant": "ok"}, {"variant": "notfound"}]
        })];
        let result = handler.generate(
            HandlerScaffoldGenGenerateInput {
                concept_name: "user".to_string(),
                actions,
            },
            &storage,
        ).await.unwrap();
        match result {
            HandlerScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert_eq!(files_generated, 2);
                assert_eq!(files.len(), 2);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_concept_name() {
        let storage = InMemoryStorage::new();
        let handler = HandlerScaffoldGenHandlerImpl;
        let result = handler.generate(
            HandlerScaffoldGenGenerateInput {
                concept_name: "".to_string(),
                actions: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            HandlerScaffoldGenGenerateOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_success() {
        let storage = InMemoryStorage::new();
        let handler = HandlerScaffoldGenHandlerImpl;
        let actions = vec![serde_json::json!({"name": "get"})];
        let result = handler.preview(
            HandlerScaffoldGenPreviewInput {
                concept_name: "article".to_string(),
                actions,
            },
            &storage,
        ).await.unwrap();
        match result {
            HandlerScaffoldGenPreviewOutput::Ok { would_write, .. } => {
                assert_eq!(would_write, 2);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_cached() {
        let storage = InMemoryStorage::new();
        let handler = HandlerScaffoldGenHandlerImpl;
        let actions = vec![serde_json::json!({"name": "create"})];
        handler.generate(
            HandlerScaffoldGenGenerateInput { concept_name: "comment".to_string(), actions: actions.clone() },
            &storage,
        ).await.unwrap();
        let result = handler.preview(
            HandlerScaffoldGenPreviewInput { concept_name: "comment".to_string(), actions },
            &storage,
        ).await.unwrap();
        match result {
            HandlerScaffoldGenPreviewOutput::Cached => {},
            _ => panic!("Expected Cached variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = HandlerScaffoldGenHandlerImpl;
        let result = handler.register(
            HandlerScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            HandlerScaffoldGenRegisterOutput::Ok { name, .. } => {
                assert_eq!(name, "handler-scaffold-gen");
            },
        }
    }
}
