// VanillaAdapter handler implementation
// Transforms framework-neutral props into vanilla DOM APIs:
// addEventListener, classList, style property assignments.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::VanillaAdapterHandler;
use serde_json::{json, Value};

pub struct VanillaAdapterHandlerImpl;

#[async_trait]
impl VanillaAdapterHandler for VanillaAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: VanillaAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VanillaAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let adapter = &input.adapter;
        let props = &input.props;

        if props.is_empty() || props.trim().is_empty() {
            return Ok(VanillaAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: Value = match serde_json::from_str(props) {
            Ok(v) => v,
            Err(_) => return Ok(VanillaAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let parsed_obj = match parsed.as_object() {
            Some(o) => o,
            None => return Ok(VanillaAdapterNormalizeOutput::Error {
                message: "Props must be a JSON object".to_string(),
            }),
        };

        let mut normalized = serde_json::Map::new();

        for (key, value) in parsed_obj {
            // ARIA and data-* pass through unchanged
            if key.starts_with("aria-") || key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> classList array
            if key == "class" {
                if let Some(s) = value.as_str() {
                    let classes: Vec<&str> = s.split_whitespace().filter(|c| !c.is_empty()).collect();
                    normalized.insert("classList".to_string(), json!(classes));
                } else {
                    normalized.insert("classList".to_string(), value.clone());
                }
                continue;
            }

            // Event handlers: onclick -> addEventListener
            if key.starts_with("on") {
                let event_name = key[2..].to_lowercase();
                normalized.insert(
                    format!("addEventListener:{}", event_name),
                    json!({"addEventListener": {"event": event_name, "handler": value}}),
                );
                continue;
            }

            // style -> style property assignments
            if key == "style" {
                normalized.insert("style".to_string(), json!({"__propertyAssignment": true, "value": value}));
                continue;
            }

            // All other props -> setAttribute
            normalized.insert(key.clone(), json!({"setAttribute": {"name": key, "value": value}}));
        }

        let normalized_str = serde_json::to_string(&Value::Object(normalized))?;

        storage.put("output", adapter, json!({
            "adapter": adapter,
            "normalized": &normalized_str,
        })).await?;

        Ok(VanillaAdapterNormalizeOutput::Ok {
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
        let handler = VanillaAdapterHandlerImpl;
        let result = handler.normalize(
            VanillaAdapterNormalizeInput {
                adapter: "va-1".to_string(),
                props: r#"{"class":"btn primary","onclick":"handleClick","aria-label":"Submit"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VanillaAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "va-1");
                assert!(normalized.contains("classList"));
                assert!(normalized.contains("addEventListener"));
                assert!(normalized.contains("aria-label"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = VanillaAdapterHandlerImpl;
        let result = handler.normalize(
            VanillaAdapterNormalizeInput {
                adapter: "va-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VanillaAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = VanillaAdapterHandlerImpl;
        let result = handler.normalize(
            VanillaAdapterNormalizeInput {
                adapter: "va-1".to_string(),
                props: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VanillaAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
