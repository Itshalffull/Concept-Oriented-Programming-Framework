use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RustGenHandler;
use serde_json::json;

pub struct RustGenHandlerImpl;

/// Generate Rust types.rs content from a manifest's action definitions.
fn generate_types(manifest: &serde_json::Value) -> String {
    let mut out = String::from("use serde::{Serialize, Deserialize};\n\n");
    let concept = manifest.get("concept").and_then(|v| v.as_str()).unwrap_or("Unknown");

    if let Some(actions) = manifest.get("actions").and_then(|v| v.as_array()) {
        for action in actions {
            let name = action.get("name").and_then(|v| v.as_str()).unwrap_or("action");
            let pascal = to_pascal_case(name);

            // Input struct
            out.push_str(&format!("#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]\n"));
            out.push_str(&format!("pub struct {}{}Input {{\n", to_pascal_case(concept), pascal));
            if let Some(params) = action.get("params").and_then(|v| v.as_array()) {
                for param in params {
                    let pname = param.as_str().unwrap_or("param");
                    out.push_str(&format!("    pub {}: String,\n", to_snake_case(pname)));
                }
            }
            out.push_str("}\n\n");

            // Output enum
            out.push_str(&format!("#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]\n"));
            out.push_str(&format!("#[serde(tag = \"variant\")]\n"));
            out.push_str(&format!("pub enum {}{}Output {{\n", to_pascal_case(concept), pascal));
            if let Some(variants) = action.get("variants").and_then(|v| v.as_array()) {
                for variant in variants {
                    let vname = variant.as_str().unwrap_or("Ok");
                    out.push_str(&format!("    {},\n", to_pascal_case(vname)));
                }
            }
            out.push_str("}\n\n");
        }
    }

    out
}

/// Generate handler.rs trait from manifest.
fn generate_handler(manifest: &serde_json::Value) -> String {
    let concept = manifest.get("concept").and_then(|v| v.as_str()).unwrap_or("Unknown");
    let pascal = to_pascal_case(concept);

    let mut out = format!(
        "use async_trait::async_trait;\nuse crate::storage::ConceptStorage;\nuse super::types::*;\n\n#[async_trait]\npub trait {}Handler: Send + Sync {{\n",
        pascal
    );

    if let Some(actions) = manifest.get("actions").and_then(|v| v.as_array()) {
        for action in actions {
            let name = action.get("name").and_then(|v| v.as_str()).unwrap_or("action");
            let snake = to_snake_case(name);
            let action_pascal = to_pascal_case(name);
            out.push_str(&format!(
                "    async fn {}(&self, input: {}{pascal}Input, storage: &dyn ConceptStorage) -> Result<{}{pascal}Output, Box<dyn std::error::Error>>;\n",
                snake, pascal, pascal, pascal = action_pascal
            ));
        }
    }

    out.push_str("}\n");
    out
}

fn to_pascal_case(s: &str) -> String {
    s.split(|c: char| c == '_' || c == '-')
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(c) => c.to_uppercase().to_string() + &chars.as_str().to_lowercase(),
                None => String::new(),
            }
        })
        .collect()
}

fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('_');
        }
        result.push(c.to_lowercase().next().unwrap_or(c));
    }
    result
}

#[async_trait]
impl RustGenHandler for RustGenHandlerImpl {
    async fn generate(
        &self,
        input: RustGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RustGenGenerateOutput, Box<dyn std::error::Error>> {
        let manifest = &input.manifest;
        let concept = manifest.get("concept").and_then(|v| v.as_str()).unwrap_or("unknown");
        let concept_snake = to_snake_case(concept);

        let types_content = generate_types(manifest);
        let handler_content = generate_handler(manifest);

        let files = vec![
            json!({"path": format!("{}/types.rs", concept_snake), "content": types_content}),
            json!({"path": format!("{}/handler.rs", concept_snake), "content": handler_content}),
        ];

        Ok(RustGenGenerateOutput::Ok {
            files: serde_json::to_string(&files)?,
        })
    }

    async fn register(
        &self,
        _input: RustGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RustGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(RustGenRegisterOutput::Ok {
            name: "rust-gen".to_string(),
            input_kind: "concept-manifest".to_string(),
            output_kind: "rust-source".to_string(),
            capabilities: vec![
                "types".to_string(),
                "handler-trait".to_string(),
                "adapter".to_string(),
                "serde".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_produces_files() {
        let storage = InMemoryStorage::new();
        let handler = RustGenHandlerImpl;
        let manifest = serde_json::json!({
            "concept": "User",
            "actions": [
                {"name": "create", "params": ["name", "email"], "variants": ["ok", "error"]}
            ]
        });
        let result = handler.generate(
            RustGenGenerateInput { manifest },
            &storage,
        ).await.unwrap();
        match result {
            RustGenGenerateOutput::Ok { files } => {
                assert!(files.contains("types.rs") || files.contains("handler.rs"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = RustGenHandlerImpl;
        let result = handler.register(
            RustGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            RustGenRegisterOutput::Ok { name, input_kind, output_kind, .. } => {
                assert_eq!(name, "rust-gen");
                assert_eq!(input_kind, "concept-manifest");
                assert_eq!(output_kind, "rust-source");
            },
        }
    }
}
