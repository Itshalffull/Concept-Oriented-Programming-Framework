// TerminalAdapter concept implementation
// Transform framework-neutral props into terminal bindings: ANSI escape codes,
// keyboard event handlers, readline input.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TerminalAdapterHandler;
use serde_json::json;
use std::collections::HashMap;

fn terminal_key_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("onclick", "enter");
    m.insert("onsubmit", "enter");
    m.insert("onkeydown", "keypress");
    m.insert("onkeyup", "keypress");
    m.insert("onfocus", "focus");
    m.insert("onblur", "blur");
    m.insert("onchange", "input");
    m.insert("onescape", "escape");
    m.insert("ontab", "tab");
    m
}

fn ansi_class_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("bold", "\x1b[1m");
    m.insert("dim", "\x1b[2m");
    m.insert("italic", "\x1b[3m");
    m.insert("underline", "\x1b[4m");
    m.insert("blink", "\x1b[5m");
    m.insert("inverse", "\x1b[7m");
    m.insert("hidden", "\x1b[8m");
    m.insert("strikethrough", "\x1b[9m");
    m.insert("red", "\x1b[31m");
    m.insert("green", "\x1b[32m");
    m.insert("yellow", "\x1b[33m");
    m.insert("blue", "\x1b[34m");
    m.insert("magenta", "\x1b[35m");
    m.insert("cyan", "\x1b[36m");
    m.insert("white", "\x1b[37m");
    m.insert("bg-red", "\x1b[41m");
    m.insert("bg-green", "\x1b[42m");
    m.insert("bg-yellow", "\x1b[43m");
    m.insert("bg-blue", "\x1b[44m");
    m
}

const ANSI_RESET: &str = "\x1b[0m";

pub struct TerminalAdapterHandlerImpl;

#[async_trait]
impl TerminalAdapterHandler for TerminalAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: TerminalAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerminalAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.trim().is_empty() {
            return Ok(TerminalAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Value = match serde_json::from_str(&input.props) {
            Ok(v) => v,
            Err(_) => {
                return Ok(TerminalAdapterNormalizeOutput::Error {
                    message: "Props must be valid JSON".to_string(),
                });
            }
        };

        let key_map = terminal_key_map();
        let class_map = ansi_class_map();
        let mut normalized = serde_json::Map::new();

        if let Some(obj) = parsed.as_object() {
            for (key, value) in obj {
                // ARIA and data-* attributes pass through
                if key.starts_with("aria-") || key.starts_with("data-") {
                    normalized.insert(key.clone(), value.clone());
                    continue;
                }

                // class -> ANSI escape code sequences
                if key == "class" {
                    if let Some(class_str) = value.as_str() {
                        let classes: Vec<&str> = class_str.split_whitespace().collect();
                        let mut ansi_codes = Vec::new();
                        for cls in &classes {
                            if let Some(code) = class_map.get(cls.to_lowercase().as_str()) {
                                ansi_codes.push(*code);
                            }
                        }
                        let prefix: String = ansi_codes.join("");
                        let suffix = if !ansi_codes.is_empty() { ANSI_RESET } else { "" };
                        normalized.insert("__ansi".to_string(), json!({
                            "prefix": prefix,
                            "suffix": suffix,
                            "classes": classes
                        }));
                    }
                    continue;
                }

                // Event handlers -> keyboard binding map
                if key.starts_with("on") {
                    let lower_key = key.to_lowercase();
                    let terminal_key = key_map.get(lower_key.as_str())
                        .map(|k| k.to_string())
                        .unwrap_or_else(|| key[2..].to_lowercase());
                    normalized.insert(
                        format!("keybinding:{}", terminal_key),
                        json!({"key": terminal_key, "handler": value}),
                    );
                    continue;
                }

                // style -> ANSI style
                if key == "style" {
                    normalized.insert("__ansiStyle".to_string(), value.clone());
                    continue;
                }

                // All other props pass through
                normalized.insert(key.clone(), value.clone());
            }
        }

        let normalized_str = serde_json::to_string(&normalized)?;
        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str
        })).await?;

        Ok(TerminalAdapterNormalizeOutput::Ok {
            adapter: input.adapter,
            normalized: normalized_str,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_normalize_success() {
        let storage = InMemoryStorage::new();
        let handler = TerminalAdapterHandlerImpl;
        let result = handler.normalize(
            TerminalAdapterNormalizeInput {
                adapter: "term1".to_string(),
                props: r#"{"class":"bold red","text":"hello"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TerminalAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "term1");
                assert!(normalized.contains("__ansi"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = TerminalAdapterHandlerImpl;
        let result = handler.normalize(
            TerminalAdapterNormalizeInput {
                adapter: "term1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TerminalAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = TerminalAdapterHandlerImpl;
        let result = handler.normalize(
            TerminalAdapterNormalizeInput {
                adapter: "term1".to_string(),
                props: "not json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TerminalAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("valid JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_event_handlers() {
        let storage = InMemoryStorage::new();
        let handler = TerminalAdapterHandlerImpl;
        let result = handler.normalize(
            TerminalAdapterNormalizeInput {
                adapter: "term1".to_string(),
                props: r#"{"onclick":"handleClick"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TerminalAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("keybinding:enter"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
