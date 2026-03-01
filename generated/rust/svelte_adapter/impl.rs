// Svelte adapter: transforms framework-neutral props into Svelte bindings.
// Handles on:click handlers, class directives, bind: directives, and ARIA passthrough.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SvelteAdapterHandler;
use serde_json::json;

pub struct SvelteAdapterHandlerImpl;

#[async_trait]
impl SvelteAdapterHandler for SvelteAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: SvelteAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SvelteAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let adapter = &input.adapter;
        let props = &input.props;

        if props.trim().is_empty() {
            return Ok(SvelteAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(props) {
            Ok(serde_json::Value::Object(map)) => map,
            _ => {
                return Ok(SvelteAdapterNormalizeOutput::Error {
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

            // class -> Svelte class directive
            if key == "class" {
                normalized.insert("class".to_string(), value.clone());
                continue;
            }

            // Event handlers: onclick -> on:click
            if key.starts_with("on") && key.len() > 2 {
                let event_name = key[2..].to_lowercase();
                normalized.insert(format!("on:{}", event_name), value.clone());
                continue;
            }

            // bind: directives pass through
            if key.starts_with("bind:") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // style -> Svelte style prop
            if key == "style" {
                normalized.insert("style".to_string(), value.clone());
                continue;
            }

            // Two-way binding props (prefixed with $) -> bind: directive
            if key.starts_with('$') {
                let prop_name = &key[1..];
                normalized.insert(format!("bind:{}", prop_name), value.clone());
                continue;
            }

            // All other props pass through
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized).unwrap_or_else(|_| "{}".to_string());

        storage.put("output", adapter, json!({
            "adapter": adapter,
            "normalized": &normalized_str,
        })).await?;

        Ok(SvelteAdapterNormalizeOutput::Ok {
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
    async fn test_normalize_event_handlers() {
        let storage = InMemoryStorage::new();
        let handler = SvelteAdapterHandlerImpl;
        let result = handler.normalize(
            SvelteAdapterNormalizeInput {
                adapter: "svelte-adapter".to_string(),
                props: r#"{"onclick":"handleClick","class":"btn"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SvelteAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("on:click"));
                assert!(normalized.contains("class"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = SvelteAdapterHandlerImpl;
        let result = handler.normalize(
            SvelteAdapterNormalizeInput {
                adapter: "svelte-adapter".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SvelteAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = SvelteAdapterHandlerImpl;
        let result = handler.normalize(
            SvelteAdapterNormalizeInput {
                adapter: "svelte-adapter".to_string(),
                props: "not json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SvelteAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("valid JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_aria_passthrough() {
        let storage = InMemoryStorage::new();
        let handler = SvelteAdapterHandlerImpl;
        let result = handler.normalize(
            SvelteAdapterNormalizeInput {
                adapter: "svelte-adapter".to_string(),
                props: r#"{"aria-label":"Submit","data-testid":"btn"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SvelteAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("aria-label"));
                assert!(normalized.contains("data-testid"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
