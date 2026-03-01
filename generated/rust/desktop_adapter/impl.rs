// DesktopAdapter Handler Implementation
//
// Transforms framework-neutral props into desktop application
// bindings: Electron/Tauri IPC channels, native window events.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DesktopAdapterHandler;
use serde_json::json;
use std::collections::HashMap;

fn build_ipc_map() -> HashMap<&'static str, &'static str> {
    let mut map = HashMap::new();
    map.insert("onclick", "click");
    map.insert("ondoubleclick", "double-click");
    map.insert("onchange", "change");
    map.insert("onsubmit", "submit");
    map.insert("onfocus", "focus");
    map.insert("onblur", "blur");
    map.insert("onkeydown", "key-down");
    map.insert("onkeyup", "key-up");
    map.insert("onclose", "close");
    map.insert("onminimize", "minimize");
    map.insert("onmaximize", "maximize");
    map.insert("onresize", "resize");
    map.insert("onmove", "move");
    map.insert("ondrag", "drag");
    map.insert("ondrop", "drop");
    map
}

pub struct DesktopAdapterHandlerImpl;

#[async_trait]
impl DesktopAdapterHandler for DesktopAdapterHandlerImpl {
    async fn normalize(
        &self,
        input: DesktopAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DesktopAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.trim().is_empty() {
            return Ok(DesktopAdapterNormalizeOutput::Error {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Map<String, serde_json::Value> = match serde_json::from_str(&input.props) {
            Ok(serde_json::Value::Object(m)) => m,
            _ => return Ok(DesktopAdapterNormalizeOutput::Error {
                message: "Props must be valid JSON".to_string(),
            }),
        };

        let ipc_map = build_ipc_map();
        let mut normalized = serde_json::Map::new();

        for (key, value) in &parsed {
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

            // Event handlers -> IPC channel bindings
            if key.starts_with("on") {
                let lower = key.to_lowercase();
                let channel = if let Some(&ch) = ipc_map.get(lower.as_str()) {
                    ch.to_string()
                } else {
                    key[2..].to_lowercase()
                };
                let ipc_key = format!("ipc:{}", channel);
                normalized.insert(ipc_key, json!({
                    "ipc": { "channel": channel, "handler": value }
                }));
                continue;
            }

            // All other props pass through
            normalized.insert(key.clone(), value.clone());
        }

        let normalized_str = serde_json::to_string(&normalized)?;
        storage.put("output", &input.adapter, json!({
            "adapter": input.adapter,
            "normalized": normalized_str,
        })).await?;

        Ok(DesktopAdapterNormalizeOutput::Ok {
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
        let handler = DesktopAdapterHandlerImpl;
        let result = handler.normalize(
            DesktopAdapterNormalizeInput {
                adapter: "desktop-1".to_string(),
                props: r#"{"class":"btn","onclick":"handleClick","aria-label":"submit"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesktopAdapterNormalizeOutput::Ok { adapter, normalized } => {
                assert_eq!(adapter, "desktop-1");
                assert!(normalized.contains("className"));
                assert!(normalized.contains("ipc:click"));
                assert!(normalized.contains("aria-label"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = DesktopAdapterHandlerImpl;
        let result = handler.normalize(
            DesktopAdapterNormalizeInput {
                adapter: "desktop-1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesktopAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("empty"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = DesktopAdapterHandlerImpl;
        let result = handler.normalize(
            DesktopAdapterNormalizeInput {
                adapter: "desktop-1".to_string(),
                props: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DesktopAdapterNormalizeOutput::Error { message } => {
                assert!(message.contains("valid JSON"));
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
