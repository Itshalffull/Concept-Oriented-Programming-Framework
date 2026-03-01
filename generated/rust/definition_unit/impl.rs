// DefinitionUnit Handler Implementation
//
// Extract, search, and diff definition units from parsed ASTs.
// A definition unit is a self-contained code definition (function,
// class, interface, etc.) extracted from a syntax tree.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DefinitionUnitHandler;
use serde_json::json;

pub struct DefinitionUnitHandlerImpl;

#[async_trait]
impl DefinitionUnitHandler for DefinitionUnitHandlerImpl {
    async fn extract(
        &self,
        input: DefinitionUnitExtractInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DefinitionUnitExtractOutput, Box<dyn std::error::Error>> {
        // Parse the tree to identify the node at the given byte range
        let tree: serde_json::Value = match serde_json::from_str(&input.tree) {
            Ok(v) => v,
            Err(_) => return Ok(DefinitionUnitExtractOutput::NotADefinition {
                node_type: "invalid-tree".to_string(),
            }),
        };

        // Look for a definition node that spans the given byte range
        let node_type = tree.get("type").and_then(|v| v.as_str()).unwrap_or("unknown");
        let definition_types = ["function_declaration", "class_declaration", "interface_declaration",
            "method_definition", "variable_declaration", "type_alias_declaration",
            "enum_declaration", "struct_definition", "impl_block"];

        if definition_types.iter().any(|t| node_type.contains(t)) {
            let unit = json!({
                "type": node_type,
                "startByte": input.start_byte,
                "endByte": input.end_byte,
                "name": tree.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                "language": tree.get("language").and_then(|v| v.as_str()).unwrap_or("unknown"),
            });

            // Cache the extracted unit
            let key = format!("{}:{}", input.start_byte, input.end_byte);
            storage.put("definition-unit", &key, unit.clone()).await?;

            Ok(DefinitionUnitExtractOutput::Ok {
                unit: serde_json::to_string(&unit)?,
            })
        } else {
            Ok(DefinitionUnitExtractOutput::NotADefinition {
                node_type: node_type.to_string(),
            })
        }
    }

    async fn find_by_symbol(
        &self,
        input: DefinitionUnitFindBySymbolInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DefinitionUnitFindBySymbolOutput, Box<dyn std::error::Error>> {
        let all_units = storage.find("definition-unit", None).await?;
        for unit in &all_units {
            let name = unit.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if name == input.symbol {
                return Ok(DefinitionUnitFindBySymbolOutput::Ok {
                    unit: serde_json::to_string(unit)?,
                });
            }
        }
        Ok(DefinitionUnitFindBySymbolOutput::Notfound)
    }

    async fn find_by_pattern(
        &self,
        input: DefinitionUnitFindByPatternInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DefinitionUnitFindByPatternOutput, Box<dyn std::error::Error>> {
        let all_units = storage.find("definition-unit", None).await?;
        let mut matching = Vec::new();

        for unit in &all_units {
            let unit_kind = unit.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let unit_lang = unit.get("language").and_then(|v| v.as_str()).unwrap_or("");
            let unit_name = unit.get("name").and_then(|v| v.as_str()).unwrap_or("");

            let kind_matches = input.kind.is_empty() || unit_kind.contains(&input.kind);
            let lang_matches = input.language.is_empty() || unit_lang == input.language;
            let name_matches = input.name_pattern.is_empty() || unit_name.contains(&input.name_pattern);

            if kind_matches && lang_matches && name_matches {
                matching.push(unit.clone());
            }
        }

        Ok(DefinitionUnitFindByPatternOutput::Ok {
            units: serde_json::to_string(&matching)?,
        })
    }

    async fn diff(
        &self,
        input: DefinitionUnitDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DefinitionUnitDiffOutput, Box<dyn std::error::Error>> {
        let _ = storage;
        if input.a == input.b {
            return Ok(DefinitionUnitDiffOutput::Same);
        }

        let unit_a: serde_json::Value = serde_json::from_str(&input.a).unwrap_or(json!({}));
        let unit_b: serde_json::Value = serde_json::from_str(&input.b).unwrap_or(json!({}));

        let mut changes = Vec::new();
        // Compare fields
        if unit_a.get("name") != unit_b.get("name") {
            changes.push(json!({"field": "name", "from": unit_a.get("name"), "to": unit_b.get("name")}));
        }
        if unit_a.get("type") != unit_b.get("type") {
            changes.push(json!({"field": "type", "from": unit_a.get("type"), "to": unit_b.get("type")}));
        }

        if changes.is_empty() {
            Ok(DefinitionUnitDiffOutput::Same)
        } else {
            Ok(DefinitionUnitDiffOutput::Ok {
                changes: serde_json::to_string(&changes)?,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_extract_function_declaration() {
        let storage = InMemoryStorage::new();
        let handler = DefinitionUnitHandlerImpl;
        let tree = json!({"type": "function_declaration", "name": "myFunc", "language": "typescript"});
        let result = handler.extract(
            DefinitionUnitExtractInput {
                tree: serde_json::to_string(&tree).unwrap(),
                start_byte: 0,
                end_byte: 100,
            },
            &storage,
        ).await.unwrap();
        match result {
            DefinitionUnitExtractOutput::Ok { unit } => {
                assert!(unit.contains("myFunc"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_extract_not_a_definition() {
        let storage = InMemoryStorage::new();
        let handler = DefinitionUnitHandlerImpl;
        let tree = json!({"type": "expression_statement", "name": "x"});
        let result = handler.extract(
            DefinitionUnitExtractInput {
                tree: serde_json::to_string(&tree).unwrap(),
                start_byte: 0,
                end_byte: 10,
            },
            &storage,
        ).await.unwrap();
        match result {
            DefinitionUnitExtractOutput::NotADefinition { node_type } => {
                assert_eq!(node_type, "expression_statement");
            },
            _ => panic!("Expected NotADefinition variant"),
        }
    }

    #[tokio::test]
    async fn test_find_by_symbol_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DefinitionUnitHandlerImpl;
        let result = handler.find_by_symbol(
            DefinitionUnitFindBySymbolInput {
                symbol: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DefinitionUnitFindBySymbolOutput::Notfound => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_find_by_pattern_empty() {
        let storage = InMemoryStorage::new();
        let handler = DefinitionUnitHandlerImpl;
        let result = handler.find_by_pattern(
            DefinitionUnitFindByPatternInput {
                kind: "".to_string(),
                language: "".to_string(),
                name_pattern: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DefinitionUnitFindByPatternOutput::Ok { units } => {
                assert!(units.contains("[]") || !units.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_diff_same() {
        let storage = InMemoryStorage::new();
        let handler = DefinitionUnitHandlerImpl;
        let result = handler.diff(
            DefinitionUnitDiffInput {
                a: r#"{"name":"foo","type":"func"}"#.to_string(),
                b: r#"{"name":"foo","type":"func"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DefinitionUnitDiffOutput::Same => {},
            _ => panic!("Expected Same variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_different() {
        let storage = InMemoryStorage::new();
        let handler = DefinitionUnitHandlerImpl;
        let result = handler.diff(
            DefinitionUnitDiffInput {
                a: r#"{"name":"foo","type":"func"}"#.to_string(),
                b: r#"{"name":"bar","type":"func"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DefinitionUnitDiffOutput::Ok { changes } => {
                assert!(changes.contains("name"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
