// Swift code generation from ConceptManifest.
// Generates Swift structs, protocol definitions, and test files from concept specs.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SwiftGenHandler;
use serde_json::json;

pub struct SwiftGenHandlerImpl;

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
    }
}

fn type_to_swift(type_expr: &str) -> &str {
    match type_expr {
        "String" => "String",
        "Int" => "Int",
        "Float" => "Double",
        "Bool" => "Bool",
        "Bytes" => "Data",
        "DateTime" => "Date",
        "ID" => "String",
        _ => "Any",
    }
}

fn generate_swift_model(manifest: &serde_json::Value) -> String {
    let name = manifest["name"].as_str().unwrap_or("Unknown");
    let mut lines = vec![
        format!("// Generated Swift types for {}", name),
        "import Foundation".to_string(),
        String::new(),
    ];

    // Generate protocol from actions
    let actions = manifest["actions"].as_array();
    if let Some(acts) = actions {
        lines.push(format!("/// Protocol for {} operations.", name));
        lines.push(format!("public protocol {}Protocol {{", name));
        for action in acts {
            let action_name = action["name"].as_str().unwrap_or("unknown");
            lines.push(format!("    func {}() async throws -> {}Result", action_name, capitalize(action_name)));
        }
        lines.push("}".to_string());
        lines.push(String::new());

        // Result enums for each action
        for action in acts {
            let action_name = action["name"].as_str().unwrap_or("unknown");
            let cap_name = capitalize(action_name);
            lines.push(format!("public enum {}Result {{", cap_name));
            if let Some(variants) = action["variants"].as_array() {
                for variant in variants {
                    let tag = variant["tag"].as_str().unwrap_or("ok");
                    lines.push(format!("    case {}", tag));
                }
            }
            if actions.is_some() && action["variants"].as_array().map_or(true, |v| v.is_empty()) {
                lines.push("    case ok".to_string());
                lines.push("    case error(String)".to_string());
            }
            lines.push("}".to_string());
            lines.push(String::new());
        }
    }

    lines.join("\n")
}

fn generate_swift_test(manifest: &serde_json::Value) -> String {
    let name = manifest["name"].as_str().unwrap_or("Unknown");
    let mut lines = vec![
        format!("// Generated tests for {}", name),
        "import XCTest".to_string(),
        format!("@testable import {}", name),
        String::new(),
        format!("final class {}Tests: XCTestCase {{", name),
    ];

    if let Some(invariants) = manifest["invariants"].as_array() {
        for (i, inv) in invariants.iter().enumerate() {
            let desc = inv["description"].as_str().unwrap_or("invariant");
            lines.push(format!("    /// {}", desc));
            lines.push(format!("    func testInvariant{}() async throws {{", i + 1));
            lines.push(format!("        // TODO: Implement test for: {}", desc));
            lines.push("    }".to_string());
            lines.push(String::new());
        }
    }

    lines.push("}".to_string());
    lines.join("\n")
}

#[async_trait]
impl SwiftGenHandler for SwiftGenHandlerImpl {
    async fn generate(
        &self,
        input: SwiftGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SwiftGenGenerateOutput, Box<dyn std::error::Error>> {
        let manifest = &input.manifest;
        let name = manifest["name"].as_str().unwrap_or("");

        if name.is_empty() {
            return Ok(SwiftGenGenerateOutput::Error {
                message: "Invalid manifest: missing concept name".to_string(),
            });
        }

        let model_content = generate_swift_model(manifest);
        let test_content = generate_swift_test(manifest);

        let files = vec![
            json!({"path": format!("Sources/{}/{}.swift", name, name), "content": model_content}),
            json!({"path": format!("Tests/{}Tests/{}Tests.swift", name, name), "content": test_content}),
        ];

        Ok(SwiftGenGenerateOutput::Ok {
            files: files.iter().map(|f| serde_json::from_value(f.clone()).unwrap_or_default()).collect(),
        })
    }

    async fn register(
        &self,
        _input: SwiftGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SwiftGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(SwiftGenRegisterOutput::Ok {
            name: "SwiftGen".to_string(),
            input_kind: "ConceptManifest".to_string(),
            output_kind: "SwiftSource".to_string(),
            capabilities: vec!["protocols".to_string(), "structs".to_string(), "xctest".to_string()],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_with_valid_manifest() {
        let storage = InMemoryStorage::new();
        let handler = SwiftGenHandlerImpl;
        let result = handler.generate(
            SwiftGenGenerateInput {
                spec: "test-spec".to_string(),
                manifest: json!({
                    "name": "User",
                    "actions": [{"name": "create", "variants": []}],
                    "invariants": [{"description": "users must have names"}],
                }),
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftGenGenerateOutput::Ok { files } => {
                assert!(files.len() >= 2);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_with_missing_name() {
        let storage = InMemoryStorage::new();
        let handler = SwiftGenHandlerImpl;
        let result = handler.generate(
            SwiftGenGenerateInput {
                spec: "test-spec".to_string(),
                manifest: json!({}),
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftGenGenerateOutput::Error { message } => {
                assert!(message.contains("missing concept name"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = SwiftGenHandlerImpl;
        let result = handler.register(
            SwiftGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            SwiftGenRegisterOutput::Ok { name, input_kind, output_kind, capabilities } => {
                assert_eq!(name, "SwiftGen");
                assert_eq!(input_kind, "ConceptManifest");
                assert_eq!(output_kind, "SwiftSource");
                assert!(capabilities.contains(&"protocols".to_string()));
            },
        }
    }
}
