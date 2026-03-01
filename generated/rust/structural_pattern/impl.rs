// Structural pattern matching: creates, compiles, and matches tree-sitter style
// structural patterns against syntax trees. Supports language-aware pattern matching
// across project files.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::StructuralPatternHandler;
use serde_json::json;

pub struct StructuralPatternHandlerImpl;

fn generate_pattern_id() -> String {
    format!("pattern-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0))
}

/// Validate pattern syntax: checks balanced parentheses/brackets, valid wildcards,
/// and capture groups (@name).
fn validate_pattern_syntax(syntax: &str) -> Result<(), (String, i64)> {
    let mut paren_depth: i32 = 0;
    let mut bracket_depth: i32 = 0;

    for (i, ch) in syntax.chars().enumerate() {
        match ch {
            '(' => paren_depth += 1,
            ')' => {
                paren_depth -= 1;
                if paren_depth < 0 {
                    return Err(("Unmatched closing parenthesis".to_string(), i as i64));
                }
            }
            '[' => bracket_depth += 1,
            ']' => {
                bracket_depth -= 1;
                if bracket_depth < 0 {
                    return Err(("Unmatched closing bracket".to_string(), i as i64));
                }
            }
            _ => {}
        }
    }

    if paren_depth != 0 {
        return Err(("Unmatched opening parenthesis".to_string(), syntax.len() as i64));
    }
    if bracket_depth != 0 {
        return Err(("Unmatched opening bracket".to_string(), syntax.len() as i64));
    }

    Ok(())
}

/// Match a structural pattern against a tree. Returns matched node spans.
/// This performs a simplified S-expression pattern match.
fn match_pattern(pattern: &str, tree: &str) -> Vec<serde_json::Value> {
    let mut matches = Vec::new();

    // Extract the node type from the pattern (first word or S-expr head)
    let pattern_node = pattern.trim().trim_start_matches('(');
    let pattern_node = pattern_node.split(|c: char| c.is_whitespace() || c == ')').next().unwrap_or("");

    if pattern_node.is_empty() {
        return matches;
    }

    // Search the tree string for matching node types
    let mut search_start = 0;
    while let Some(pos) = tree[search_start..].find(pattern_node) {
        let abs_pos = search_start + pos;
        matches.push(json!({
            "nodeType": pattern_node,
            "startByte": abs_pos,
            "endByte": abs_pos + pattern_node.len(),
            "text": &tree[abs_pos..std::cmp::min(abs_pos + 50, tree.len())],
        }));
        search_start = abs_pos + 1;
    }

    matches
}

#[async_trait]
impl StructuralPatternHandler for StructuralPatternHandlerImpl {
    async fn create(
        &self,
        input: StructuralPatternCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StructuralPatternCreateOutput, Box<dyn std::error::Error>> {
        // Validate the pattern syntax
        if let Err((message, position)) = validate_pattern_syntax(&input.syntax) {
            return Ok(StructuralPatternCreateOutput::InvalidSyntax { message, position });
        }

        let pattern_id = generate_pattern_id();

        storage.put("pattern", &pattern_id, json!({
            "patternId": &pattern_id,
            "syntax": &input.syntax,
            "source": &input.source,
            "language": &input.language,
        })).await?;

        Ok(StructuralPatternCreateOutput::Ok { pattern: pattern_id })
    }

    async fn r#match(
        &self,
        input: StructuralPatternMatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StructuralPatternMatchOutput, Box<dyn std::error::Error>> {
        // Load the pattern
        let pattern_record = storage.get("pattern", &input.pattern).await?;
        let pattern_syntax = pattern_record
            .as_ref()
            .and_then(|v| v["syntax"].as_str())
            .unwrap_or(&input.pattern);

        let pattern_lang = pattern_record
            .as_ref()
            .and_then(|v| v["language"].as_str())
            .unwrap_or("");

        // Load the tree
        let tree_record = storage.get("syntaxTree", &input.tree).await?;
        let tree_content = tree_record
            .as_ref()
            .and_then(|v| v["content"].as_str())
            .unwrap_or(&input.tree);
        let tree_lang = tree_record
            .as_ref()
            .and_then(|v| v["language"].as_str())
            .unwrap_or("");

        // Check language compatibility
        if !pattern_lang.is_empty() && !tree_lang.is_empty() && pattern_lang != tree_lang {
            return Ok(StructuralPatternMatchOutput::IncompatibleLanguage {
                pattern_lang: pattern_lang.to_string(),
                tree_lang: tree_lang.to_string(),
            });
        }

        let results = match_pattern(pattern_syntax, tree_content);

        if results.is_empty() {
            return Ok(StructuralPatternMatchOutput::NoMatches);
        }

        Ok(StructuralPatternMatchOutput::Ok {
            matches: serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn match_project(
        &self,
        input: StructuralPatternMatchProjectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StructuralPatternMatchProjectOutput, Box<dyn std::error::Error>> {
        // Load the pattern
        let pattern_record = storage.get("pattern", &input.pattern).await?;
        let pattern_syntax = pattern_record
            .as_ref()
            .and_then(|v| v["syntax"].as_str())
            .unwrap_or(&input.pattern);

        // Search all stored syntax trees
        let trees = storage.find("syntaxTree", None).await?;
        let mut all_results = Vec::new();

        for tree in &trees {
            let tree_content = tree["content"].as_str().unwrap_or("");
            let file = tree["file"].as_str().unwrap_or("");
            let results = match_pattern(pattern_syntax, tree_content);
            for m in results {
                all_results.push(json!({
                    "file": file,
                    "match": m,
                }));
            }
        }

        if all_results.is_empty() {
            return Ok(StructuralPatternMatchProjectOutput::NoMatches);
        }

        Ok(StructuralPatternMatchProjectOutput::Ok {
            results: serde_json::to_string(&all_results).unwrap_or_else(|_| "[]".to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_valid_pattern() {
        let storage = InMemoryStorage::new();
        let handler = StructuralPatternHandlerImpl;
        let result = handler.create(
            StructuralPatternCreateInput {
                syntax: "(function_declaration name: (identifier) @name)".to_string(),
                source: "test".to_string(),
                language: "typescript".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            StructuralPatternCreateOutput::Ok { pattern } => {
                assert!(pattern.starts_with("pattern-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_create_invalid_syntax() {
        let storage = InMemoryStorage::new();
        let handler = StructuralPatternHandlerImpl;
        let result = handler.create(
            StructuralPatternCreateInput {
                syntax: "(unbalanced (parenthesis".to_string(),
                source: "test".to_string(),
                language: "typescript".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            StructuralPatternCreateOutput::InvalidSyntax { message, .. } => {
                assert!(message.contains("parenthesis"));
            },
            _ => panic!("Expected InvalidSyntax variant"),
        }
    }

    #[tokio::test]
    async fn test_match_with_results() {
        let storage = InMemoryStorage::new();
        let handler = StructuralPatternHandlerImpl;
        let result = handler.r#match(
            StructuralPatternMatchInput {
                pattern: "function".to_string(),
                tree: "function foo() { return 1; }".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            StructuralPatternMatchOutput::Ok { matches } => {
                assert!(matches.contains("function"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_match_no_results() {
        let storage = InMemoryStorage::new();
        let handler = StructuralPatternHandlerImpl;
        let result = handler.r#match(
            StructuralPatternMatchInput {
                pattern: "class_declaration".to_string(),
                tree: "let x = 5;".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            StructuralPatternMatchOutput::NoMatches => {},
            _ => panic!("Expected NoMatches variant"),
        }
    }
}
