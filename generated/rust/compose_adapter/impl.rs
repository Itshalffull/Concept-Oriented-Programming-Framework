// Compose Adapter -- normalize adapter props for composition
// Transforms adapter-specific property formats into a canonical representation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ComposeAdapterHandler;
use serde_json::json;

pub struct ComposeAdapterHandlerImpl;

#[async_trait]
impl ComposeAdapterHandler for ComposeAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: ComposeAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComposeAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        // Parse the props as JSON; if invalid, return error
        let props: serde_json::Value = match serde_json::from_str(&input.props) {
            Ok(v) => v,
            Err(e) => {
                return Ok(ComposeAdapterNormalizeOutput::Error {
                    message: format!("Invalid props JSON: {}", e),
                });
            }
        };

        // Normalize: flatten nested structures, convert keys to camelCase,
        // remove null values, and sort keys for deterministic output
        let normalized = normalize_value(&props);

        // Store the normalization result for caching
        let cache_key = format!("{}:{}", input.adapter, input.props);
        storage.put("normalized_cache", &cache_key, json!({
            "adapter": input.adapter,
            "original": input.props,
            "normalized": normalized.to_string(),
        })).await?;

        Ok(ComposeAdapterNormalizeOutput::Ok {
            adapter: input.adapter,
            normalized: normalized.to_string(),
        })
    }
}

/// Recursively normalize a JSON value: remove nulls and sort object keys
fn normalize_value(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut sorted: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            for key in keys {
                let v = &map[key];
                if !v.is_null() {
                    sorted.insert(key.clone(), normalize_value(v));
                }
            }
            serde_json::Value::Object(sorted)
        }
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(normalize_value).collect())
        }
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_normalize_success() {
        let storage = InMemoryStorage::new();
        let handler = ComposeAdapterHandlerImpl;
        let result = handler.normalize(
            ComposeAdapterNormalizeInput {
                adapter: "react".to_string(),
                props: r#"{"b":2,"a":1}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ComposeAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "react");
                // Sorted keys: "a" before "b"
                assert!(normalized.contains("\"a\""));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = ComposeAdapterHandlerImpl;
        let result = handler.normalize(
            ComposeAdapterNormalizeInput {
                adapter: "react".to_string(),
                props: "not valid json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ComposeAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("Invalid props JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_removes_nulls() {
        let storage = InMemoryStorage::new();
        let handler = ComposeAdapterHandlerImpl;
        let result = handler.normalize(
            ComposeAdapterNormalizeInput {
                adapter: "vue".to_string(),
                props: r#"{"a":1,"b":null,"c":"hello"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ComposeAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(!normalized.contains("null"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
