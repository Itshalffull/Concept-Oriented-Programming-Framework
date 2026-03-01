// WatchKitAdapter handler implementation
// Transforms framework-neutral props into legacy WatchKit bindings:
// WKInterfaceObject actions, IBOutlet/IBAction patterns.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WatchKitAdapterHandler;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

fn watchkit_action_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("onclick", "IBAction:buttonTapped");
    m.insert("onchange", "IBAction:valueChanged");
    m.insert("onselect", "IBAction:itemSelected");
    m
}

fn unsupported_watchkit_events() -> HashSet<&'static str> {
    let mut s = HashSet::new();
    for e in &["ondoubleclick", "onlongpress", "ondrag", "ondrop",
               "onhover", "onmouseenter", "onmouseleave", "onkeydown",
               "onkeyup", "onresize", "oncontextmenu", "onscroll",
               "onfocus", "onblur"] {
        s.insert(*e);
    }
    s
}

pub struct WatchKitAdapterHandlerImpl;

#[async_trait]
impl WatchKitAdapterHandler for WatchKitAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: WatchKitAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WatchKitAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let adapter = &input.adapter;
        let props = &input.props;

        if props.is_empty() || props.trim().is_empty() {
            return Ok(WatchKitAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: Value = match serde_json::from_str(props) {
            Ok(v) => v,
            Err(_) => return Ok(WatchKitAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let parsed_obj = match parsed.as_object() {
            Some(o) => o,
            None => return Ok(WatchKitAdapterNormalizeOutput::Error {
                message: "Props must be a JSON object".to_string(),
            }),
        };

        let action_map = watchkit_action_map();
        let unsupported = unsupported_watchkit_events();
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
                normalized.insert("__interfaceObject".to_string(), value.clone());
                continue;
            }
            if key.starts_with("on") {
                let lower = key.to_lowercase();
                if unsupported.contains(lower.as_str()) {
                    normalized.insert(format!("__unsupported:{}", key), value.clone());
                    continue;
                }
                if let Some(action) = action_map.get(lower.as_str()) {
                    normalized.insert(action.to_string(), value.clone());
                } else {
                    normalized.insert(format!("__unsupported:{}", key), value.clone());
                }
                continue;
            }
            if key == "style" {
                normalized.insert("__interfaceProperties".to_string(), value.clone());
                continue;
            }
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&Value::Object(normalized))?;
        storage.put("output", adapter, json!({"adapter": adapter, "normalized": &normalized_str})).await?;

        Ok(WatchKitAdapterNormalizeOutput::Ok {
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
        let handler = WatchKitAdapterHandlerImpl;
        let result = handler.normalize(
            WatchKitAdapterNormalizeInput {
                adapter: "wk-1".to_string(),
                props: r#"{"onclick":"tap","class":"label","aria-label":"Title"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WatchKitAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "wk-1");
                assert!(normalized.contains("IBAction:buttonTapped"));
                assert!(normalized.contains("__interfaceObject"));
                assert!(normalized.contains("accessibilitylabel"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = WatchKitAdapterHandlerImpl;
        let result = handler.normalize(
            WatchKitAdapterNormalizeInput {
                adapter: "wk-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WatchKitAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_unsupported_events() {
        let storage = InMemoryStorage::new();
        let handler = WatchKitAdapterHandlerImpl;
        let result = handler.normalize(
            WatchKitAdapterNormalizeInput {
                adapter: "wk-1".to_string(),
                props: r#"{"onscroll":"handler","onlongpress":"handler2"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WatchKitAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("__unsupported"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
