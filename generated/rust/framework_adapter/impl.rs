// FrameworkAdapter concept implementation
// Detects target framework and delegates normalization to appropriate framework-specific adapters.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FrameworkAdapterHandler;
use serde_json::json;
use std::collections::HashMap;

fn build_framework_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("react", "react-adapter");
    m.insert("vue", "vue-adapter");
    m.insert("solid", "solid-adapter");
    m.insert("solidjs", "solid-adapter");
    m.insert("svelte", "svelte-adapter");
    m.insert("nextjs", "nextjs-adapter");
    m.insert("next", "nextjs-adapter");
    m.insert("vanilla", "vanilla-adapter");
    m.insert("ink", "ink-adapter");
    m.insert("reactnative", "react-native-adapter");
    m.insert("nativescript", "nativescript-adapter");
    m.insert("swiftui", "swiftui-adapter");
    m.insert("appkit", "appkit-adapter");
    m.insert("gtk", "gtk-adapter");
    m.insert("compose", "compose-adapter");
    m.insert("jetpackcompose", "compose-adapter");
    m.insert("winui", "winui-adapter");
    m.insert("xaml", "winui-adapter");
    m.insert("watchkit", "watchkit-adapter");
    m.insert("wearcompose", "wear-compose-adapter");
    m
}

pub struct FrameworkAdapterHandlerImpl;

#[async_trait]
impl FrameworkAdapterHandler for FrameworkAdapterHandlerImpl {
    async fn register(
        &self,
        input: FrameworkAdapterRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterRegisterOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("renderer", &input.renderer).await?;
        if existing.is_some() {
            return Ok(FrameworkAdapterRegisterOutput::Duplicate {
                message: format!("Renderer {} already registered", input.renderer),
            });
        }

        storage.put("renderer", &input.renderer, json!({
            "renderer": input.renderer,
            "framework": input.framework,
            "version": input.version,
            "normalizer": input.normalizer,
            "mountFn": input.mount_fn,
        })).await?;

        Ok(FrameworkAdapterRegisterOutput::Ok { renderer: input.renderer })
    }

    async fn normalize(
        &self,
        input: FrameworkAdapterNormalizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterNormalizeOutput, Box<dyn std::error::Error>> {
        if input.props.trim().is_empty() {
            return Ok(FrameworkAdapterNormalizeOutput::Notfound {
                message: "Props cannot be empty".to_string(),
            });
        }

        let parsed: serde_json::Value = serde_json::from_str(&input.props)?;
        let framework_map = build_framework_map();

        let framework_hint = parsed.get("__framework")
            .and_then(|v| v.as_str())
            .unwrap_or(&input.renderer)
            .to_lowercase()
            .replace([' ', '.', '-'], "");

        let delegate_adapter = framework_map.get(framework_hint.as_str());

        let mut normalized = serde_json::Map::new();
        if let Some(obj) = parsed.as_object() {
            for (key, value) in obj {
                if key == "__framework" { continue; }
                normalized.insert(key.clone(), value.clone());
            }
        }

        normalized.insert("__detectedFramework".to_string(), json!(framework_hint));
        if let Some(delegate) = delegate_adapter {
            normalized.insert("__delegateTo".to_string(), json!(delegate));
            normalized.insert("__delegated".to_string(), json!(true));
        } else {
            normalized.insert("__delegated".to_string(), json!(false));
        }

        let normalized_str = serde_json::to_string(&normalized)?;
        storage.put("output", &input.renderer, json!({
            "adapter": input.renderer,
            "normalized": normalized_str,
        })).await?;

        Ok(FrameworkAdapterNormalizeOutput::Ok {
            normalized: normalized_str,
        })
    }

    async fn mount(
        &self,
        input: FrameworkAdapterMountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterMountOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("renderer", &input.renderer).await?;
        if existing.is_none() {
            return Ok(FrameworkAdapterMountOutput::Error {
                message: format!("Renderer {} not found", input.renderer),
            });
        }

        storage.put("mount", &input.renderer, json!({
            "renderer": input.renderer,
            "machine": input.machine,
            "target": input.target,
            "status": "mounted",
        })).await?;

        Ok(FrameworkAdapterMountOutput::Ok { renderer: input.renderer })
    }

    async fn render(
        &self,
        input: FrameworkAdapterRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterRenderOutput, Box<dyn std::error::Error>> {
        // Delegate normalization
        let result = self.normalize(
            FrameworkAdapterNormalizeInput {
                renderer: input.adapter.clone(),
                props: input.props,
            },
            storage,
        ).await?;

        match result {
            FrameworkAdapterNormalizeOutput::Ok { normalized } => {
                Ok(FrameworkAdapterRenderOutput::Ok { normalized })
            }
            FrameworkAdapterNormalizeOutput::Notfound { message } => {
                Ok(FrameworkAdapterRenderOutput::Error { message })
            }
        }
    }

    async fn unmount(
        &self,
        input: FrameworkAdapterUnmountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FrameworkAdapterUnmountOutput, Box<dyn std::error::Error>> {
        storage.del("mount", &input.renderer).await?;
        Ok(FrameworkAdapterUnmountOutput::Ok { renderer: input.renderer })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = FrameworkAdapterHandlerImpl;
        let result = handler.register(
            FrameworkAdapterRegisterInput {
                renderer: "react-renderer".to_string(),
                framework: "react".to_string(),
                version: "18.0".to_string(),
                normalizer: "react-normalize".to_string(),
                mount_fn: "ReactDOM.render".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FrameworkAdapterRegisterOutput::Ok { renderer } => {
                assert_eq!(renderer, "react-renderer");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate() {
        let storage = InMemoryStorage::new();
        let handler = FrameworkAdapterHandlerImpl;
        handler.register(
            FrameworkAdapterRegisterInput {
                renderer: "r1".to_string(),
                framework: "react".to_string(),
                version: "18".to_string(),
                normalizer: "n1".to_string(),
                mount_fn: "m1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            FrameworkAdapterRegisterInput {
                renderer: "r1".to_string(),
                framework: "vue".to_string(),
                version: "3".to_string(),
                normalizer: "n2".to_string(),
                mount_fn: "m2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FrameworkAdapterRegisterOutput::Duplicate { .. } => {},
            _ => panic!("Expected Duplicate variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_empty_props() {
        let storage = InMemoryStorage::new();
        let handler = FrameworkAdapterHandlerImpl;
        let result = handler.normalize(
            FrameworkAdapterNormalizeInput {
                renderer: "r1".to_string(),
                props: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FrameworkAdapterNormalizeOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_normalize_with_framework_hint() {
        let storage = InMemoryStorage::new();
        let handler = FrameworkAdapterHandlerImpl;
        let result = handler.normalize(
            FrameworkAdapterNormalizeInput {
                renderer: "r1".to_string(),
                props: r#"{"__framework":"react","label":"Hello"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FrameworkAdapterNormalizeOutput::Ok { normalized } => {
                assert!(normalized.contains("react"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_mount_renderer_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FrameworkAdapterHandlerImpl;
        let result = handler.mount(
            FrameworkAdapterMountInput {
                renderer: "missing".to_string(),
                machine: "m1".to_string(),
                target: "#app".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FrameworkAdapterMountOutput::Error { .. } => {},
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_unmount_success() {
        let storage = InMemoryStorage::new();
        let handler = FrameworkAdapterHandlerImpl;
        let result = handler.unmount(
            FrameworkAdapterUnmountInput {
                renderer: "r1".to_string(),
                target: "#app".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FrameworkAdapterUnmountOutput::Ok { renderer } => {
                assert_eq!(renderer, "r1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
