// ReactNativeAdapter concept implementation
// Transforms framework-neutral props into React Native bindings:
// onPress, StyleSheet, Touchable/Pressable event model, accessibility props.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ReactNativeAdapterHandler;
use serde_json::json;

pub struct ReactNativeAdapterHandlerImpl;

/// Map DOM event names to React Native equivalents
fn rn_event_name(key: &str) -> Option<&'static str> {
    match key.to_lowercase().as_str() {
        "onclick" => Some("onPress"),
        "ondoubleclick" => Some("onDoublePress"),
        "onlongpress" => Some("onLongPress"),
        "onchange" => Some("onChangeText"),
        "onfocus" => Some("onFocus"),
        "onblur" => Some("onBlur"),
        "onsubmit" => Some("onSubmitEditing"),
        "onscroll" => Some("onScroll"),
        "onlayout" => Some("onLayout"),
        "onkeydown" => Some("onKeyPress"),
        _ => None,
    }
}

#[async_trait]
impl ReactNativeAdapterHandler for ReactNativeAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: ReactNativeAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ReactNativeAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.trim().is_empty() {
            return Ok(ReactNativeAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Value = match serde_json::from_str(&input.props) {
            Ok(v) => v,
            Err(_) => return Ok(ReactNativeAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let obj = match parsed.as_object() {
            Some(o) => o,
            None => return Ok(ReactNativeAdapterNormalizeOutput::Error {
                message: "Props must be a JSON object".to_string(),
            }),
        };

        let mut normalized = serde_json::Map::new();

        for (key, value) in obj {
            // aria-* -> React Native accessibility props
            if key.starts_with("aria-") {
                let a11y_prop = &key[5..];
                let mut chars = a11y_prop.chars();
                let capitalized = match chars.next() {
                    Some(c) => format!("accessible{}{}", c.to_uppercase(), chars.collect::<String>()),
                    None => "accessible".to_string(),
                };
                normalized.insert(capitalized, value.clone());
                continue;
            }

            // data-* pass through
            if key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> React Native style reference (no className in RN)
            if key == "class" {
                normalized.insert("style".to_string(), json!({
                    "__styleSheet": true,
                    "className": value,
                }));
                continue;
            }

            // Event handlers -> React Native event props
            if key.starts_with("on") {
                if let Some(rn_name) = rn_event_name(key) {
                    normalized.insert(rn_name.to_string(), value.clone());
                } else {
                    // CamelCase fallback for unknown events
                    let event_part = &key[2..];
                    let mut chars = event_part.chars();
                    let camel = match chars.next() {
                        Some(c) => format!("on{}{}", c.to_uppercase(), chars.collect::<String>()),
                        None => key.clone(),
                    };
                    normalized.insert(camel, value.clone());
                }
                continue;
            }

            // style -> React Native StyleSheet object
            if key == "style" {
                normalized.insert("style".to_string(), json!({
                    "__styleSheet": true,
                    "value": value,
                }));
                continue;
            }

            // All other props pass through
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized)?;

        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str,
        })).await?;

        Ok(ReactNativeAdapterNormalizeOutput::Ok {
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
    async fn test_normalize_onclick_to_onpress() {
        let storage = InMemoryStorage::new();
        let handler = ReactNativeAdapterHandlerImpl;
        let result = handler.normalize(
            ReactNativeAdapterNormalizeInput {
                adapter: "rn-1".to_string(),
                props: r#"{"onclick":"handleTap"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReactNativeAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("onPress"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = ReactNativeAdapterHandlerImpl;
        let result = handler.normalize(
            ReactNativeAdapterNormalizeInput {
                adapter: "rn-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReactNativeAdapterNormalizeOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_class_to_stylesheet() {
        let storage = InMemoryStorage::new();
        let handler = ReactNativeAdapterHandlerImpl;
        let result = handler.normalize(
            ReactNativeAdapterNormalizeInput {
                adapter: "rn-1".to_string(),
                props: r#"{"class":"container"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReactNativeAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("__styleSheet"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = ReactNativeAdapterHandlerImpl;
        let result = handler.normalize(
            ReactNativeAdapterNormalizeInput {
                adapter: "rn-1".to_string(),
                props: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ReactNativeAdapterNormalizeOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }
}
