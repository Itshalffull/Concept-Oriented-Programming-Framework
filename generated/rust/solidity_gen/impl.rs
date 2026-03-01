// Solidity code generation from ConceptManifest.
// Generates Solidity contract skeletons with storage layout, events, and Foundry test harness.
// See architecture doc: code generation targets.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SolidityGenHandler;
use serde_json::json;

pub struct SolidityGenHandlerImpl;

/// Maps a resolved type kind to its Solidity equivalent.
fn type_to_solidity(type_expr: &str) -> &str {
    match type_expr {
        "String" => "string",
        "Int" => "int256",
        "Float" => "uint256",
        "Bool" => "bool",
        "Bytes" => "bytes",
        "DateTime" => "uint256",
        "ID" => "bytes32",
        _ => "bytes",
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
    }
}

fn camel_case(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_lowercase().to_string() + chars.as_str(),
    }
}

fn generate_contract(manifest: &serde_json::Value) -> String {
    let name = manifest["name"].as_str().unwrap_or("Unknown");
    let actions = manifest["actions"].as_array();
    let relations = manifest["relations"].as_array();

    let mut lines = vec![
        "// SPDX-License-Identifier: MIT".to_string(),
        "pragma solidity ^0.8.20;".to_string(),
        String::new(),
        format!("/// @title {}", name),
        format!("/// @notice Generated from {} concept specification", name),
        "/// @dev Skeleton contract -- implement action bodies".to_string(),
        String::new(),
        format!("contract {} {{", name),
        String::new(),
    ];

    // Storage variables from relations
    if let Some(rels) = relations {
        lines.push("    // --- Storage (from concept state) ---".to_string());
        lines.push(String::new());
        for rel in rels {
            let rel_name = rel["name"].as_str().unwrap_or("data");
            lines.push(format!("    mapping(bytes32 => bytes) private {};", camel_case(rel_name)));
        }
        lines.push(String::new());
    }

    // Events and functions for each action
    if let Some(acts) = actions {
        lines.push("    // --- Events ---".to_string());
        lines.push(String::new());
        for action in acts {
            let action_name = action["name"].as_str().unwrap_or("unknown");
            lines.push(format!("    event {}Completed(string variant);", capitalize(action_name)));
        }
        lines.push(String::new());
        lines.push("    // --- Actions ---".to_string());
        lines.push(String::new());
        for action in acts {
            let action_name = action["name"].as_str().unwrap_or("unknown");
            lines.push(format!("    /// @notice {}", action_name));
            lines.push(format!("    function {}() external returns (bool) {{", camel_case(action_name)));
            lines.push(format!("        // TODO: Implement {}", action_name));
            lines.push("        revert(\"Not implemented\");".to_string());
            lines.push("    }".to_string());
            lines.push(String::new());
        }
    }

    lines.push("}".to_string());
    lines.join("\n")
}

fn generate_foundry_test(manifest: &serde_json::Value) -> Option<String> {
    let name = manifest["name"].as_str().unwrap_or("Unknown");
    let invariants = manifest["invariants"].as_array()?;
    if invariants.is_empty() {
        return None;
    }

    let mut lines = vec![
        "// SPDX-License-Identifier: MIT".to_string(),
        "pragma solidity ^0.8.20;".to_string(),
        String::new(),
        "import \"forge-std/Test.sol\";".to_string(),
        format!("import \"../src/{}.sol\";", name),
        String::new(),
        format!("contract {}Test is Test {{", name),
        format!("    {} public target;", name),
        String::new(),
        "    function setUp() public {".to_string(),
        format!("        target = new {}();", name),
        "    }".to_string(),
        String::new(),
    ];

    for (i, inv) in invariants.iter().enumerate() {
        let desc = inv["description"].as_str().unwrap_or("invariant");
        lines.push(format!("    /// @notice {}", desc));
        lines.push(format!("    function test_invariant_{}() public {{", i + 1));
        lines.push(format!("        // TODO: Implement test for: {}", desc));
        lines.push("    }".to_string());
        lines.push(String::new());
    }

    lines.push("}".to_string());
    Some(lines.join("\n"))
}

#[async_trait]
impl SolidityGenHandler for SolidityGenHandlerImpl {
    async fn generate(
        &self,
        input: SolidityGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidityGenGenerateOutput, Box<dyn std::error::Error>> {
        let manifest = &input.manifest;
        let name = manifest["name"].as_str().unwrap_or("");

        if name.is_empty() {
            return Ok(SolidityGenGenerateOutput::Error {
                message: "Invalid manifest: missing concept name".to_string(),
            });
        }

        let contract_content = generate_contract(manifest);
        let mut files = vec![json!({
            "path": format!("src/{}.sol", name),
            "content": contract_content,
        })];

        if let Some(test_content) = generate_foundry_test(manifest) {
            files.push(json!({
                "path": format!("test/{}.t.sol", name),
                "content": test_content,
            }));
        }

        Ok(SolidityGenGenerateOutput::Ok {
            files: files.iter().map(|f| serde_json::from_value(f.clone()).unwrap_or_default()).collect(),
        })
    }

    async fn register(
        &self,
        _input: SolidityGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<SolidityGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(SolidityGenRegisterOutput::Ok {
            name: "SolidityGen".to_string(),
            input_kind: "ConceptManifest".to_string(),
            output_kind: "SoliditySource".to_string(),
            capabilities: vec!["contract".to_string(), "events".to_string(), "foundry-tests".to_string()],
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
        let handler = SolidityGenHandlerImpl;
        let result = handler.generate(
            SolidityGenGenerateInput {
                spec: "test-spec".to_string(),
                manifest: json!({
                    "name": "Token",
                    "actions": [{"name": "transfer"}, {"name": "approve"}],
                    "relations": [{"name": "balances"}],
                    "invariants": [{"description": "total supply is constant"}],
                }),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidityGenGenerateOutput::Ok { files } => {
                assert!(files.len() >= 1);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_with_missing_name() {
        let storage = InMemoryStorage::new();
        let handler = SolidityGenHandlerImpl;
        let result = handler.generate(
            SolidityGenGenerateInput {
                spec: "test-spec".to_string(),
                manifest: json!({}),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidityGenGenerateOutput::Error { message } => {
                assert!(message.contains("missing concept name"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = SolidityGenHandlerImpl;
        let result = handler.register(
            SolidityGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            SolidityGenRegisterOutput::Ok { name, input_kind, output_kind, capabilities } => {
                assert_eq!(name, "SolidityGen");
                assert_eq!(input_kind, "ConceptManifest");
                assert_eq!(output_kind, "SoliditySource");
                assert!(capabilities.contains(&"contract".to_string()));
            },
        }
    }
}
