// NativeScriptAdapter -- transforms framework-neutral props into NativeScript bindings.
// Maps events to on({ tap: handler }) pattern, class to cssClass, aria-* to accessible-* props.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::NativeScriptAdapterHandler;
use serde_json::json;

pub struct NativeScriptAdapterHandlerImpl;

/// Map standard DOM event names to NativeScript gesture/event names.
fn nativescript_event_name(key: &str) -> Option<&'static str> {
    match key.to_lowercase().as_str() {
        "onclick" => Some("tap"),
        "ondoubleclick" => Some("doubleTap"),
        "onlongpress" => Some("longPress"),
        "onswipe" => Some("swipe"),
        "onpan" => Some("pan"),
        "onpinch" => Some("pinch"),
        "onrotation" => Some("rotation"),
        "ontouch" => Some("touch"),
        "onloaded" => Some("loaded"),
        "onunloaded" => Some("unloaded"),
        "onchange" => Some("propertyChange"),
        "onfocus" => Some("focus"),
        "onblur" => Some("blur"),
        _ => None,
    }
}

#[async_trait]
impl NativeScriptAdapterHandler for NativeScriptAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: NativeScriptAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NativeScriptAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let props_str = input.props.trim();
        if props_str.is_empty() {
            return Ok(NativeScriptAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Value = match serde_json::from_str(props_str) {
            Ok(v) => v,
            Err(_) => {
                return Ok(NativeScriptAdapterNormalizeOutput::Error {
                    message: "Props must be valid JSON".to_string(),
                });
            }
        };

        let obj = match parsed.as_object() {
            Some(o) => o,
            None => {
                return Ok(NativeScriptAdapterNormalizeOutput::Error {
                    message: "Props must be a JSON object".to_string(),
                });
            }
        };

        let mut normalized = serde_json::Map::new();

        for (key, value) in obj {
            // ARIA -> NativeScript accessibility props
            if key.starts_with("aria-") {
                let a11y_prop = key.replace("aria-", "accessible-");
                normalized.insert(a11y_prop, value.clone());
                continue;
            }

            // data-* pass through
            if key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> NativeScript CSS class
            if key == "class" {
                normalized.insert("cssClass".to_string(), value.clone());
                continue;
            }

            // Event handlers -> NativeScript on({ event: handler }) pattern
            if key.starts_with("on") {
                let ns_event = nativescript_event_name(key);
                let event_name = if let Some(mapped) = ns_event {
                    mapped.to_string()
                } else {
                    key[2..].to_lowercase()
                };

                normalized.insert(
                    format!("on:{}", event_name),
                    json!({ "on": { event_name: value } }),
                );
                continue;
            }

            // style -> NativeScript inline style
            if key == "style" {
                normalized.insert("style".to_string(), value.clone());
                continue;
            }

            // All other props -> native view property
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized)?;

        storage.put(
            "output",
            &input.adapter,
            json!({ "adapter": input.adapter, "normalized": normalized_str }),
        ).await?;

        Ok(NativeScriptAdapterNormalizeOutput::Ok {
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
        let handler = NativeScriptAdapterHandlerImpl;
        let result = handler.normalize(
            NativeScriptAdapterNormalizeInput {
                adapter: "ns-1".into(),
                props: r#"{"onclick":"tap","class":"btn","aria-label":"Submit"}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            NativeScriptAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "ns-1");
                assert!(normalized.contains("cssClass"));
                assert!(normalized.contains("accessible-label"));
                assert!(normalized.contains("on:tap"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = NativeScriptAdapterHandlerImpl;
        let result = handler.normalize(
            NativeScriptAdapterNormalizeInput { adapter: "ns-1".into(), props: "".into() },
            &storage,
        ).await.unwrap();
        match result {
            NativeScriptAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = NativeScriptAdapterHandlerImpl;
        let result = handler.normalize(
            NativeScriptAdapterNormalizeInput { adapter: "ns-1".into(), props: "not-json".into() },
            &storage,
        ).await.unwrap();
        match result {
            NativeScriptAdapterNormalizeOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }
}
