// WearComposeAdapter handler implementation
// Transforms framework-neutral props into Wear OS Compose bindings:
// Modifier chains, reduced interaction set for wearables,
// rotary input, curved layouts.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::WearComposeAdapterHandler;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

fn wear_compose_modifier_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("onclick", "Modifier.clickable");
    m.insert("onlongpress", "Modifier.combinedClickable(onLongClick)");
    m.insert("onscroll", "Modifier.rotaryScrollable");
    m.insert("onfocus", "Modifier.onFocusChanged");
    m
}

fn unsupported_wear_events() -> HashSet<&'static str> {
    let mut s = HashSet::new();
    for e in &["ondoubleclick", "ondrag", "ondrop", "onhover",
               "onmouseenter", "onmouseleave", "onkeydown", "onkeyup",
               "onresize", "oncontextmenu"] {
        s.insert(*e);
    }
    s
}

pub struct WearComposeAdapterHandlerImpl;

#[async_trait]
impl WearComposeAdapterHandler for WearComposeAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: WearComposeAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WearComposeAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let adapter = &input.adapter;
        let props = &input.props;

        if props.is_empty() || props.trim().is_empty() {
            return Ok(WearComposeAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: Value = match serde_json::from_str(props) {
            Ok(v) => v,
            Err(_) => return Ok(WearComposeAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let parsed_obj = match parsed.as_object() {
            Some(o) => o,
            None => return Ok(WearComposeAdapterNormalizeOutput::Error {
                message: "Props must be a JSON object".to_string(),
            }),
        };

        let modifier_map = wear_compose_modifier_map();
        let unsupported = unsupported_wear_events();
        let mut normalized = serde_json::Map::new();

        for (key, value) in parsed_obj {
            if key.starts_with("aria-") {
                let semantic_prop = key.replace("aria-", "semantics:");
                normalized.insert(semantic_prop, value.clone());
                continue;
            }
            if key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }
            if key == "class" {
                normalized.insert("__themeClass".to_string(), value.clone());
                continue;
            }
            if key.starts_with("on") {
                let lower = key.to_lowercase();
                if unsupported.contains(lower.as_str()) {
                    normalized.insert(format!("__unsupported:{}", key), value.clone());
                    continue;
                }
                if let Some(modifier) = modifier_map.get(lower.as_str()) {
                    normalized.insert(modifier.to_string(), value.clone());
                } else {
                    let event_name = &key[2..];
                    let modifier_name = format!(
                        "Modifier.{}{}",
                        event_name[..1].to_lowercase(),
                        &event_name[1..]
                    );
                    normalized.insert(modifier_name, value.clone());
                }
                continue;
            }
            if key == "style" {
                normalized.insert("__modifierChain".to_string(), value.clone());
                continue;
            }
            if key == "layout" {
                normalized.insert("__curvedLayout".to_string(), value.clone());
                continue;
            }
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&Value::Object(normalized))?;
        storage.put("output", adapter, json!({"adapter": adapter, "normalized": &normalized_str})).await?;

        Ok(WearComposeAdapterNormalizeOutput::Ok {
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
        let handler = WearComposeAdapterHandlerImpl;
        let result = handler.normalize(
            WearComposeAdapterNormalizeInput {
                adapter: "wc-1".to_string(),
                props: r#"{"onclick":"tap","class":"chip","aria-label":"Select","style":{"padding":8}}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WearComposeAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "wc-1");
                assert!(normalized.contains("Modifier.clickable"));
                assert!(normalized.contains("__themeClass"));
                assert!(normalized.contains("semantics:label"));
                assert!(normalized.contains("__modifierChain"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = WearComposeAdapterHandlerImpl;
        let result = handler.normalize(
            WearComposeAdapterNormalizeInput {
                adapter: "wc-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WearComposeAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_unsupported_events() {
        let storage = InMemoryStorage::new();
        let handler = WearComposeAdapterHandlerImpl;
        let result = handler.normalize(
            WearComposeAdapterNormalizeInput {
                adapter: "wc-1".to_string(),
                props: r#"{"ondoubleclick":"handler","ondrag":"handler2"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            WearComposeAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("__unsupported"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
