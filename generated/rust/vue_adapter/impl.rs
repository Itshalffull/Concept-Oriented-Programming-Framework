// VueAdapter handler implementation
// Transforms framework-neutral props into Vue 3 bindings:
// v-on event handlers, v-bind, class binding objects, Vue refs.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::VueAdapterHandler;
use serde_json::{json, Value};

pub struct VueAdapterHandlerImpl;

#[async_trait]
impl VueAdapterHandler for VueAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: VueAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VueAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let adapter = &input.adapter;
        let props = &input.props;

        if props.is_empty() || props.trim().is_empty() {
            return Ok(VueAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: Value = match serde_json::from_str(props) {
            Ok(v) => v,
            Err(_) => return Ok(VueAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let parsed_obj = match parsed.as_object() {
            Some(o) => o,
            None => return Ok(VueAdapterNormalizeOutput::Error {
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

            // class -> Vue class binding object
            if key == "class" {
                if let Some(s) = value.as_str() {
                    let mut class_obj = serde_json::Map::new();
                    for cls in s.split_whitespace().filter(|c| !c.is_empty()) {
                        class_obj.insert(cls.to_string(), json!(true));
                    }
                    normalized.insert(":class".to_string(), Value::Object(class_obj));
                } else {
                    normalized.insert(":class".to_string(), value.clone());
                }
                continue;
            }

            // Event handlers: onclick -> v-on:click
            if key.starts_with("on") {
                let event_name = key[2..].to_lowercase();
                normalized.insert(format!("v-on:{}", event_name), value.clone());
                continue;
            }

            // style -> v-bind:style
            if key == "style" {
                normalized.insert("v-bind:style".to_string(), value.clone());
                continue;
            }

            // ref -> Vue ref binding
            if key == "ref" {
                normalized.insert("ref".to_string(), json!({"__vueRef": true, "value": value}));
                continue;
            }

            // All other props -> v-bind
            normalized.insert(format!("v-bind:{}", key), value.clone());
        }

        let normalized_str = serde_json::to_string(&Value::Object(normalized))?;

        storage.put("output", adapter, json!({
            "adapter": adapter,
            "normalized": &normalized_str,
        })).await?;

        Ok(VueAdapterNormalizeOutput::Ok {
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
        let handler = VueAdapterHandlerImpl;
        let result = handler.normalize(
            VueAdapterNormalizeInput {
                adapter: "vue-1".to_string(),
                props: r#"{"class":"btn primary","onclick":"handleClick","title":"Go"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VueAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "vue-1");
                assert!(normalized.contains(":class"));
                assert!(normalized.contains("v-on:click"));
                assert!(normalized.contains("v-bind:title"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = VueAdapterHandlerImpl;
        let result = handler.normalize(
            VueAdapterNormalizeInput {
                adapter: "vue-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VueAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = VueAdapterHandlerImpl;
        let result = handler.normalize(
            VueAdapterNormalizeInput {
                adapter: "vue-1".to_string(),
                props: "not json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VueAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
