// BrowserAdapter concept implementation
// Transforms framework-neutral props into browser Web API bindings:
// addEventListener, DOM events, Web Components attributes.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::BrowserAdapterHandler;
use serde_json::json;

pub struct BrowserAdapterHandlerImpl;

#[async_trait]
impl BrowserAdapterHandler for BrowserAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: BrowserAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BrowserAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.trim().is_empty() {
            return Ok(BrowserAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(&input.props) {
            Ok(v) => v,
            Err(_) => return Ok(BrowserAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let mut normalized = serde_json::Map::new();

        for (key, value) in &parsed {
            // ARIA and data-* pass through unchanged (native browser attributes)
            if key.starts_with("aria-") || key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> classList manipulation
            if key == "class" {
                if let Some(s) = value.as_str() {
                    let classes: Vec<&str> = s.split_whitespace().filter(|s| !s.is_empty()).collect();
                    normalized.insert("classList".to_string(), json!(classes));
                } else {
                    normalized.insert("classList".to_string(), value.clone());
                }
                continue;
            }

            // Event handlers -> addEventListener
            if key.starts_with("on") {
                let event_type = key[2..].to_lowercase();
                normalized.insert(
                    format!("addEventListener:{}", event_type),
                    json!({
                        "addEventListener": {
                            "type": event_type,
                            "listener": value,
                        }
                    }),
                );
                continue;
            }

            // style -> CSSStyleDeclaration assignments
            if key == "style" {
                normalized.insert("style".to_string(), json!({
                    "__cssStyleDeclaration": true,
                    "value": value,
                }));
                continue;
            }

            // slot -> Web Component slot attribute
            if key == "slot" {
                normalized.insert("slot".to_string(), value.clone());
                continue;
            }

            // part -> Web Component CSS part
            if key == "part" {
                normalized.insert("part".to_string(), value.clone());
                continue;
            }

            // All other props -> setAttribute
            normalized.insert(key.clone(), json!({
                "setAttribute": {
                    "name": key,
                    "value": value,
                }
            }));
        }

        let normalized_str = serde_json::to_string(&normalized)?;

        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str,
        })).await?;

        Ok(BrowserAdapterNormalizeOutput::Ok {
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
    async fn test_normalize_valid_props() {
        let storage = InMemoryStorage::new();
        let handler = BrowserAdapterHandlerImpl;
        let result = handler.normalize(
            BrowserAdapterNormalizeInput {
                adapter: "browser-1".to_string(),
                props: r#"{"title":"Hello","class":"btn primary"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BrowserAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "browser-1");
                assert!(normalized.contains("classList"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = BrowserAdapterHandlerImpl;
        let result = handler.normalize(
            BrowserAdapterNormalizeInput {
                adapter: "browser-2".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BrowserAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("cannot be empty"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json_returns_error() {
        let storage = InMemoryStorage::new();
        let handler = BrowserAdapterHandlerImpl;
        let result = handler.normalize(
            BrowserAdapterNormalizeInput {
                adapter: "browser-3".to_string(),
                props: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BrowserAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("valid JSON"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_event_handlers() {
        let storage = InMemoryStorage::new();
        let handler = BrowserAdapterHandlerImpl;
        let result = handler.normalize(
            BrowserAdapterNormalizeInput {
                adapter: "browser-4".to_string(),
                props: r#"{"onclick":"handleClick"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BrowserAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("addEventListener"));
                assert!(normalized.contains("click"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_aria_passthrough() {
        let storage = InMemoryStorage::new();
        let handler = BrowserAdapterHandlerImpl;
        let result = handler.normalize(
            BrowserAdapterNormalizeInput {
                adapter: "browser-5".to_string(),
                props: r#"{"aria-label":"Close","data-testid":"btn"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BrowserAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(normalized.contains("aria-label"));
                assert!(normalized.contains("data-testid"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
