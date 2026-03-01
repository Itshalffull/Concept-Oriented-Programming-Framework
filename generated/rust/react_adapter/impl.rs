// ReactAdapter concept implementation
// Transforms framework-neutral props into React-specific bindings:
// onclick -> onClick, class -> className, style strings to objects, SyntheticEvent wrappers.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ReactAdapterHandler;
use serde_json::json;

pub struct ReactAdapterHandlerImpl;

/// Convert a lowercase DOM event name to React camelCase convention.
/// e.g. "onclick" -> "onClick", "onmouseenter" -> "onMouseEnter"
fn to_react_event_name(key: &str) -> String {
    if !key.starts_with("on") {
        return key.to_string();
    }
    let event_part = &key[2..];
    let mut chars = event_part.chars();
    match chars.next() {
        Some(c) => format!("on{}{}", c.to_uppercase(), chars.collect::<String>()),
        None => key.to_string(),
    }
}

#[async_trait]
impl ReactAdapterHandler for ReactAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: ReactAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReactAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.trim().is_empty() {
            return Ok(ReactAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Value = match serde_json::from_str(&input.props) {
            Ok(v) => v,
            Err(_) => return Ok(ReactAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let obj = match parsed.as_object() {
            Some(o) => o,
            None => return Ok(ReactAdapterNormalizeOutput::Error {
                message: "Props must be a JSON object".to_string(),
            }),
        };

        let mut normalized = serde_json::Map::new();

        for (key, value) in obj {
            // ARIA and data-* attributes pass through unchanged
            if key.starts_with("aria-") || key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> className
            if key == "class" {
                normalized.insert("className".to_string(), value.clone());
                continue;
            }

            // for -> htmlFor
            if key == "for" {
                normalized.insert("htmlFor".to_string(), value.clone());
                continue;
            }

            // Event handlers: onclick -> onClick, wrapped as SyntheticEvent callback
            if key.starts_with("on") {
                let react_name = to_react_event_name(key);
                normalized.insert(react_name, json!({
                    "__syntheticEvent": true,
                    "handler": value,
                }));
                continue;
            }

            // style as string -> style object representation
            if key == "style" {
                if let Some(css_text) = value.as_str() {
                    normalized.insert("style".to_string(), json!({
                        "__cssText": css_text,
                    }));
                    continue;
                }
            }

            // All other props pass through
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized)?;

        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str,
        })).await?;

        Ok(ReactAdapterNormalizeOutput::Ok {
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
    async fn test_normalize_class_to_classname() {
        let storage = InMemoryStorage::new();
        let handler = ReactAdapterHandlerImpl;
        let result = handler.normalize(
            ReactAdapterNormalizeInput {
                adapter: "react-1".to_string(),
                props: r#"{"class":"btn","id":"submit"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReactAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("className"));
                assert!(!normalized.contains("\"class\""));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = ReactAdapterHandlerImpl;
        let result = handler.normalize(
            ReactAdapterNormalizeInput {
                adapter: "react-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReactAdapterNormalizeOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = ReactAdapterHandlerImpl;
        let result = handler.normalize(
            ReactAdapterNormalizeInput {
                adapter: "react-1".to_string(),
                props: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReactAdapterNormalizeOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_event_handlers() {
        let storage = InMemoryStorage::new();
        let handler = ReactAdapterHandlerImpl;
        let result = handler.normalize(
            ReactAdapterNormalizeInput {
                adapter: "react-1".to_string(),
                props: r#"{"onclick":"handleClick"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReactAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("onClick"));
                assert!(normalized.contains("__syntheticEvent"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
