// SwiftUI adapter: transforms framework-neutral props into SwiftUI bindings.
// Handles gesture modifiers (onTapGesture, onLongPressGesture), accessibility,
// and view modifier mappings.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SwiftUIAdapterHandler;
use serde_json::json;

pub struct SwiftUIAdapterHandlerImpl;

/// Maps standard event handler names to SwiftUI gesture/lifecycle modifiers.
fn swiftui_event_map(event: &str) -> Option<&str> {
    match event {
        "onclick" => Some("onTapGesture"),
        "ondoubleclick" => Some("onTapGesture(count: 2)"),
        "onlongpress" => Some("onLongPressGesture"),
        "ondrag" => Some("onDrag"),
        "ondrop" => Some("onDrop"),
        "onappear" => Some("onAppear"),
        "ondisappear" => Some("onDisappear"),
        "onchange" => Some("onChange"),
        "onsubmit" => Some("onSubmit"),
        _ => None,
    }
}

#[async_trait]
impl SwiftUIAdapterHandler for SwiftUIAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: SwiftUIAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SwiftUIAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let adapter = &input.adapter;
        let props = &input.props;

        if props.trim().is_empty() {
            return Ok(SwiftUIAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(props) {
            Ok(serde_json::Value::Object(map)) => map,
            _ => {
                return Ok(SwiftUIAdapterNormalizeOutput::Error {
                    message: "Props must be valid JSON".to_string(),
                });
            }
        };

        let mut normalized = serde_json::Map::new();

        for (key, value) in &parsed {
            // ARIA -> accessibility modifiers
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

            // class -> SwiftUI does not use class; map to custom modifier
            if key == "class" {
                normalized.insert("__styleClass".to_string(), value.clone());
                continue;
            }

            // Event handlers -> SwiftUI gesture/lifecycle modifiers
            if key.starts_with("on") && key.len() > 2 {
                let lower_key = key.to_lowercase();
                if let Some(swiftui_event) = swiftui_event_map(&lower_key) {
                    normalized.insert(swiftui_event.to_string(), value.clone());
                } else {
                    // Fallback: generic action modifier
                    let event_name = &key[2..];
                    let capitalized = {
                        let mut chars = event_name.chars();
                        match chars.next() {
                            None => String::new(),
                            Some(c) => {
                                let lower = c.to_lowercase().to_string();
                                format!("on{}{}", lower.chars().next().unwrap().to_uppercase(), &event_name[1..].to_lowercase())
                            }
                        }
                    };
                    normalized.insert(capitalized, value.clone());
                }
                continue;
            }

            // style -> SwiftUI view modifiers
            if key == "style" {
                normalized.insert("__modifiers".to_string(), value.clone());
                continue;
            }

            // Layout props -> SwiftUI stack containers
            if key == "layout" {
                normalized.insert("__container".to_string(), value.clone());
                continue;
            }

            // All other props pass through as view modifiers
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized).unwrap_or_else(|_| "{}".to_string());

        storage.put("output", adapter, json!({
            "adapter": adapter,
            "normalized": &normalized_str,
        })).await?;

        Ok(SwiftUIAdapterNormalizeOutput::Ok {
            adapter: adapter.clone(),
            normalized: normalized_str,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_normalize_gesture_mapping() {
        let storage = InMemoryStorage::new();
        let handler = SwiftUIAdapterHandlerImpl;
        let result = handler.normalize(
            SwiftUIAdapterNormalizeInput {
                adapter: "swiftui-adapter".to_string(),
                props: r#"{"onclick":"handleTap","onlongpress":"handleLong"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftUIAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("onTapGesture"));
                assert!(normalized.contains("onLongPressGesture"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = SwiftUIAdapterHandlerImpl;
        let result = handler.normalize(
            SwiftUIAdapterNormalizeInput {
                adapter: "swiftui-adapter".to_string(),
                props: "  ".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftUIAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_aria_to_accessibility() {
        let storage = InMemoryStorage::new();
        let handler = SwiftUIAdapterHandlerImpl;
        let result = handler.normalize(
            SwiftUIAdapterNormalizeInput {
                adapter: "swiftui-adapter".to_string(),
                props: r#"{"aria-label":"Submit"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SwiftUIAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("accessibility"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
