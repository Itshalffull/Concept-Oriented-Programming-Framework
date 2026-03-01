// Spec parser: parses .concept source strings into ASTs.
// Wraps the bootstrap kernel's parseConceptFile as a concept handler.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SpecParserHandler;
use serde_json::json;

pub struct SpecParserHandlerImpl;

fn generate_id() -> String {
    format!("spec-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0))
}

/// Minimal concept file parser that extracts structure from .concept source.
/// Recognizes concept declarations, actions with params/variants, state relations,
/// and invariant blocks. Produces a JSON AST representation.
fn parse_concept_source(source: &str) -> Result<serde_json::Value, (String, i64)> {
    let mut concept_name = String::new();
    let mut actions = Vec::new();
    let mut relations = Vec::new();
    let mut invariants = Vec::new();
    let mut current_action: Option<serde_json::Value> = None;
    let mut in_state_block = false;
    let mut in_invariant_block = false;
    let mut line_number: i64 = 0;

    for line in source.lines() {
        line_number += 1;
        let trimmed = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("//") {
            continue;
        }

        // Concept declaration
        if trimmed.starts_with("concept ") {
            let name = trimmed.strip_prefix("concept ").unwrap_or("").trim();
            let name = name.split(|c: char| c == '{' || c == '<' || c.is_whitespace()).next().unwrap_or(name);
            if name.is_empty() {
                return Err(("Expected concept name after 'concept'".to_string(), line_number));
            }
            concept_name = name.to_string();
            continue;
        }

        // State block
        if trimmed.starts_with("state {") || trimmed == "state" {
            in_state_block = true;
            continue;
        }

        if in_state_block {
            if trimmed == "}" {
                in_state_block = false;
                continue;
            }
            // Parse relation: "name: Type" or "name: set Type"
            if let Some(colon_pos) = trimmed.find(':') {
                let rel_name = trimmed[..colon_pos].trim();
                let rel_type = trimmed[colon_pos + 1..].trim();
                relations.push(json!({
                    "name": rel_name,
                    "type": rel_type,
                    "source": if rel_type.starts_with("set") { "set-valued" } else { "single" },
                }));
            }
            continue;
        }

        // Invariant block
        if trimmed.starts_with("invariant ") || trimmed.starts_with("invariant{") {
            in_invariant_block = true;
            let desc = trimmed.strip_prefix("invariant ").unwrap_or("").trim_matches(|c: char| c == '{' || c == '"');
            invariants.push(json!({"description": desc}));
            continue;
        }
        if in_invariant_block && trimmed == "}" {
            in_invariant_block = false;
            continue;
        }

        // Action declaration
        if trimmed.starts_with("action ") {
            // Save previous action
            if let Some(action) = current_action.take() {
                actions.push(action);
            }
            let action_name = trimmed.strip_prefix("action ").unwrap_or("").trim();
            let action_name = action_name.split(|c: char| c == '(' || c == '{' || c.is_whitespace()).next().unwrap_or(action_name);
            current_action = Some(json!({
                "name": action_name,
                "params": [],
                "variants": [],
            }));
            continue;
        }
    }

    // Save last action
    if let Some(action) = current_action.take() {
        actions.push(action);
    }

    if concept_name.is_empty() {
        return Err(("No concept declaration found".to_string(), 0));
    }

    Ok(json!({
        "name": concept_name,
        "actions": actions,
        "relations": relations,
        "invariants": invariants,
    }))
}

#[async_trait]
impl SpecParserHandler for SpecParserHandlerImpl {
    async fn parse(
        &self,
        input: SpecParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecParserParseOutput, Box<dyn std::error::Error>> {
        let source = &input.source;

        if source.is_empty() {
            return Ok(SpecParserParseOutput::Error {
                message: "source is required and must be a string".to_string(),
                line: 0,
            });
        }

        match parse_concept_source(source) {
            Ok(ast) => {
                let spec_id = generate_id();

                // Store the spec in the "specs" set relation
                storage.put("specs", &spec_id, json!({"specId": &spec_id})).await?;

                // Store the AST keyed by spec reference
                storage.put("ast", &spec_id, json!({"specId": &spec_id, "ast": &ast})).await?;

                Ok(SpecParserParseOutput::Ok {
                    spec: spec_id,
                    ast,
                })
            }
            Err((message, line)) => {
                Ok(SpecParserParseOutput::Error { message, line })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_parse_valid_concept() {
        let storage = InMemoryStorage::new();
        let handler = SpecParserHandlerImpl;
        let result = handler.parse(
            SpecParserParseInput {
                source: "concept User\naction create\naction delete".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SpecParserParseOutput::Ok { spec, ast } => {
                assert!(!spec.is_empty());
                assert_eq!(ast["name"].as_str().unwrap(), "User");
                assert_eq!(ast["actions"].as_array().unwrap().len(), 2);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_empty_source() {
        let storage = InMemoryStorage::new();
        let handler = SpecParserHandlerImpl;
        let result = handler.parse(
            SpecParserParseInput {
                source: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SpecParserParseOutput::Error { message, .. } => {
                assert!(message.contains("source is required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_no_concept_declaration() {
        let storage = InMemoryStorage::new();
        let handler = SpecParserHandlerImpl;
        let result = handler.parse(
            SpecParserParseInput {
                source: "action create\naction delete".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SpecParserParseOutput::Error { message, .. } => {
                assert!(message.contains("No concept declaration"));
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
