// InkAdapter -- transforms framework-neutral props into Ink (terminal React) bindings.
// Terminal-compatible event handlers, Box/Text styles, accessibility pass-through.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::InkAdapterHandler;
use serde_json::json;

pub struct InkAdapterHandlerImpl;

/// Map standard DOM event names to Ink terminal event names.
fn ink_event_name(key: &str) -> Option<&'static str> {
    match key.to_lowercase().as_str() {
        "onclick" => Some("onPress"),
        "onfocus" => Some("onFocus"),
        "onblur" => Some("onBlur"),
        "onkeydown" => Some("onKeyDown"),
        "onsubmit" => Some("onSubmit"),
        _ => None,
    }
}

#[async_trait]
impl InkAdapterHandler for InkAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: InkAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<InkAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let props_str = input.props.trim();
        if props_str.is_empty() {
            return Ok(InkAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Value = match serde_json::from_str(props_str) {
            Ok(v) => v,
            Err(_) => {
                return Ok(InkAdapterNormalizeOutput::Error {
                    message: "Props must be valid JSON".to_string(),
                });
            }
        };

        let obj = match parsed.as_object() {
            Some(o) => o,
            None => {
                return Ok(InkAdapterNormalizeOutput::Error {
                    message: "Props must be a JSON object".to_string(),
                });
            }
        };

        let mut normalized = serde_json::Map::new();

        for (key, value) in obj {
            // ARIA and data-* pass through unchanged
            if key.starts_with("aria-") || key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> Ink style object (no CSS classes in terminal)
            if key == "class" {
                normalized.insert(
                    "style".to_string(),
                    json!({ "__terminalStyle": true, "className": value }),
                );
                continue;
            }

            // Event handlers -> terminal-compatible handlers
            if key.starts_with("on") {
                if let Some(ink_event) = ink_event_name(key) {
                    normalized.insert(ink_event.to_string(), value.clone());
                } else {
                    // Unsupported events in terminal context are dropped with a marker
                    normalized.insert(format!("__unsupported:{}", key), value.clone());
                }
                continue;
            }

            // style -> Ink Box/Text style props
            if key == "style" {
                normalized.insert("style".to_string(), value.clone());
                continue;
            }

            // Color props -> Ink color system
            if key == "color" || key == "backgroundColor" {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // All other props pass through
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized)?;

        storage.put(
            "output",
            &input.adapter,
            json!({ "adapter": input.adapter, "normalized": normalized_str }),
        ).await?;

        Ok(InkAdapterNormalizeOutput::Ok {
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
        let handler = InkAdapterHandlerImpl;
        let result = handler.normalize(
            InkAdapterNormalizeInput {
                adapter: "ink-1".to_string(),
                props: r#"{"label": "Hello", "color": "red"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InkAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "ink-1");
                assert!(normalized.contains("label"));
                assert!(normalized.contains("red"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = InkAdapterHandlerImpl;
        let result = handler.normalize(
            InkAdapterNormalizeInput {
                adapter: "ink-2".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InkAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = InkAdapterHandlerImpl;
        let result = handler.normalize(
            InkAdapterNormalizeInput {
                adapter: "ink-3".to_string(),
                props: "not json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InkAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("valid JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_event_mapping() {
        let storage = InMemoryStorage::new();
        let handler = InkAdapterHandlerImpl;
        let result = handler.normalize(
            InkAdapterNormalizeInput {
                adapter: "ink-4".to_string(),
                props: r#"{"onClick": "handler", "aria-label": "btn"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InkAdapterNormalizeOutput::Ok { normalized, .. } => {
                // onClick should be mapped to onPress
                assert!(normalized.contains("onPress"));
                // aria- attributes pass through
                assert!(normalized.contains("aria-label"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_class_to_style() {
        let storage = InMemoryStorage::new();
        let handler = InkAdapterHandlerImpl;
        let result = handler.normalize(
            InkAdapterNormalizeInput {
                adapter: "ink-5".to_string(),
                props: r#"{"class": "my-class"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            InkAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("style"));
                assert!(normalized.contains("__terminalStyle"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
