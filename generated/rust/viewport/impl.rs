// Viewport handler implementation
// Responsive viewport observation with breakpoint detection, custom breakpoints,
// and orientation detection.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ViewportHandler;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use std::collections::HashMap;

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("V-{}", id)
}

fn default_breakpoints() -> HashMap<String, (i64, i64)> {
    let mut bp = HashMap::new();
    bp.insert("xs".to_string(), (0, 479));
    bp.insert("sm".to_string(), (480, 767));
    bp.insert("md".to_string(), (768, 1023));
    bp.insert("lg".to_string(), (1024, 1279));
    bp.insert("xl".to_string(), (1280, i64::MAX));
    bp
}

fn detect_breakpoint(width: i64, breakpoints: &HashMap<String, (i64, i64)>) -> String {
    for (name, (min, max)) in breakpoints {
        if width >= *min && width <= *max {
            return name.clone();
        }
    }
    "unknown".to_string()
}

fn detect_orientation(width: i64, height: i64) -> String {
    if width > height { "landscape".to_string() }
    else if height > width { "portrait".to_string() }
    else { "square".to_string() }
}

fn parse_breakpoints_from_json(json_str: &str) -> HashMap<String, (i64, i64)> {
    if let Ok(val) = serde_json::from_str::<Value>(json_str) {
        if let Some(obj) = val.as_object() {
            let mut result = HashMap::new();
            for (name, range) in obj {
                let min = range.get("min").and_then(|v| v.as_i64()).unwrap_or(0);
                let max = range.get("max").and_then(|v| v.as_i64()).unwrap_or(i64::MAX);
                result.insert(name.clone(), (min, max));
            }
            return result;
        }
    }
    default_breakpoints()
}

pub struct ViewportHandlerImpl;

#[async_trait]
impl ViewportHandler for ViewportHandlerImpl {
    async fn observe(
        &self,
        input: ViewportObserveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportObserveOutput, Box<dyn std::error::Error>> {
        let width = input.width;
        let height = input.height;
        let id = if input.viewport.is_empty() { next_id() } else { input.viewport.clone() };

        // Load custom breakpoints if defined
        let existing = storage.get("viewport", &id).await?;
        let breakpoints = if let Some(ref rec) = existing {
            if let Some(custom) = rec.get("customBreakpoints").and_then(|v| v.as_str()) {
                parse_breakpoints_from_json(custom)
            } else {
                default_breakpoints()
            }
        } else {
            default_breakpoints()
        };

        let breakpoint = detect_breakpoint(width, &breakpoints);
        let orientation = detect_orientation(width, height);

        let custom_bp_str = existing
            .and_then(|r| r.get("customBreakpoints").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .unwrap_or_else(|| serde_json::to_string(&default_breakpoints_json()).unwrap_or_default());

        storage.put("viewport", &id, json!({
            "width": width,
            "height": height,
            "breakpoint": &breakpoint,
            "orientation": &orientation,
            "customBreakpoints": &custom_bp_str,
        })).await?;

        Ok(ViewportObserveOutput::Ok {
            viewport: id,
            breakpoint,
            orientation,
        })
    }

    async fn set_breakpoints(
        &self,
        input: ViewportSetBreakpointsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportSetBreakpointsOutput, Box<dyn std::error::Error>> {
        let breakpoints_str = &input.breakpoints;

        let parsed: Value = match serde_json::from_str(breakpoints_str) {
            Ok(v) => v,
            Err(_) => return Ok(ViewportSetBreakpointsOutput::Invalid {
                message: "Breakpoints must be valid JSON with { name: { min, max } } entries".to_string(),
            }),
        };

        // Validate breakpoint structure
        if let Some(obj) = parsed.as_object() {
            for (name, range) in obj {
                let min = range.get("min").and_then(|v| v.as_i64());
                let max = range.get("max").and_then(|v| v.as_i64());
                if min.is_none() || max.is_none() {
                    return Ok(ViewportSetBreakpointsOutput::Invalid {
                        message: format!("Breakpoint \"{}\" must have numeric min and max values", name),
                    });
                }
                if min.unwrap() < 0 {
                    return Ok(ViewportSetBreakpointsOutput::Invalid {
                        message: format!("Breakpoint \"{}\" min value cannot be negative", name),
                    });
                }
            }
        }

        let id = if input.viewport.is_empty() { next_id() } else { input.viewport.clone() };

        let existing = storage.get("viewport", &id).await?;
        if let Some(mut rec) = existing {
            let breakpoints = parse_breakpoints_from_json(breakpoints_str);
            let width = rec.get("width").and_then(|v| v.as_i64()).unwrap_or(0);
            let height = rec.get("height").and_then(|v| v.as_i64()).unwrap_or(0);
            let breakpoint = detect_breakpoint(width, &breakpoints);
            let orientation = detect_orientation(width, height);

            if let Some(obj) = rec.as_object_mut() {
                obj.insert("customBreakpoints".to_string(), json!(breakpoints_str));
                obj.insert("breakpoint".to_string(), json!(breakpoint));
                obj.insert("orientation".to_string(), json!(orientation));
            }
            storage.put("viewport", &id, rec).await?;
        } else {
            storage.put("viewport", &id, json!({
                "width": 0,
                "height": 0,
                "breakpoint": "unknown",
                "orientation": "unknown",
                "customBreakpoints": breakpoints_str,
            })).await?;
        }

        Ok(ViewportSetBreakpointsOutput::Ok { viewport: id })
    }

    async fn get_breakpoint(
        &self,
        input: ViewportGetBreakpointInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewportGetBreakpointOutput, Box<dyn std::error::Error>> {
        let viewport = &input.viewport;

        let existing = storage.get("viewport", viewport).await?;
        match existing {
            Some(rec) => Ok(ViewportGetBreakpointOutput::Ok {
                viewport: viewport.clone(),
                breakpoint: rec.get("breakpoint").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                width: rec.get("width").and_then(|v| v.as_i64()).unwrap_or(0),
                height: rec.get("height").and_then(|v| v.as_i64()).unwrap_or(0),
            }),
            None => Ok(ViewportGetBreakpointOutput::Notfound {
                message: format!("Viewport \"{}\" not found", viewport),
            }),
        }
    }
}

fn default_breakpoints_json() -> Value {
    json!({
        "xs": {"min": 0, "max": 479},
        "sm": {"min": 480, "max": 767},
        "md": {"min": 768, "max": 1023},
        "lg": {"min": 1024, "max": 1279},
        "xl": {"min": 1280, "max": 999999999},
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_observe_mobile() {
        let storage = InMemoryStorage::new();
        let handler = ViewportHandlerImpl;
        let result = handler.observe(
            ViewportObserveInput {
                viewport: "".to_string(),
                width: 375,
                height: 667,
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewportObserveOutput::Ok { viewport, breakpoint, orientation } => {
                assert!(!viewport.is_empty());
                assert_eq!(breakpoint, "xs");
                assert_eq!(orientation, "portrait");
            },
        }
    }

    #[tokio::test]
    async fn test_observe_desktop() {
        let storage = InMemoryStorage::new();
        let handler = ViewportHandlerImpl;
        let result = handler.observe(
            ViewportObserveInput {
                viewport: "".to_string(),
                width: 1920,
                height: 1080,
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewportObserveOutput::Ok { breakpoint, orientation, .. } => {
                assert_eq!(breakpoint, "xl");
                assert_eq!(orientation, "landscape");
            },
        }
    }

    #[tokio::test]
    async fn test_set_breakpoints_success() {
        let storage = InMemoryStorage::new();
        let handler = ViewportHandlerImpl;
        let result = handler.set_breakpoints(
            ViewportSetBreakpointsInput {
                viewport: "vp-1".to_string(),
                breakpoints: r#"{"mobile":{"min":0,"max":599},"desktop":{"min":600,"max":9999}}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewportSetBreakpointsOutput::Ok { viewport } => {
                assert_eq!(viewport, "vp-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_set_breakpoints_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = ViewportHandlerImpl;
        let result = handler.set_breakpoints(
            ViewportSetBreakpointsInput {
                viewport: "".to_string(),
                breakpoints: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewportSetBreakpointsOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_get_breakpoint_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ViewportHandlerImpl;
        let result = handler.get_breakpoint(
            ViewportGetBreakpointInput {
                viewport: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewportGetBreakpointOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_get_breakpoint_success() {
        let storage = InMemoryStorage::new();
        let handler = ViewportHandlerImpl;
        handler.observe(
            ViewportObserveInput {
                viewport: "vp-test".to_string(),
                width: 800,
                height: 600,
            },
            &storage,
        ).await.unwrap();
        let result = handler.get_breakpoint(
            ViewportGetBreakpointInput {
                viewport: "vp-test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ViewportGetBreakpointOutput::Ok { viewport, breakpoint, width, height } => {
                assert_eq!(viewport, "vp-test");
                assert_eq!(breakpoint, "md");
                assert_eq!(width, 800);
                assert_eq!(height, 600);
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
