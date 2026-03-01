// SyncParser concept implementation
// Parses sync specification source files into ASTs.
// Validates syntax, resolves concept references against manifests,
// and produces structured sync ASTs for the compiler.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncParserHandler;
use serde_json::json;

pub struct SyncParserHandlerImpl;

#[async_trait]
impl SyncParserHandler for SyncParserHandlerImpl {
    async fn parse(
        &self,
        input: SyncParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncParserParseOutput, Box<dyn std::error::Error>> {
        let source = &input.source;
        let manifests = &input.manifests;

        if source.trim().is_empty() {
            return Ok(SyncParserParseOutput::Error {
                message: "Sync source is empty".to_string(),
                line: 0,
            });
        }

        // Build a lookup of known concept URIs from manifests
        let known_concepts: std::collections::HashSet<String> = manifests.iter()
            .filter_map(|m| m.get("concept").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        let lines: Vec<&str> = source.lines().collect();
        let mut sync_name = String::new();
        let mut when_patterns = Vec::new();
        let mut then_actions = Vec::new();
        let mut where_clauses = Vec::new();
        let mut current_section = "";

        for (line_num, line) in lines.iter().enumerate() {
            let trimmed = line.trim();

            // Skip comments and empty lines
            if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with('#') {
                continue;
            }

            // Parse sync declaration
            if trimmed.starts_with("sync ") {
                sync_name = trimmed.trim_start_matches("sync ")
                    .trim()
                    .trim_matches('"')
                    .to_string();
                continue;
            }

            // Section markers
            if trimmed == "when:" || trimmed == "when" {
                current_section = "when";
                continue;
            }
            if trimmed == "then:" || trimmed == "then" {
                current_section = "then";
                continue;
            }
            if trimmed == "where:" || trimmed == "where" {
                current_section = "where";
                continue;
            }

            match current_section {
                "when" => {
                    // Parse when-clause patterns like: Concept.action -> variant
                    if let Some(dot_pos) = trimmed.find('.') {
                        let concept = trimmed[..dot_pos].trim().to_string();

                        // Validate concept exists in manifests (if manifests provided)
                        if !manifests.is_empty() && !known_concepts.contains(&concept) {
                            return Ok(SyncParserParseOutput::Error {
                                message: format!("Unknown concept \"{}\"", concept),
                                line: (line_num + 1) as i64,
                            });
                        }

                        let rest = &trimmed[dot_pos + 1..];
                        let (action, variant) = if let Some(arrow_pos) = rest.find("->") {
                            (rest[..arrow_pos].trim().to_string(), rest[arrow_pos + 2..].trim().to_string())
                        } else {
                            (rest.trim().to_string(), "*".to_string())
                        };

                        when_patterns.push(json!({
                            "concept": concept,
                            "action": action,
                            "variant": variant,
                            "inputFields": [],
                            "outputFields": [],
                        }));
                    }
                }
                "then" => {
                    // Parse then-clause actions like: Concept.action(fields)
                    if let Some(dot_pos) = trimmed.find('.') {
                        let concept = trimmed[..dot_pos].trim().to_string();
                        let rest = &trimmed[dot_pos + 1..];
                        let action = rest.trim_end_matches(|c: char| c == '(' || c == ')' || c.is_whitespace())
                            .to_string();

                        then_actions.push(json!({
                            "concept": concept,
                            "action": action,
                            "fields": [],
                        }));
                    }
                }
                "where" => {
                    // Parse where-clause entries
                    if trimmed.starts_with("let ") || trimmed.starts_with("bind ") {
                        let parts: Vec<&str> = trimmed.splitn(4, ' ').collect();
                        if parts.len() >= 3 {
                            where_clauses.push(json!({
                                "type": "bind",
                                "as": parts[1],
                                "expr": parts.get(3).unwrap_or(&""),
                            }));
                        }
                    }
                }
                _ => {
                    // Unexpected content before any section
                    if !sync_name.is_empty() {
                        return Ok(SyncParserParseOutput::Error {
                            message: format!("Unexpected content outside of when/then/where section: \"{}\"", trimmed),
                            line: (line_num + 1) as i64,
                        });
                    }
                }
            }
        }

        if sync_name.is_empty() {
            return Ok(SyncParserParseOutput::Error {
                message: "No sync declaration found".to_string(),
                line: 1,
            });
        }

        let ast = json!({
            "name": &sync_name,
            "when": when_patterns,
            "where": where_clauses,
            "then": then_actions,
            "annotations": {},
        });

        // Store the parsed AST
        storage.put("parsed_sync", &sync_name, json!({
            "name": &sync_name,
            "source": source,
            "ast": &ast,
        })).await?;

        Ok(SyncParserParseOutput::Ok {
            sync: sync_name,
            ast,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_parse_valid_sync() {
        let storage = InMemoryStorage::new();
        let handler = SyncParserHandlerImpl;
        let result = handler.parse(
            SyncParserParseInput {
                source: "sync \"UserFollow\"\nwhen:\n  User.follow -> ok\nthen:\n  Follow.create".to_string(),
                manifests: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncParserParseOutput::Ok { sync, ast } => {
                assert_eq!(sync, "UserFollow");
                assert!(ast["when"].as_array().unwrap().len() > 0);
                assert!(ast["then"].as_array().unwrap().len() > 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_empty_source() {
        let storage = InMemoryStorage::new();
        let handler = SyncParserHandlerImpl;
        let result = handler.parse(
            SyncParserParseInput {
                source: "".to_string(),
                manifests: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncParserParseOutput::Error { message, .. } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_no_sync_declaration() {
        let storage = InMemoryStorage::new();
        let handler = SyncParserHandlerImpl;
        let result = handler.parse(
            SyncParserParseInput {
                source: "when:\n  User.create -> ok".to_string(),
                manifests: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncParserParseOutput::Error { message, .. } => {
                assert!(message.contains("No sync declaration"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_with_unknown_concept() {
        let storage = InMemoryStorage::new();
        let handler = SyncParserHandlerImpl;
        let result = handler.parse(
            SyncParserParseInput {
                source: "sync \"Test\"\nwhen:\n  Unknown.create -> ok\nthen:\n  Other.do".to_string(),
                manifests: vec![json!({"concept": "KnownConcept"})],
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncParserParseOutput::Error { message, .. } => {
                assert!(message.contains("Unknown concept"));
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
