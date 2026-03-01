// Mobile adapter implementation
// Transforms framework-neutral props into mobile bindings:
// touch events, gesture handlers, press/long-press model.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MobileAdapterHandler;
use serde_json::json;
use std::collections::HashMap;

pub struct MobileAdapterHandlerImpl;

fn mobile_event_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("onclick", "onPress");
    m.insert("ondoubleclick", "onDoublePress");
    m.insert("onlongpress", "onLongPress");
    m.insert("onswipe", "onSwipe");
    m.insert("onswipeleft", "onSwipeLeft");
    m.insert("onswiperight", "onSwipeRight");
    m.insert("onswipeup", "onSwipeUp");
    m.insert("onswipedown", "onSwipeDown");
    m.insert("onpan", "onPan");
    m.insert("onpinch", "onPinch");
    m.insert("onrotate", "onRotate");
    m.insert("onchange", "onValueChange");
    m.insert("onfocus", "onFocus");
    m.insert("onblur", "onBlur");
    m.insert("onscroll", "onScroll");
    m.insert("onlayout", "onLayout");
    m
}

#[async_trait]
impl MobileAdapterHandler for MobileAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: MobileAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MobileAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.is_empty() || input.props.trim().is_empty() {
            return Ok(MobileAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".into(),
            });
        }

        let parsed: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(&input.props) {
            Ok(serde_json::Value::Object(m)) => m,
            _ => return Ok(MobileAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".into(),
            }),
        };

        let event_map = mobile_event_map();
        let mut normalized = serde_json::Map::new();

        for (key, value) in &parsed {
            if key.starts_with("aria-") {
                let a11y_prop = key.replace("aria-", "accessible-");
                normalized.insert(a11y_prop, value.clone());
            } else if key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
            } else if key == "class" {
                normalized.insert("style".into(), json!({"__mobileStyle": true, "className": value}));
            } else if key.starts_with("on") {
                let lower_key = key.to_lowercase();
                if let Some(mobile_event) = event_map.get(lower_key.as_str()) {
                    normalized.insert(mobile_event.to_string(), value.clone());
                    if *mobile_event == "onPress" && !normalized.contains_key("onLongPress") {
                        normalized.insert("onLongPress".into(), json!(null));
                    }
                } else {
                    let event_name = &key[2..];
                    let mut chars = event_name.chars();
                    let capitalized = match chars.next() {
                        None => String::new(),
                        Some(c) => format!("on{}{}", c.to_uppercase(), chars.as_str()),
                    };
                    normalized.insert(capitalized, value.clone());
                }
            } else if key == "style" {
                normalized.insert("style".into(), value.clone());
            } else {
                normalized.insert(key.clone(), value.clone());
            }
        }

        let normalized_str = serde_json::to_string(&normalized)?;
        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str,
        })).await?;

        Ok(MobileAdapterNormalizeOutput::Ok {
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
        let handler = MobileAdapterHandlerImpl;
        let result = handler.normalize(
            MobileAdapterNormalizeInput {
                adapter: "mobile-1".into(),
                props: r#"{"onclick":"handleClick","class":"btn"}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MobileAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "mobile-1");
                assert!(normalized.contains("onPress"));
                assert!(normalized.contains("__mobileStyle"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = MobileAdapterHandlerImpl;
        let result = handler.normalize(
            MobileAdapterNormalizeInput { adapter: "m1".into(), props: "".into() },
            &storage,
        ).await.unwrap();
        match result {
            MobileAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = MobileAdapterHandlerImpl;
        let result = handler.normalize(
            MobileAdapterNormalizeInput { adapter: "m1".into(), props: "not json".into() },
            &storage,
        ).await.unwrap();
        match result {
            MobileAdapterNormalizeOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }
}
