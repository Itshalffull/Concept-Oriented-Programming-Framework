// WatchAdapter handler implementation
// Transforms framework-neutral props into watchOS bindings: reduced interaction
// set for small watch displays, tap gestures, Digital Crown input.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WatchAdapterHandler;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

fn watch_event_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("onclick", "onTapGesture");
    m.insert("onlongpress", "onLongPressGesture");
    m.insert("onchange", "onChange");
    m.insert("onappear", "onAppear");
    m.insert("ondisappear", "onDisappear");
    m.insert("onscroll", "digitalCrownRotation");
    m
}

fn unsupported_watch_events() -> HashSet<&'static str> {
    let mut s = HashSet::new();
    for e in &["ondoubleclick", "ondrag", "ondrop", "onhover",
               "onmouseenter", "onmouseleave", "onkeydown", "onkeyup",
               "onresize", "oncontextmenu"] {
        s.insert(*e);
    }
    s
}

pub struct WatchAdapterHandlerImpl;

#[async_trait]
impl WatchAdapterHandler for WatchAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: WatchAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WatchAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let adapter = &input.adapter;
        let props = &input.props;

        if props.is_empty() || props.trim().is_empty() {
            return Ok(WatchAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: Value = match serde_json::from_str(props) {
            Ok(v) => v,
            Err(_) => return Ok(WatchAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let parsed_obj = match parsed.as_object() {
            Some(o) => o,
            None => return Ok(WatchAdapterNormalizeOutput::Error {
                message: "Props must be a JSON object".to_string(),
            }),
        };

        let event_map = watch_event_map();
        let unsupported = unsupported_watch_events();
        let mut normalized = serde_json::Map::new();

        for (key, value) in parsed_obj {
            if key.starts_with("aria-") {
                let a11y_prop = key.replace("aria-", "accessibility");
                normalized.insert(a11y_prop, value.clone());
                continue;
            }
            if key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }
            if key == "class" {
                normalized.insert("__styleClass".to_string(), value.clone());
                continue;
            }
            if key.starts_with("on") {
                let lower = key.to_lowercase();
                if unsupported.contains(lower.as_str()) {
                    normalized.insert(format!("__unsupported:{}", key), value.clone());
                    continue;
                }
                if let Some(watch_event) = event_map.get(lower.as_str()) {
                    normalized.insert(watch_event.to_string(), value.clone());
                } else {
                    let event_name = &key[2..];
                    let capitalized = format!("on{}{}", &event_name[..1].to_uppercase(), &event_name[1..]);
                    normalized.insert(capitalized, value.clone());
                }
                continue;
            }
            if key == "style" {
                normalized.insert("__modifiers".to_string(), value.clone());
                continue;
            }
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&Value::Object(normalized))?;
        storage.put("output", adapter, json!({"adapter": adapter, "normalized": &normalized_str})).await?;

        Ok(WatchAdapterNormalizeOutput::Ok {
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
    async fn test_normalize_success() {
        let storage = InMemoryStorage::new();
        let handler = WatchAdapterHandlerImpl;
        let result = handler.normalize(
            WatchAdapterNormalizeInput {
                adapter: "wa-1".to_string(),
                props: r#"{"onclick":"tap","class":"btn","aria-label":"Go"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WatchAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "wa-1");
                assert!(normalized.contains("onTapGesture"));
                assert!(normalized.contains("__styleClass"));
                assert!(normalized.contains("accessibilitylabel"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = WatchAdapterHandlerImpl;
        let result = handler.normalize(
            WatchAdapterNormalizeInput {
                adapter: "wa-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WatchAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_unsupported_events() {
        let storage = InMemoryStorage::new();
        let handler = WatchAdapterHandlerImpl;
        let result = handler.normalize(
            WatchAdapterNormalizeInput {
                adapter: "wa-1".to_string(),
                props: r#"{"ondoubleclick":"handler","onhover":"handler2"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WatchAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("__unsupported"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
