// ViewportProvider Concept Implementation (Rust)
//
// Surface Provider — tracks viewport dimensions and breakpoints for
// responsive UI generation. Observers are notified when the active
// breakpoint changes.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

// ── Initialize ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InitializeInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InitializeOutput {
    #[serde(rename = "ok")]
    Ok { instance: String, plugin_ref: String },
    #[serde(rename = "config_error")]
    ConfigError { message: String },
}

// ── Observe ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ObserveInput {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ObserveOutput {
    #[serde(rename = "ok")]
    Ok { breakpoint: String },
}

// ── GetBreakpoint ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GetBreakpointInput {
    pub width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GetBreakpointOutput {
    #[serde(rename = "ok")]
    Ok { breakpoint: String, min_width: u32 },
}

// ── SetBreakpoints ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SetBreakpointsInput {
    pub breakpoints: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SetBreakpointsOutput {
    #[serde(rename = "ok")]
    Ok { count: u32 },
}

// ── Handler ─────────────────────────────────────────────

pub struct ViewportProviderHandler {
    counter: AtomicU64,
}

impl ViewportProviderHandler {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(0),
        }
    }

    pub async fn initialize(
        &self,
        input: InitializeInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<InitializeOutput> {
        let plugin_ref = "surface-provider:viewport".to_string();

        // Idempotent: check for existing registration
        let existing = storage
            .find("plugin_definition", Some(&json!({ "pluginRef": plugin_ref })))
            .await?;
        if !existing.is_empty() {
            let rec = &existing[0];
            return Ok(InitializeOutput::Ok {
                instance: rec["instance"].as_str().unwrap_or("").to_string(),
                plugin_ref,
            });
        }

        if input.config.is_empty() {
            return Ok(InitializeOutput::ConfigError {
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
        let defaults = vec![
            ("xs", 0u32),
            ("sm", 576),
            ("md", 768),
            ("lg", 992),
            ("xl", 1200),
        ];
        for (name, min_width) in &defaults {
            storage
                .put(
                    "viewport_breakpoint",
                    name,
                    json!({ "name": name, "minWidth": min_width }),
                )
                .await?;
        }

        Ok(InitializeOutput::Ok {
            instance,
            plugin_ref,
        })
    }

    pub async fn observe(
        &self,
        input: ObserveInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ObserveOutput> {
        let breakpoints = storage.find("viewport_breakpoint", None).await?;
        let breakpoint = Self::match_breakpoint(&breakpoints, input.width);

        storage
            .put(
                "viewport_state",
                "current",
                json!({
                    "width": input.width,
                    "height": input.height,
                    "breakpoint": breakpoint,
                }),
            )
            .await?;

        Ok(ObserveOutput::Ok { breakpoint })
    }

    pub async fn get_breakpoint(
        &self,
        input: GetBreakpointInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetBreakpointOutput> {
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

        Ok(GetBreakpointOutput::Ok {
            breakpoint,
            min_width,
        })
    }

    pub async fn set_breakpoints(
        &self,
        input: SetBreakpointsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SetBreakpointsOutput> {
        // Clear existing breakpoints
        storage
            .del_many("viewport_breakpoint", &json!({}))
            .await?;

        let parsed: Vec<serde_json::Value> = serde_json::from_str(&input.breakpoints)?;
        let count = parsed.len() as u32;

        for bp in &parsed {
            let name = bp["name"].as_str().unwrap_or("unknown");
            storage
                .put(
                    "viewport_breakpoint",
                    name,
                    bp.clone(),
                )
                .await?;
        }

        Ok(SetBreakpointsOutput::Ok { count })
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

// ── Tests ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn initialize_creates_instance_and_plugin_ref() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandler::new();

        let result = handler
            .initialize(
                InitializeInput {
                    config: r#"{"defaultBreakpoints":true}"#.into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            InitializeOutput::Ok { instance, plugin_ref } => {
                assert!(instance.starts_with("viewport-"));
                assert_eq!(plugin_ref, "surface-provider:viewport");
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn initialize_is_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandler::new();

        let first = handler
            .initialize(InitializeInput { config: "{}".into() }, &storage)
            .await
            .unwrap();
        let second = handler
            .initialize(InitializeInput { config: "{}".into() }, &storage)
            .await
            .unwrap();

        let (i1, i2) = match (&first, &second) {
            (
                InitializeOutput::Ok { instance: i1, .. },
                InitializeOutput::Ok { instance: i2, .. },
            ) => (i1.clone(), i2.clone()),
            _ => panic!("expected Ok variants"),
        };
        assert_eq!(i1, i2);
    }

    #[tokio::test]
    async fn initialize_returns_config_error_on_empty_config() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandler::new();

        let result = handler
            .initialize(InitializeInput { config: "".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, InitializeOutput::ConfigError { .. }));
    }

    #[tokio::test]
    async fn observe_returns_matching_breakpoint() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandler::new();

        handler
            .initialize(InitializeInput { config: "{}".into() }, &storage)
            .await
            .unwrap();

        let result = handler
            .observe(ObserveInput { width: 1024, height: 768 }, &storage)
            .await
            .unwrap();

        match result {
            ObserveOutput::Ok { breakpoint } => {
                assert_eq!(breakpoint, "lg");
            }
        }
    }

    #[tokio::test]
    async fn get_breakpoint_matches_width() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandler::new();

        handler
            .initialize(InitializeInput { config: "{}".into() }, &storage)
            .await
            .unwrap();

        let result = handler
            .get_breakpoint(GetBreakpointInput { width: 400 }, &storage)
            .await
            .unwrap();

        match result {
            GetBreakpointOutput::Ok { breakpoint, min_width } => {
                assert_eq!(breakpoint, "xs");
                assert_eq!(min_width, 0);
            }
        }
    }

    #[tokio::test]
    async fn set_breakpoints_replaces_existing() {
        let storage = InMemoryStorage::new();
        let handler = ViewportProviderHandler::new();

        handler
            .initialize(InitializeInput { config: "{}".into() }, &storage)
            .await
            .unwrap();

        let new_bps = serde_json::to_string(&vec![
            json!({ "name": "mobile", "minWidth": 0 }),
            json!({ "name": "tablet", "minWidth": 768 }),
            json!({ "name": "desktop", "minWidth": 1280 }),
        ])
        .unwrap();

        let result = handler
            .set_breakpoints(SetBreakpointsInput { breakpoints: new_bps }, &storage)
            .await
            .unwrap();

        match result {
            SetBreakpointsOutput::Ok { count } => {
                assert_eq!(count, 3);
            }
        }
    }
}
