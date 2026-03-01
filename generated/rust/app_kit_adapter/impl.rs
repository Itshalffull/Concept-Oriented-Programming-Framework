// AppKitAdapter concept implementation
// Transforms framework-neutral props into macOS AppKit bindings:
// NSControl target/action, NSView subclassing patterns.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AppKitAdapterHandler;
use serde_json::json;
use std::collections::HashMap;

fn appkit_action_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("onclick", "click:");
    m.insert("ondoubleclick", "doubleClick:");
    m.insert("onchange", "controlTextDidChange:");
    m.insert("onsubmit", "submitAction:");
    m.insert("onselect", "selectItem:");
    m.insert("onfocus", "becomeFirstResponder");
    m.insert("onblur", "resignFirstResponder");
    m
}

pub struct AppKitAdapterHandlerImpl;

#[async_trait]
impl AppKitAdapterHandler for AppKitAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: AppKitAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AppKitAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.trim().is_empty() {
            return Ok(AppKitAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(&input.props) {
            Ok(v) => v,
            Err(_) => return Ok(AppKitAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let action_map = appkit_action_map();
        let mut normalized = serde_json::Map::new();

        for (key, value) in &parsed {
            // ARIA attributes -> accessibility properties
            if key.starts_with("aria-") {
                let accessibility_prop = key.replace("aria-", "accessibility");
                normalized.insert(accessibility_prop, value.clone());
                continue;
            }

            // data-* pass through
            if key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> NSView class hierarchy
            if key == "class" {
                normalized.insert("__viewClass".to_string(), value.clone());
                continue;
            }

            // Event handlers -> target/action pattern
            if key.starts_with("on") {
                let lower_key = key.to_lowercase();
                if let Some(action) = action_map.get(lower_key.as_str()) {
                    normalized.insert(
                        format!("__action:{}", action),
                        json!({ "target": value, "action": action }),
                    );
                } else {
                    let event_name = &key[2..].to_lowercase();
                    let action_name = format!("{}:", event_name);
                    normalized.insert(
                        format!("__action:{}", action_name),
                        json!({ "target": value, "action": action_name }),
                    );
                }
                continue;
            }

            // style -> NSView property assignments
            if key == "style" {
                normalized.insert("__viewProperties".to_string(), value.clone());
                continue;
            }

            // All other props -> NSView configuration
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized)?;

        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str,
        })).await?;

        Ok(AppKitAdapterNormalizeOutput::Ok {
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
    async fn test_normalize_valid_props() {
        let storage = InMemoryStorage::new();
        let handler = AppKitAdapterHandlerImpl;
        let result = handler.normalize(
            AppKitAdapterNormalizeInput {
                adapter: "appkit-1".to_string(),
                props: r#"{"title":"Hello","onclick":"handleClick"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AppKitAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "appkit-1");
                assert!(normalized.contains("title"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = AppKitAdapterHandlerImpl;
        let result = handler.normalize(
            AppKitAdapterNormalizeInput {
                adapter: "appkit-2".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AppKitAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("cannot be empty"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = AppKitAdapterHandlerImpl;
        let result = handler.normalize(
            AppKitAdapterNormalizeInput {
                adapter: "appkit-3".to_string(),
                props: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AppKitAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("valid JSON"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_aria_attributes() {
        let storage = InMemoryStorage::new();
        let handler = AppKitAdapterHandlerImpl;
        let result = handler.normalize(
            AppKitAdapterNormalizeInput {
                adapter: "appkit-4".to_string(),
                props: r#"{"aria-label":"Close button"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AppKitAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("accessibilitylabel"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
