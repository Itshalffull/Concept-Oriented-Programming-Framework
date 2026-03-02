// ViewportProvider concept implementation
// Tracks viewport dimensions and breakpoints for responsive UI generation.
// Observers are notified when the active breakpoint changes.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ViewportProviderHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct ViewportProviderHandlerImpl {
    counter: AtomicU64,
}

impl ViewportProviderHandlerImpl {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }

    fn match_breakpoint(breakpoints: &[serde_json::Value], width: u32) -> String {
        let mut sorted: Vec<(&str, u32)> = breakpoints
            .iter()
            .filter_map(|bp| {
                let name = bp["name"].as_str()?;
                let min = bp["minWidth"].as_u64()? as u32;
                Some((name, min))
            })
            .collect();
        sorted.sort_by(|a, b| b.1.cmp(&a.1));

        for (name, min_width) in &sorted {
            if width >= *min_width {
                return name.to_string();
            }
        }

        "xs".to_string()
    }
}

#[async_trait]
impl ViewportProviderHandler for ViewportProviderHandlerImpl {
    async fn initialize(
        &self,
        input: ViewportProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportProviderInitializeOutput, Box<dyn std::error::Error>> {
        let plugin_ref = "surface-provider:viewport".to_string();

        let existing = storage
            .find("plugin_definition", Some(&json!({ "pluginRef": plugin_ref })))
            .await?;
        if !existing.is_empty() {
            let rec = &existing[0];
            return Ok(ViewportProviderInitializeOutput::Ok {
                instance: rec["instance"].as_str().unwrap_or("").to_string(),
                plugin_ref,
            });
        }

        if input.config.is_empty() {
            return Ok(ViewportProviderInitializeOutput::ConfigError {
                message: "config must not be empty".to_string(),
            });
        }

        let id = self.counter.fetch_add(1, Ordering::SeqCst);
        let instance = format!("viewport-{}", id);

        storage
            .put(
                "viewport_provider",
                &instance,
                json!({
                    "instance": instance,
                    "pluginRef": plugin_ref,
                    "config": input.config,
                }),
            )
            .await?;

        storage
            .put(
                "plugin_definition",
                &plugin_ref,
                json!({
                    "pluginRef": plugin_ref,
                    "instance": instance,
                    "type": "viewport-provider",
                }),
            )
            .await?;

        // Seed default breakpoints
        let defaults = vec![("xs", 0u32), ("sm", 576), ("md", 768), ("lg", 992), ("xl", 1200)];
        for (name, min_width) in &defaults {
            storage
                .put("viewport_breakpoint", name, json!({ "name": name, "minWidth": min_width }))
                .await?;
        }

        Ok(ViewportProviderInitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    async fn observe(
        &self,
        input: ViewportProviderObserveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportProviderObserveOutput, Box<dyn std::error::Error>> {
        let breakpoints = storage.find("viewport_breakpoint", None).await?;
        let breakpoint = Self::match_breakpoint(&breakpoints, input.width);

        storage
            .put(
                "viewport_state",
                "current",
                json!({ "width": input.width, "height": input.height, "breakpoint": breakpoint }),
            )
            .await?;

        Ok(ViewportProviderObserveOutput::Ok { breakpoint })
    }

    async fn get_breakpoint(
        &self,
        input: ViewportProviderGetBreakpointInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportProviderGetBreakpointOutput, Box<dyn std::error::Error>> {
        let breakpoints = storage.find("viewport_breakpoint", None).await?;
        let breakpoint = Self::match_breakpoint(&breakpoints, input.width);

        let min_width = breakpoints
            .iter()
            .filter_map(|bp| {
                let name = bp["name"].as_str()?;
                if name == breakpoint {
                    bp["minWidth"].as_u64().map(|w| w as u32)
                } else {
                    None
                }
            })
            .next()
            .unwrap_or(0);

        Ok(ViewportProviderGetBreakpointOutput::Ok { breakpoint, min_width })
    }

    async fn set_breakpoints(
        &self,
        input: ViewportProviderSetBreakpointsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportProviderSetBreakpointsOutput, Box<dyn std::error::Error>> {
        storage.del_many("viewport_breakpoint", &json!({})).await?;

        let parsed: Vec<serde_json::Value> = serde_json::from_str(&input.breakpoints)?;
        let count = parsed.len() as u32;

        for bp in &parsed {
            let name = bp["name"].as_str().unwrap_or("unknown");
            storage.put("viewport_breakpoint", name, bp.clone()).await?;
        }

        Ok(ViewportProviderSetBreakpointsOutput::Ok { count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_initialize_creates_instance() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandlerImpl::new();
        let result = handler.initialize(
            ViewportProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ViewportProviderInitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("viewport-"));
                assert_eq!(plugin_ref, "surface-provider:viewport");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandlerImpl::new();
        let first = handler.initialize(
            ViewportProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let second = handler.initialize(
            ViewportProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let (i1, i2) = match (&first, &second) {
            (ViewportProviderInitializeOutput::Ok { instance: i1, .. },
             ViewportProviderInitializeOutput::Ok { instance: i2, .. }) => (i1.clone(), i2.clone()),
            _ => panic!("expected Ok variants"),
        };
        assert_eq!(i1, i2);
    }

    #[tokio::test]
    async fn test_observe_returns_breakpoint() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandlerImpl::new();
        handler.initialize(
            ViewportProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.observe(
            ViewportProviderObserveInput { width: 1024, height: 768 },
            &storage,
        ).await.unwrap();
        match result {
            ViewportProviderObserveOutput::Ok { breakpoint } => {
                assert_eq!(breakpoint, "lg");
            }
        }
    }

    #[tokio::test]
    async fn test_get_breakpoint_small_width() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandlerImpl::new();
        handler.initialize(
            ViewportProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.get_breakpoint(
            ViewportProviderGetBreakpointInput { width: 400 },
            &storage,
        ).await.unwrap();
        match result {
            ViewportProviderGetBreakpointOutput::Ok { breakpoint, min_width } => {
                assert_eq!(breakpoint, "xs");
                assert_eq!(min_width, 0);
            }
        }
    }

    #[tokio::test]
    async fn test_set_breakpoints_replaces() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandlerImpl::new();
        handler.initialize(
            ViewportProviderInitializeInput { config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let new_bps = serde_json::to_string(&vec![
            json!({ "name": "mobile", "minWidth": 0 }),
            json!({ "name": "desktop", "minWidth": 1024 }),
        ]).unwrap();
        let result = handler.set_breakpoints(
            ViewportProviderSetBreakpointsInput { breakpoints: new_bps },
            &storage,
        ).await.unwrap();
        match result {
            ViewportProviderSetBreakpointsOutput::Ok { count } => {
                assert_eq!(count, 2);
            }
        }
    }
}
