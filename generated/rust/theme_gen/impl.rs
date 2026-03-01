// ThemeGen concept implementation
// Generate platform-specific theme output from a theme AST for multiple targets:
// css-variables, tailwind, react-native, terminal, w3c-dtcg.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ThemeGenHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("G-{}", id)
}

const VALID_TARGETS: &[&str] = &["css-variables", "tailwind", "react-native", "terminal", "w3c-dtcg"];

pub struct ThemeGenHandlerImpl;

#[async_trait]
impl ThemeGenHandler for ThemeGenHandlerImpl {
    async fn generate(
        &self,
        input: ThemeGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ThemeGenGenerateOutput, Box<dyn std::error::Error>> {
        if !VALID_TARGETS.contains(&input.target.as_str()) {
            return Ok(ThemeGenGenerateOutput::Error {
                gen: input.gen,
                message: format!(
                    "Unsupported target \"{}\". Valid targets: {}",
                    input.target,
                    VALID_TARGETS.join(", ")
                ),
            });
        }

        let ast: serde_json::Value = match serde_json::from_str(&input.theme_ast) {
            Ok(v) => v,
            Err(_) => {
                return Ok(ThemeGenGenerateOutput::Error {
                    gen: input.gen,
                    message: "Failed to parse theme AST as JSON".to_string(),
                });
            }
        };

        let id = if input.gen.is_empty() { next_id() } else { input.gen.clone() };

        let output = match input.target.as_str() {
            "css-variables" => {
                let mut vars = Vec::new();
                if let Some(obj) = ast.as_object() {
                    for (key, value) in obj {
                        let val_str = match value.as_str() {
                            Some(s) => s.to_string(),
                            None => value.to_string(),
                        };
                        vars.push(format!("  --{}: {};", key, val_str));
                    }
                }
                format!(":root {{\n{}\n}}", vars.join("\n"))
            }
            "tailwind" => {
                let mut extend = serde_json::Map::new();
                if let Some(obj) = ast.as_object() {
                    for (key, value) in obj {
                        extend.insert(key.clone(), value.clone());
                    }
                }
                serde_json::to_string_pretty(&json!({"theme": {"extend": extend}}))?
            }
            "react-native" => {
                let mut styles = serde_json::Map::new();
                if let Some(obj) = ast.as_object() {
                    for (key, value) in obj {
                        // Convert kebab-case to camelCase
                        let camel_key = key.split('-').enumerate().map(|(i, part)| {
                            if i == 0 {
                                part.to_string()
                            } else {
                                let mut chars = part.chars();
                                match chars.next() {
                                    Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                                    None => String::new(),
                                }
                            }
                        }).collect::<String>();
                        styles.insert(camel_key, value.clone());
                    }
                }
                format!("export const theme = {};",
                    serde_json::to_string_pretty(&serde_json::Value::Object(styles))?)
            }
            "terminal" => {
                let mut ansi_map = Vec::new();
                if let Some(obj) = ast.as_object() {
                    for (key, value) in obj {
                        let val_str = match value.as_str() {
                            Some(s) => s.to_string(),
                            None => value.to_string(),
                        };
                        ansi_map.push(format!("{}={}", key, val_str));
                    }
                }
                ansi_map.join("\n")
            }
            "w3c-dtcg" => {
                let mut tokens = serde_json::Map::new();
                if let Some(obj) = ast.as_object() {
                    for (key, value) in obj {
                        tokens.insert(key.clone(), json!({"$value": value, "$type": "color"}));
                    }
                }
                serde_json::to_string_pretty(&serde_json::Value::Object(tokens))?
            }
            _ => String::new(),
        };

        storage.put("themeGen", &id, json!({
            "target": input.target,
            "input": input.theme_ast,
            "output": output
        })).await?;

        Ok(ThemeGenGenerateOutput::Ok {
            gen: id,
            output,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_css_variables() {
        let storage = InMemoryStorage::new();
        let handler = ThemeGenHandlerImpl;
        let result = handler.generate(
            ThemeGenGenerateInput {
                gen: "gen1".to_string(),
                target: "css-variables".to_string(),
                theme_ast: r#"{"primary":"#ff0000","secondary":"#00ff00"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeGenGenerateOutput::Ok { output, .. } => {
                assert!(output.contains(":root"));
                assert!(output.contains("--primary"));
                assert!(output.contains("#ff0000"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_tailwind() {
        let storage = InMemoryStorage::new();
        let handler = ThemeGenHandlerImpl;
        let result = handler.generate(
            ThemeGenGenerateInput {
                gen: "gen2".to_string(),
                target: "tailwind".to_string(),
                theme_ast: r#"{"primary":"#ff0000"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeGenGenerateOutput::Ok { output, .. } => {
                assert!(output.contains("theme"));
                assert!(output.contains("extend"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_unsupported_target() {
        let storage = InMemoryStorage::new();
        let handler = ThemeGenHandlerImpl;
        let result = handler.generate(
            ThemeGenGenerateInput {
                gen: "gen3".to_string(),
                target: "invalid-target".to_string(),
                theme_ast: r#"{}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeGenGenerateOutput::Error { message, .. } => {
                assert!(message.contains("Unsupported target"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_invalid_ast() {
        let storage = InMemoryStorage::new();
        let handler = ThemeGenHandlerImpl;
        let result = handler.generate(
            ThemeGenGenerateInput {
                gen: "gen4".to_string(),
                target: "css-variables".to_string(),
                theme_ast: "not json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeGenGenerateOutput::Error { message, .. } => {
                assert!(message.contains("Failed to parse"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_react_native() {
        let storage = InMemoryStorage::new();
        let handler = ThemeGenHandlerImpl;
        let result = handler.generate(
            ThemeGenGenerateInput {
                gen: "".to_string(),
                target: "react-native".to_string(),
                theme_ast: r#"{"font-size":"16px"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ThemeGenGenerateOutput::Ok { output, .. } => {
                assert!(output.contains("export const theme"));
                assert!(output.contains("fontSize"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
