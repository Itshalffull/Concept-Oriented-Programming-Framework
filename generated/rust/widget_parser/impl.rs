// WidgetParser Handler Implementation
//
// Parses widget source definitions into an AST and validates completeness.
// Checks for required widget fields (name, template/render/children) and
// optional completeness properties (props, styles, accessibility, slots, events).

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WidgetParserHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id(prefix: &str) -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("{}-{}", prefix, n)
}

pub struct WidgetParserHandlerImpl;

#[async_trait]
impl WidgetParserHandler for WidgetParserHandlerImpl {
    async fn parse(
        &self,
        input: WidgetParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetParserParseOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;
        let source = &input.source;

        let id = if widget.is_empty() {
            next_id("W")
        } else {
            widget.clone()
        };

        let ast: serde_json::Value = match serde_json::from_str(source) {
            Ok(v) => v,
            Err(e) => {
                return Ok(WidgetParserParseOutput::Error {
                    widget: id,
                    errors: vec![e.to_string()],
                });
            }
        };

        let mut errors = Vec::new();

        // Validate required widget fields
        if ast.get("name").is_none() || ast.get("name").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
            errors.push("Widget must have a \"name\" field".to_string());
        }

        if ast.get("template").is_none() && ast.get("render").is_none() && ast.get("children").is_none() {
            errors.push("Widget must have at least one of \"template\", \"render\", or \"children\"".to_string());
        }

        if !errors.is_empty() {
            return Ok(WidgetParserParseOutput::Error {
                widget: id,
                errors,
            });
        }

        let ast_str = serde_json::to_string(&ast)?;

        storage.put("widgetParser", &id, json!({
            "source": source,
            "ast": ast_str,
            "errors": [],
            "version": 1
        })).await?;

        Ok(WidgetParserParseOutput::Ok {
            widget: id,
            ast: ast_str,
        })
    }

    async fn validate(
        &self,
        input: WidgetParserValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetParserValidateOutput, Box<dyn std::error::Error>> {
        let widget = &input.widget;

        let existing = storage.get("widgetParser", widget).await?;
        if existing.is_null() {
            return Ok(WidgetParserValidateOutput::Incomplete {
                widget: widget.clone(),
                warnings: vec!["Widget not found; parse a widget first".to_string()],
            });
        }

        let ast_str = existing.get("ast")
            .and_then(|v| v.as_str())
            .unwrap_or("{}");
        let ast: serde_json::Value = serde_json::from_str(ast_str).unwrap_or(json!({}));
        let mut warnings = Vec::new();

        // Check for common completeness issues
        match ast.get("props") {
            None => warnings.push("Widget has no props defined".to_string()),
            Some(v) => if let Some(arr) = v.as_array() {
                if arr.is_empty() {
                    warnings.push("Widget has no props defined".to_string());
                }
            },
        }

        if ast.get("styles").is_none() && ast.get("className").is_none() {
            warnings.push("Widget has no styling information".to_string());
        }

        if ast.get("accessibility").is_none() && ast.get("aria").is_none() {
            warnings.push("Widget has no accessibility attributes defined".to_string());
        }

        if ast.get("slots").is_none() && ast.get("children").is_none() {
            warnings.push("Widget has no slot or children composition defined".to_string());
        }

        if ast.get("events").is_none() && ast.get("handlers").is_none() {
            warnings.push("Widget has no event handlers defined".to_string());
        }

        if !warnings.is_empty() {
            return Ok(WidgetParserValidateOutput::Incomplete {
                widget: widget.clone(),
                warnings,
            });
        }

        Ok(WidgetParserValidateOutput::Ok {
            widget: widget.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_parse_success() {
        let storage = InMemoryStorage::new();
        let handler = WidgetParserHandlerImpl;
        let result = handler.parse(
            WidgetParserParseInput {
                widget: "btn".to_string(),
                source: r#"{"name":"Button","template":"<button>{{label}}</button>"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetParserParseOutput::Ok { widget, ast } => {
                assert_eq!(widget, "btn");
                assert!(ast.contains("Button"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = WidgetParserHandlerImpl;
        let result = handler.parse(
            WidgetParserParseInput {
                widget: "btn".to_string(),
                source: "not json at all".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetParserParseOutput::Error { errors, .. } => {
                assert!(!errors.is_empty());
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_missing_name() {
        let storage = InMemoryStorage::new();
        let handler = WidgetParserHandlerImpl;
        let result = handler.parse(
            WidgetParserParseInput {
                widget: "btn".to_string(),
                source: r#"{"template":"<div></div>"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetParserParseOutput::Error { errors, .. } => {
                assert!(errors.iter().any(|e| e.contains("name")));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_missing_template() {
        let storage = InMemoryStorage::new();
        let handler = WidgetParserHandlerImpl;
        let result = handler.parse(
            WidgetParserParseInput {
                widget: "btn".to_string(),
                source: r#"{"name":"Button"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WidgetParserParseOutput::Error { errors, .. } => {
                assert!(errors.iter().any(|e| e.contains("template") || e.contains("render") || e.contains("children")));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_incomplete() {
        let storage = InMemoryStorage::new();
        let handler = WidgetParserHandlerImpl;
        handler.parse(
            WidgetParserParseInput {
                widget: "btn".to_string(),
                source: r#"{"name":"Button","template":"<button></button>"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.validate(
            WidgetParserValidateInput { widget: "btn".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetParserValidateOutput::Incomplete { warnings, .. } => {
                assert!(!warnings.is_empty());
            },
            _ => panic!("Expected Incomplete variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_parsed() {
        let storage = InMemoryStorage::new();
        let handler = WidgetParserHandlerImpl;
        let result = handler.validate(
            WidgetParserValidateInput { widget: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            WidgetParserValidateOutput::Incomplete { warnings, .. } => {
                assert!(warnings.iter().any(|w| w.contains("not found")));
            },
            _ => panic!("Expected Incomplete variant"),
        }
    }
}
