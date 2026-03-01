// GTKAdapter concept implementation
// Transforms framework-neutral props into GTK bindings: g_signal_connect, widget property assignments.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GTKAdapterHandler;
use serde_json::json;
use std::collections::HashMap;

fn gtk_signal_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("onclick", "clicked");
    m.insert("onchange", "changed");
    m.insert("onactivate", "activate");
    m.insert("onfocus", "focus-in-event");
    m.insert("onblur", "focus-out-event");
    m.insert("onkeydown", "key-press-event");
    m.insert("onkeyup", "key-release-event");
    m.insert("onmouseenter", "enter-notify-event");
    m.insert("onmouseleave", "leave-notify-event");
    m.insert("onscroll", "scroll-event");
    m.insert("ondestroy", "destroy");
    m.insert("onshow", "show");
    m.insert("onhide", "hide");
    m.insert("onresize", "size-allocate");
    m
}

pub struct GTKAdapterHandlerImpl;

#[async_trait]
impl GTKAdapterHandler for GTKAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: GTKAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GTKAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.trim().is_empty() {
            return Ok(GTKAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Value = match serde_json::from_str(&input.props) {
            Ok(v) => v,
            Err(_) => return Ok(GTKAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let signal_map = gtk_signal_map();
        let mut normalized = serde_json::Map::new();

        if let Some(obj) = parsed.as_object() {
            for (key, value) in obj {
                // ARIA -> ATK accessibility properties
                if key.starts_with("aria-") {
                    let atk_prop = key.replace("aria-", "atk-");
                    normalized.insert(atk_prop, value.clone());
                    continue;
                }
                if key.starts_with("data-") {
                    normalized.insert(key.clone(), value.clone());
                    continue;
                }
                if key == "class" {
                    normalized.insert("__cssClass".to_string(), value.clone());
                    continue;
                }
                // Event handlers -> GTK signals
                if key.starts_with("on") {
                    let lower = key.to_lowercase();
                    if let Some(signal) = signal_map.get(lower.as_str()) {
                        normalized.insert(format!("__signal:{}", signal), value.clone());
                    } else {
                        normalized.insert(format!("__unsupported:{}", key), value.clone());
                    }
                    continue;
                }
                if key == "style" {
                    normalized.insert("__gtkStyle".to_string(), value.clone());
                    continue;
                }
                normalized.insert(key.clone(), value.clone());
            }
        }

        let normalized_str = serde_json::to_string(&normalized)?;
        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str,
        })).await?;

        Ok(GTKAdapterNormalizeOutput::Ok {
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
        let handler = GTKAdapterHandlerImpl;
        let result = handler.normalize(
            GTKAdapterNormalizeInput {
                adapter: "gtk-1".to_string(),
                props: r#"{"label":"Click me","onclick":"handleClick"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GTKAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "gtk-1");
                assert!(normalized.contains("__signal:clicked"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = GTKAdapterHandlerImpl;
        let result = handler.normalize(
            GTKAdapterNormalizeInput {
                adapter: "gtk-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GTKAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = GTKAdapterHandlerImpl;
        let result = handler.normalize(
            GTKAdapterNormalizeInput {
                adapter: "gtk-1".to_string(),
                props: "not json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GTKAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("valid JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_aria_to_atk() {
        let storage = InMemoryStorage::new();
        let handler = GTKAdapterHandlerImpl;
        let result = handler.normalize(
            GTKAdapterNormalizeInput {
                adapter: "gtk-2".to_string(),
                props: r#"{"aria-label":"Submit"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GTKAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("atk-label"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
