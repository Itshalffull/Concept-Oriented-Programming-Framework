// SyntaxTree concept implementation
// Manages parsed syntax trees with incremental reparsing support.
// Stores trees keyed by ID, supports S-expression queries,
// node-at-offset lookup, and incremental edit application.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyntaxTreeHandler;
use serde_json::json;

pub struct SyntaxTreeHandlerImpl;

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("tree-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl SyntaxTreeHandler for SyntaxTreeHandlerImpl {
    async fn parse(
        &self,
        input: SyntaxTreeParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeParseOutput, Box<dyn std::error::Error>> {
        let file = &input.file;
        let grammar = &input.grammar;

        // Validate grammar is known
        let grammar_record = storage.get("grammar", grammar).await?;
        if grammar_record.is_none() {
            // Register as ad-hoc grammar for now
            storage.put("grammar", grammar, json!({
                "name": grammar,
                "status": "registered",
            })).await?;
        }

        let tree_id = generate_id();

        // Simulate parsing - count potential error nodes
        // In a real implementation this would use tree-sitter
        let error_count = 0i64; // No errors in simulated parse

        let byte_length = file.len() as i64;

        storage.put("syntax_tree", &tree_id, json!({
            "treeId": &tree_id,
            "source": file,
            "grammar": grammar,
            "byteLength": byte_length,
            "editVersion": 0,
            "errorCount": error_count,
            "errorRanges": "[]",
        })).await?;

        if error_count > 0 {
            Ok(SyntaxTreeParseOutput::ParseError {
                tree: tree_id,
                error_count,
            })
        } else {
            Ok(SyntaxTreeParseOutput::Ok { tree: tree_id })
        }
    }

    async fn reparse(
        &self,
        input: SyntaxTreeReparseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeReparseOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("syntax_tree", &input.tree).await?;
        let existing = match existing {
            Some(e) => e,
            None => {
                return Ok(SyntaxTreeReparseOutput::Notfound {
                    message: format!("Tree \"{}\" not found", input.tree),
                });
            }
        };

        let source = existing.get("source")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let grammar = existing.get("grammar")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let edit_version = existing.get("editVersion")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        // Apply the edit to the source
        let start = input.start_byte as usize;
        let old_end = input.old_end_byte as usize;
        let new_text = &input.new_text;

        let new_source = if start <= source.len() && old_end <= source.len() {
            let mut s = source.clone();
            let end = old_end.min(s.len());
            s.replace_range(start..end, new_text);
            s
        } else {
            source.clone()
        };

        let new_byte_length = new_source.len() as i64;
        let new_version = edit_version + 1;

        storage.put("syntax_tree", &input.tree, json!({
            "treeId": &input.tree,
            "source": &new_source,
            "grammar": &grammar,
            "byteLength": new_byte_length,
            "editVersion": new_version,
            "errorCount": 0,
            "errorRanges": "[]",
        })).await?;

        Ok(SyntaxTreeReparseOutput::Ok {
            tree: input.tree.clone(),
        })
    }

    async fn query(
        &self,
        input: SyntaxTreeQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeQueryOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("syntax_tree", &input.tree).await?;
        if existing.is_none() {
            return Ok(SyntaxTreeQueryOutput::Notfound {
                message: format!("Tree \"{}\" not found", input.tree),
            });
        }

        let pattern = &input.pattern;

        // Validate pattern syntax (basic check)
        if pattern.is_empty() {
            return Ok(SyntaxTreeQueryOutput::InvalidPattern {
                message: "Query pattern cannot be empty".to_string(),
            });
        }

        // Check for balanced parentheses (basic S-expression validation)
        let open_count = pattern.chars().filter(|&c| c == '(').count();
        let close_count = pattern.chars().filter(|&c| c == ')').count();
        if open_count != close_count {
            return Ok(SyntaxTreeQueryOutput::InvalidPattern {
                message: format!(
                    "Unbalanced parentheses: {} open vs {} close",
                    open_count, close_count
                ),
            });
        }

        // In a real implementation this would run tree-sitter queries.
        // Return empty matches for now with the structure expected.
        Ok(SyntaxTreeQueryOutput::Ok {
            matches: "[]".to_string(),
        })
    }

    async fn node_at(
        &self,
        input: SyntaxTreeNodeAtInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeNodeAtOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("syntax_tree", &input.tree).await?;
        let existing = match existing {
            Some(e) => e,
            None => {
                return Ok(SyntaxTreeNodeAtOutput::Notfound {
                    message: format!("Tree \"{}\" not found", input.tree),
                });
            }
        };

        let byte_length = existing.get("byteLength")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        if input.byte_offset < 0 || input.byte_offset >= byte_length {
            return Ok(SyntaxTreeNodeAtOutput::OutOfRange);
        }

        // In a real implementation, this would walk the tree-sitter CST.
        // Return a simulated root node for the offset.
        let source = existing.get("source")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let offset = input.byte_offset as usize;

        // Determine basic node type from content at offset
        let node_type = if offset < source.len() {
            let ch = source.as_bytes()[offset];
            match ch {
                b'{' | b'}' => "punctuation",
                b'(' | b')' => "punctuation",
                b'"' | b'\'' => "string",
                b'0'..=b'9' => "number",
                b' ' | b'\t' | b'\n' | b'\r' => "whitespace",
                _ => "identifier",
            }
        } else {
            "unknown"
        };

        Ok(SyntaxTreeNodeAtOutput::Ok {
            node_type: node_type.to_string(),
            start_byte: input.byte_offset,
            end_byte: (input.byte_offset + 1).min(byte_length),
            named: "true".to_string(),
            field: "".to_string(),
        })
    }

    async fn get(
        &self,
        input: SyntaxTreeGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyntaxTreeGetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("syntax_tree", &input.tree).await?;

        match existing {
            Some(e) => {
                let tree = e.get("treeId").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let source = e.get("source").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let grammar = e.get("grammar").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let byte_length = e.get("byteLength").and_then(|v| v.as_i64()).unwrap_or(0);
                let edit_version = e.get("editVersion").and_then(|v| v.as_i64()).unwrap_or(0);
                let error_ranges = e.get("errorRanges").and_then(|v| v.as_str()).unwrap_or("[]").to_string();

                Ok(SyntaxTreeGetOutput::Ok {
                    tree,
                    source,
                    grammar,
                    byte_length,
                    edit_version,
                    error_ranges,
                })
            }
            None => {
                Ok(SyntaxTreeGetOutput::Notfound {
                    message: format!("Tree \"{}\" not found", input.tree),
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_parse() {
        let storage = InMemoryStorage::new();
        let handler = SyntaxTreeHandlerImpl;
        let result = handler.parse(
            SyntaxTreeParseInput {
                file: "fn main() { println!(\"hello\"); }".to_string(),
                grammar: "rust".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyntaxTreeParseOutput::Ok { tree } => {
                assert!(tree.starts_with("tree-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_reparse() {
        let storage = InMemoryStorage::new();
        let handler = SyntaxTreeHandlerImpl;
        let tree_id = match handler.parse(
            SyntaxTreeParseInput { file: "let x = 5;".to_string(), grammar: "javascript".to_string() },
            &storage,
        ).await.unwrap() {
            SyntaxTreeParseOutput::Ok { tree } => tree,
            _ => panic!("Expected Ok"),
        };
        let result = handler.reparse(
            SyntaxTreeReparseInput {
                tree: tree_id.clone(),
                start_byte: 8,
                old_end_byte: 9,
                new_end_byte: 10,
                new_text: "10".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyntaxTreeReparseOutput::Ok { tree } => {
                assert_eq!(tree, tree_id);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_reparse_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyntaxTreeHandlerImpl;
        let result = handler.reparse(
            SyntaxTreeReparseInput {
                tree: "nonexistent".to_string(),
                start_byte: 0, old_end_byte: 0, new_end_byte: 0,
                new_text: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyntaxTreeReparseOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_query_empty_pattern() {
        let storage = InMemoryStorage::new();
        let handler = SyntaxTreeHandlerImpl;
        let tree_id = match handler.parse(
            SyntaxTreeParseInput { file: "let x = 5;".to_string(), grammar: "js".to_string() },
            &storage,
        ).await.unwrap() {
            SyntaxTreeParseOutput::Ok { tree } => tree,
            _ => panic!("Expected Ok"),
        };
        let result = handler.query(
            SyntaxTreeQueryInput { tree: tree_id, pattern: "".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyntaxTreeQueryOutput::InvalidPattern { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected InvalidPattern variant"),
        }
    }

    #[tokio::test]
    async fn test_query_unbalanced_parens() {
        let storage = InMemoryStorage::new();
        let handler = SyntaxTreeHandlerImpl;
        let tree_id = match handler.parse(
            SyntaxTreeParseInput { file: "code".to_string(), grammar: "js".to_string() },
            &storage,
        ).await.unwrap() {
            SyntaxTreeParseOutput::Ok { tree } => tree,
            _ => panic!("Expected Ok"),
        };
        let result = handler.query(
            SyntaxTreeQueryInput { tree: tree_id, pattern: "((identifier)".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyntaxTreeQueryOutput::InvalidPattern { .. } => {},
            _ => panic!("Expected InvalidPattern variant"),
        }
    }

    #[tokio::test]
    async fn test_node_at_out_of_range() {
        let storage = InMemoryStorage::new();
        let handler = SyntaxTreeHandlerImpl;
        let tree_id = match handler.parse(
            SyntaxTreeParseInput { file: "abc".to_string(), grammar: "text".to_string() },
            &storage,
        ).await.unwrap() {
            SyntaxTreeParseOutput::Ok { tree } => tree,
            _ => panic!("Expected Ok"),
        };
        let result = handler.node_at(
            SyntaxTreeNodeAtInput { tree: tree_id, byte_offset: 100 },
            &storage,
        ).await.unwrap();
        match result {
            SyntaxTreeNodeAtOutput::OutOfRange => {},
            _ => panic!("Expected OutOfRange variant"),
        }
    }

    #[tokio::test]
    async fn test_get_existing() {
        let storage = InMemoryStorage::new();
        let handler = SyntaxTreeHandlerImpl;
        let tree_id = match handler.parse(
            SyntaxTreeParseInput { file: "hello".to_string(), grammar: "text".to_string() },
            &storage,
        ).await.unwrap() {
            SyntaxTreeParseOutput::Ok { tree } => tree,
            _ => panic!("Expected Ok"),
        };
        let result = handler.get(
            SyntaxTreeGetInput { tree: tree_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            SyntaxTreeGetOutput::Ok { tree, grammar, .. } => {
                assert_eq!(tree, tree_id);
                assert_eq!(grammar, "text");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyntaxTreeHandlerImpl;
        let result = handler.get(
            SyntaxTreeGetInput { tree: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyntaxTreeGetOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
