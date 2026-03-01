// Solid.js adapter: transforms framework-neutral props into Solid.js bindings.
// Events stay lowercase (onclick), class stays as class, createSignal wrappers for reactive state.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SolidAdapterHandler;
use serde_json::json;

pub struct SolidAdapterHandlerImpl;

#[async_trait]
impl SolidAdapterHandler for SolidAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: SolidAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SolidAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let adapter = &input.adapter;
        let props = &input.props;

        if props.trim().is_empty() {
            return Ok(SolidAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(props) {
            Ok(serde_json::Value::Object(map)) => map,
            _ => {
                return Ok(SolidAdapterNormalizeOutput::Error {
                    message: "Props must be valid JSON".to_string(),
                });
            }
        };

        let mut normalized = serde_json::Map::new();

        for (key, value) in &parsed {
            // ARIA and data-* pass through unchanged
            if key.starts_with("aria-") || key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class stays as class in Solid (not className)
            if key == "class" {
                normalized.insert("class".to_string(), value.clone());
                continue;
            }

            // Event handlers: Solid uses lowercase native event names (onclick, oninput)
            if key.starts_with("on") && key.len() > 2 {
                normalized.insert(key.to_lowercase(), value.clone());
                continue;
            }

            // style -> Solid supports both string and object styles
            if key == "style" {
                normalized.insert("style".to_string(), value.clone());
                continue;
            }

            // Reactive props -> wrap with createSignal accessor pattern
            if key.starts_with('$') {
                let prop_name = &key[1..];
                normalized.insert(prop_name.to_string(), json!({
                    "__createSignal": true,
                    "value": value,
                }));
                continue;
            }

            // All other props pass through
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized)
            .unwrap_or_else(|_| "{}".to_string());

        storage.put("output", adapter, json!({
            "adapter": adapter,
            "normalized": &normalized_str,
        })).await?;

        Ok(SolidAdapterNormalizeOutput::Ok {
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
        let handler = SolidAdapterHandlerImpl;
        let result = handler.normalize(
            SolidAdapterNormalizeInput {
                adapter: "solid".to_string(),
                props: r#"{"class":"btn","onClick":"handler"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "solid");
                assert!(normalized.contains("class"));
                assert!(normalized.contains("onclick"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = SolidAdapterHandlerImpl;
        let result = handler.normalize(
            SolidAdapterNormalizeInput {
                adapter: "solid".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidAdapterNormalizeOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = SolidAdapterHandlerImpl;
        let result = handler.normalize(
            SolidAdapterNormalizeInput {
                adapter: "solid".to_string(),
                props: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidAdapterNormalizeOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_reactive_props() {
        let storage = InMemoryStorage::new();
        let handler = SolidAdapterHandlerImpl;
        let result = handler.normalize(
            SolidAdapterNormalizeInput {
                adapter: "solid-reactive".to_string(),
                props: r#"{"$count":"0","$name":"default"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("__createSignal"));
                assert!(normalized.contains("count"));
                assert!(normalized.contains("name"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_normalize_aria_and_data_passthrough() {
        let storage = InMemoryStorage::new();
        let handler = SolidAdapterHandlerImpl;
        let result = handler.normalize(
            SolidAdapterNormalizeInput {
                adapter: "solid-aria".to_string(),
                props: r#"{"aria-label":"Submit","data-testid":"btn","id":"main"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("aria-label"));
                assert!(normalized.contains("data-testid"));
                assert!(normalized.contains("id"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_normalize_style_passthrough() {
        let storage = InMemoryStorage::new();
        let handler = SolidAdapterHandlerImpl;
        let result = handler.normalize(
            SolidAdapterNormalizeInput {
                adapter: "solid-style".to_string(),
                props: r#"{"style":{"color":"red","fontSize":"14px"}}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SolidAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("style"));
                assert!(normalized.contains("color"));
            },
            other => panic!("Expected Ok variant, got {:?}", other),
        }
    }
}
