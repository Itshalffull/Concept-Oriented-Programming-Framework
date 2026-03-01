// NextjsAdapter -- transforms framework-neutral props into Next.js React bindings.
// Converts onclick -> onClick, class -> className, for -> htmlFor.
// Marks interactive components with 'use client' directive via __useClient flag.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::NextjsAdapterHandler;
use serde_json::json;

pub struct NextjsAdapterHandlerImpl;

/// Convert a lowercase DOM event name to React camelCase convention.
fn to_react_event_name(key: &str) -> String {
    if !key.starts_with("on") {
        return key.to_string();
    }
    let event_part = &key[2..];
    if event_part.is_empty() {
        return key.to_string();
    }
    let mut chars = event_part.chars();
    let first = chars.next().unwrap().to_uppercase().to_string();
    format!("on{}{}", first, chars.collect::<String>())
}

#[async_trait]
impl NextjsAdapterHandler for NextjsAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: NextjsAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<NextjsAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        let props_str = input.props.trim();
        if props_str.is_empty() {
            return Ok(NextjsAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Value = match serde_json::from_str(props_str) {
            Ok(v) => v,
            Err(_) => {
                return Ok(NextjsAdapterNormalizeOutput::Error {
                    message: "Props must be valid JSON".to_string(),
                });
            }
        };

        let obj = match parsed.as_object() {
            Some(o) => o,
            None => {
                return Ok(NextjsAdapterNormalizeOutput::Error {
                    message: "Props must be a JSON object".to_string(),
                });
            }
        };

        let mut normalized = serde_json::Map::new();
        let mut has_interactivity = false;

        for (key, value) in obj {
            // ARIA and data-* pass through unchanged
            if key.starts_with("aria-") || key.starts_with("data-") {
                normalized.insert(key.clone(), value.clone());
                continue;
            }

            // class -> className
            if key == "class" {
                normalized.insert("className".to_string(), value.clone());
                continue;
            }

            // for -> htmlFor
            if key == "for" {
                normalized.insert("htmlFor".to_string(), value.clone());
                continue;
            }

            // Event handlers: onclick -> onClick, mark as interactive
            if key.starts_with("on") {
                has_interactivity = true;
                let react_name = to_react_event_name(key);
                normalized.insert(
                    react_name,
                    json!({ "__syntheticEvent": true, "handler": value }),
                );
                continue;
            }

            // style as string -> wrap as __cssText object
            if key == "style" {
                if value.is_string() {
                    normalized.insert("style".to_string(), json!({ "__cssText": value }));
                } else {
                    normalized.insert("style".to_string(), value.clone());
                }
                continue;
            }

            // All other props pass through
            normalized.insert(key.clone(), value.clone());
        }

        // Mark interactive components with 'use client' directive
        if has_interactivity {
            normalized.insert("__useClient".to_string(), json!(true));
        }

        let normalized_str = serde_json::to_string(&normalized)?;

        storage.put(
            "output",
            &input.adapter,
            json!({ "adapter": input.adapter, "normalized": normalized_str }),
        ).await?;

        Ok(NextjsAdapterNormalizeOutput::Ok {
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
        let handler = NextjsAdapterHandlerImpl;
        let result = handler.normalize(
            NextjsAdapterNormalizeInput {
                adapter: "nxt-1".into(),
                props: r#"{"class":"btn","for":"name-field","onclick":"handleClick"}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            NextjsAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "nxt-1");
                assert!(normalized.contains("className"));
                assert!(normalized.contains("htmlFor"));
                assert!(normalized.contains("onClick"));
                assert!(normalized.contains("__useClient"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = NextjsAdapterHandlerImpl;
        let result = handler.normalize(
            NextjsAdapterNormalizeInput { adapter: "nxt-1".into(), props: "".into() },
            &storage,
        ).await.unwrap();
        match result {
            NextjsAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            }
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = NextjsAdapterHandlerImpl;
        let result = handler.normalize(
            NextjsAdapterNormalizeInput { adapter: "nxt-1".into(), props: "bad json".into() },
            &storage,
        ).await.unwrap();
        match result {
            NextjsAdapterNormalizeOutput::Error { .. } => {}
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_no_events_no_use_client() {
        let storage = InMemoryStorage::new();
        let handler = NextjsAdapterHandlerImpl;
        let result = handler.normalize(
            NextjsAdapterNormalizeInput {
                adapter: "nxt-2".into(),
                props: r#"{"class":"text","aria-label":"greeting"}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            NextjsAdapterNormalizeOutput::Ok { normalized, .. } => {
                assert!(!normalized.contains("__useClient"));
                assert!(normalized.contains("className"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
