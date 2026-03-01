// ThemeParser concept implementation
// Parse theme source definitions into an AST and validate contrast compliance.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ThemeParserHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("H-{}", id)
}

pub struct ThemeParserHandlerImpl;

#[async_trait]
impl ThemeParserHandler for ThemeParserHandlerImpl {
    async fn parse(
        &self,
        input: ThemeParserParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeParserParseOutput, Box<dyn std::error::Error>> {
        let id = if input.theme.is_empty() { next_id() } else { input.theme.clone() };

        let ast: serde_json::Value = match serde_json::from_str(&input.source) {
            Ok(v) => v,
            Err(e) => {
                return Ok(ThemeParserParseOutput::Error {
                    theme: id,
                    errors: vec![e.to_string()],
                });
            }
        };

        let mut errors = Vec::new();

        // Validate expected theme structure
        let obj = ast.as_object();
        if let Some(obj) = obj {
            if !obj.contains_key("tokens") && !obj.contains_key("colors")
                && !obj.contains_key("typography") && !obj.contains_key("spacing")
            {
                // Warning, not error - theme may have other structure
            }

            // Check for null or empty values
            for (key, value) in obj {
                if value.is_null() {
                    errors.push(format!("Token \"{}\" has null or undefined value", key));
                }
            }
        }

        if !errors.is_empty() {
            return Ok(ThemeParserParseOutput::Error {
                theme: id,
                errors,
            });
        }

        let ast_str = serde_json::to_string(&ast)?;

        storage.put("themeParser", &id, json!({
            "source": input.source,
            "ast": ast_str,
            "errors": "[]",
            "warnings": "[]"
        })).await?;

        Ok(ThemeParserParseOutput::Ok {
            theme: id,
            ast: ast_str,
        })
    }

    async fn check_contrast(
        &self,
        input: ThemeParserCheckContrastInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeParserCheckContrastOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("themeParser", &input.theme).await?;
        if existing.is_none() {
            return Ok(ThemeParserCheckContrastOutput::Violations {
                theme: input.theme,
                failures: vec!["Theme not found; parse a theme first".to_string()],
            });
        }

        let record = existing.unwrap();
        let ast_str = record["ast"].as_str().unwrap_or("{}");
        let ast: serde_json::Value = serde_json::from_str(ast_str)?;

        let mut failures = Vec::new();

        // Check color pairs for contrast compliance
        let colors = ast.get("colors")
            .or(ast.get("tokens"))
            .and_then(|v| v.as_object());

        if let Some(colors) = colors {
            // Check foreground/background pair
            if let (Some(fg), Some(bg)) = (
                colors.get("foreground").and_then(|v| v.as_str()),
                colors.get("background").and_then(|v| v.as_str()),
            ) {
                if fg == bg {
                    failures.push(format!(
                        "Contrast failure: foreground \"{}\" and background \"{}\" are identical (ratio 1:1)",
                        fg, bg
                    ));
                }
            }

            // Check named pairs
            let pairs = [
                ("text", "surface"),
                ("primary", "onPrimary"),
                ("secondary", "onSecondary"),
                ("error", "onError"),
            ];

            for (fg_key, bg_key) in &pairs {
                if let (Some(fg), Some(bg)) = (
                    colors.get(*fg_key).and_then(|v| v.as_str()),
                    colors.get(*bg_key).and_then(|v| v.as_str()),
                ) {
                    if fg == bg {
                        failures.push(format!(
                            "Contrast failure: \"{}\" and \"{}\" are identical",
                            fg_key, bg_key
                        ));
                    }
                }
            }
        }

        if !failures.is_empty() {
            return Ok(ThemeParserCheckContrastOutput::Violations {
                theme: input.theme,
                failures,
            });
        }

        Ok(ThemeParserCheckContrastOutput::Ok {
            theme: input.theme,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_parse_valid_json() {
        let storage = InMemoryStorage::new();
        let handler = ThemeParserHandlerImpl;
        let result = handler.parse(
            ThemeParserParseInput {
                theme: "my-theme".to_string(),
                source: r#"{"tokens":{"primary":"#ff0000"}}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeParserParseOutput::Ok { theme, ast } => {
                assert_eq!(theme, "my-theme");
                assert!(ast.contains("primary"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = ThemeParserHandlerImpl;
        let result = handler.parse(
            ThemeParserParseInput {
                theme: "bad-theme".to_string(),
                source: "not valid json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeParserParseOutput::Error { errors, .. } => {
                assert!(!errors.is_empty());
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_null_values_error() {
        let storage = InMemoryStorage::new();
        let handler = ThemeParserHandlerImpl;
        let result = handler.parse(
            ThemeParserParseInput {
                theme: "null-theme".to_string(),
                source: r#"{"primary":null}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeParserParseOutput::Error { errors, .. } => {
                assert!(errors.iter().any(|e| e.contains("null")));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_check_contrast_theme_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ThemeParserHandlerImpl;
        let result = handler.check_contrast(
            ThemeParserCheckContrastInput {
                theme: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeParserCheckContrastOutput::Violations { failures, .. } => {
                assert!(failures.iter().any(|f| f.contains("not found")));
            },
            _ => panic!("Expected Violations variant"),
        }
    }

    #[tokio::test]
    async fn test_check_contrast_passes() {
        let storage = InMemoryStorage::new();
        let handler = ThemeParserHandlerImpl;
        handler.parse(
            ThemeParserParseInput {
                theme: "good-theme".to_string(),
                source: r#"{"colors":{"foreground":"#000","background":"#fff"}}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.check_contrast(
            ThemeParserCheckContrastInput { theme: "good-theme".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ThemeParserCheckContrastOutput::Ok { .. } => {},
            _ => panic!("Expected Ok variant"),
        }
    }
}
