// WinUIAdapter Handler Implementation
//
// Transforms framework-neutral props into WinUI/XAML bindings: event handlers
// map to WinUI event names, ARIA attributes become AutomationProperties,
// class becomes a XAML Style resource, and style becomes dependency properties.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WinUIAdapterHandler;
use serde_json::json;
use std::collections::HashMap;

pub struct WinUIAdapterHandlerImpl;

/// Map of framework-neutral event names to WinUI event names.
fn winui_event_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("onclick", "Click");
    m.insert("ondoubleclick", "DoubleTapped");
    m.insert("onchange", "TextChanged");
    m.insert("onfocus", "GotFocus");
    m.insert("onblur", "LostFocus");
    m.insert("onkeydown", "KeyDown");
    m.insert("onkeyup", "KeyUp");
    m.insert("onpointerenter", "PointerEntered");
    m.insert("onpointerleave", "PointerExited");
    m.insert("onpointerdown", "PointerPressed");
    m.insert("onpointerup", "PointerReleased");
    m.insert("onloaded", "Loaded");
    m.insert("onunloaded", "Unloaded");
    m.insert("onscroll", "ViewChanged");
    m.insert("ondrag", "DragStarting");
    m.insert("ondrop", "Drop");
    m
}

#[async_trait]
impl WinUIAdapterHandler for WinUIAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: WinUIAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WinUIAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.is_empty() || input.props.trim().is_empty() {
            return Ok(WinUIAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(&input.props) {
            Ok(serde_json::Value::Object(map)) => map,
            _ => {
                return Ok(WinUIAdapterNormalizeOutput::Error {
                    message: "Props must be valid JSON".to_string(),
                });
            }
        };

        let event_map = winui_event_map();
        let mut normalized = serde_json::Map::new();

        for (key, value) in &parsed {
            // ARIA attributes -> AutomationProperties
            if key.starts_with("aria-") {
                let automation_prop = key.replacen("aria-", "AutomationProperties.", 1);
                normalized.insert(automation_prop, value.clone());
                continue;
            }

            // data-* attributes pass through
            if key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> XAML Style resource
            if key == "class" {
                normalized.insert(
                    "Style".to_string(),
                    json!({ "__xamlStyle": true, "value": value }),
                );
                continue;
            }

            // Event handlers -> WinUI event names
            if key.starts_with("on") {
                let lower_key = key.to_lowercase();
                if let Some(winui_event) = event_map.get(lower_key.as_str()) {
                    normalized.insert(winui_event.to_string(), value.clone());
                } else {
                    // PascalCase fallback for unknown events
                    let event_name = &key[2..];
                    if let Some(first_char) = event_name.chars().next() {
                        let pascal = format!(
                            "{}{}",
                            first_char.to_uppercase(),
                            &event_name[first_char.len_utf8()..]
                        );
                        normalized.insert(pascal, value.clone());
                    }
                }
                continue;
            }

            // style -> XAML dependency properties
            if key == "style" {
                normalized.insert("__dependencyProperties".to_string(), value.clone());
                continue;
            }

            // All other props pass through as XAML attributes
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized)?;

        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str,
        })).await?;

        Ok(WinUIAdapterNormalizeOutput::Ok {
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
        let handler = WinUIAdapterHandlerImpl;
        let result = handler.normalize(
            WinUIAdapterNormalizeInput {
                adapter: "winui-1".to_string(),
                props: r#"{"onclick":"handler","class":"btn","aria-label":"Submit","style":{"bg":"red"}}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WinUIAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "winui-1");
                assert!(normalized.contains("Click"));
                assert!(normalized.contains("Style"));
                assert!(normalized.contains("AutomationProperties"));
                assert!(normalized.contains("__dependencyProperties"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = WinUIAdapterHandlerImpl;
        let result = handler.normalize(
            WinUIAdapterNormalizeInput {
                adapter: "winui-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WinUIAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = WinUIAdapterHandlerImpl;
        let result = handler.normalize(
            WinUIAdapterNormalizeInput {
                adapter: "winui-1".to_string(),
                props: "not json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WinUIAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_data_attributes_passthrough() {
        let storage = InMemoryStorage::new();
        let handler = WinUIAdapterHandlerImpl;
        let result = handler.normalize(
            WinUIAdapterNormalizeInput {
                adapter: "winui-data".to_string(),
                props: r#"{"data-testid":"btn","data-custom":"val"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WinUIAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("data-testid"));
                assert!(normalized.contains("data-custom"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_normalize_unknown_event_pascal_case_fallback() {
        let storage = InMemoryStorage::new();
        let handler = WinUIAdapterHandlerImpl;
        let result = handler.normalize(
            WinUIAdapterNormalizeInput {
                adapter: "winui-unk".to_string(),
                props: r#"{"onCustomEvent":"handler"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WinUIAdapterNormalizeOutput::Ok { normalized, .. } => {
                // Unknown events get PascalCase fallback: onCustomEvent -> CustomEvent
                assert!(normalized.contains("CustomEvent"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_normalize_multiple_known_events() {
        let storage = InMemoryStorage::new();
        let handler = WinUIAdapterHandlerImpl;
        let result = handler.normalize(
            WinUIAdapterNormalizeInput {
                adapter: "winui-ev".to_string(),
                props: r#"{"onfocus":"f","onblur":"b","onkeydown":"k"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WinUIAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("GotFocus"));
                assert!(normalized.contains("LostFocus"));
                assert!(normalized.contains("KeyDown"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_normalize_plain_attributes_passthrough() {
        let storage = InMemoryStorage::new();
        let handler = WinUIAdapterHandlerImpl;
        let result = handler.normalize(
            WinUIAdapterNormalizeInput {
                adapter: "winui-plain".to_string(),
                props: r#"{"Width":"200","Height":"100","IsEnabled":"true"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WinUIAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("Width"));
                assert!(normalized.contains("Height"));
                assert!(normalized.contains("IsEnabled"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }
}
