// Motion -- animation durations, easings, and transition definitions.
// Produces reduced-motion fallbacks for accessibility compliance.
// Duration: milliseconds with 0ms fallback. Easing: CSS timing with linear fallback.
// Transition: compound property+duration+easing+delay with instant fallback.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MotionHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id(prefix: &str) -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("{}-{}", prefix, n)
}

#[async_trait]
impl MotionHandler for MotionHandlerImpl {
    async fn define_duration(
        &self,
        input: MotionDefineDurationInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MotionDefineDurationOutput, Box<dyn std::error::Error>> {
        if input.ms < 0 {
            return Ok(MotionDefineDurationOutput::Invalid {
                message: "Duration must be a non-negative number in milliseconds".to_string(),
            });
        }

        let id = if input.motion.is_empty() {
            next_id("O")
        } else {
            input.motion
        };

        let reduced_motion = if input.ms > 0 { "0".to_string() } else { input.ms.to_string() };

        storage.put("motion", &id, json!({
            "name": input.name,
            "kind": "duration",
            "value": input.ms.to_string(),
            "reducedMotion": reduced_motion,
        })).await?;

        Ok(MotionDefineDurationOutput::Ok { motion: id })
    }

    async fn define_easing(
        &self,
        input: MotionDefineEasingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MotionDefineEasingOutput, Box<dyn std::error::Error>> {
        if input.value.is_empty() {
            return Ok(MotionDefineEasingOutput::Invalid {
                message: "Easing value is required (e.g., \"ease-in-out\", \"cubic-bezier(0.4, 0, 0.2, 1)\")".to_string(),
            });
        }

        let id = if input.motion.is_empty() {
            next_id("O")
        } else {
            input.motion
        };

        storage.put("motion", &id, json!({
            "name": input.name,
            "kind": "easing",
            "value": input.value,
            "reducedMotion": "linear",
        })).await?;

        Ok(MotionDefineEasingOutput::Ok { motion: id })
    }

    async fn define_transition(
        &self,
        input: MotionDefineTransitionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MotionDefineTransitionOutput, Box<dyn std::error::Error>> {
        let parsed: serde_json::Value = match serde_json::from_str(&input.config) {
            Ok(v) => v,
            Err(_) => {
                return Ok(MotionDefineTransitionOutput::Invalid {
                    message: "Transition config must be valid JSON with property, duration, easing, and delay fields".to_string(),
                });
            }
        };

        let property = match parsed.get("property").and_then(|v| v.as_str()) {
            Some(p) => p.to_string(),
            None => {
                return Ok(MotionDefineTransitionOutput::Invalid {
                    message: "Transition config must include at least \"property\" and \"duration\"".to_string(),
                });
            }
        };

        let duration = match parsed.get("duration").and_then(|v| v.as_i64()) {
            Some(d) => d,
            None => {
                return Ok(MotionDefineTransitionOutput::Invalid {
                    message: "Transition config must include at least \"property\" and \"duration\"".to_string(),
                });
            }
        };

        let easing = parsed.get("easing").and_then(|v| v.as_str()).unwrap_or("ease");
        let delay = parsed.get("delay").and_then(|v| v.as_i64()).unwrap_or(0);

        let id = if input.motion.is_empty() {
            next_id("O")
        } else {
            input.motion
        };

        let transition_value = format!("{} {}ms {} {}ms", property, duration, easing, delay);
        let reduced_motion = format!("{} 0ms linear 0ms", property);

        storage.put("motion", &id, json!({
            "name": input.name,
            "kind": "transition",
            "value": transition_value,
            "reducedMotion": reduced_motion,
        })).await?;

        Ok(MotionDefineTransitionOutput::Ok { motion: id })
    }
}

pub struct MotionHandlerImpl;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_duration_success() {
        let storage = InMemoryStorage::new();
        let handler = MotionHandlerImpl;
        let result = handler.define_duration(
            MotionDefineDurationInput { motion: "d1".into(), name: "fast".into(), ms: 200 },
            &storage,
        ).await.unwrap();
        match result {
            MotionDefineDurationOutput::Ok { motion } => assert_eq!(motion, "d1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_duration_negative() {
        let storage = InMemoryStorage::new();
        let handler = MotionHandlerImpl;
        let result = handler.define_duration(
            MotionDefineDurationInput { motion: "d1".into(), name: "bad".into(), ms: -10 },
            &storage,
        ).await.unwrap();
        match result {
            MotionDefineDurationOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_define_easing_success() {
        let storage = InMemoryStorage::new();
        let handler = MotionHandlerImpl;
        let result = handler.define_easing(
            MotionDefineEasingInput { motion: "e1".into(), name: "smooth".into(), value: "ease-in-out".into() },
            &storage,
        ).await.unwrap();
        match result {
            MotionDefineEasingOutput::Ok { motion } => assert_eq!(motion, "e1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_easing_empty_value() {
        let storage = InMemoryStorage::new();
        let handler = MotionHandlerImpl;
        let result = handler.define_easing(
            MotionDefineEasingInput { motion: "e1".into(), name: "bad".into(), value: "".into() },
            &storage,
        ).await.unwrap();
        match result {
            MotionDefineEasingOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_define_transition_success() {
        let storage = InMemoryStorage::new();
        let handler = MotionHandlerImpl;
        let result = handler.define_transition(
            MotionDefineTransitionInput {
                motion: "t1".into(),
                name: "fade".into(),
                config: r#"{"property":"opacity","duration":300,"easing":"ease","delay":0}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            MotionDefineTransitionOutput::Ok { motion } => assert_eq!(motion, "t1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_transition_invalid_config() {
        let storage = InMemoryStorage::new();
        let handler = MotionHandlerImpl;
        let result = handler.define_transition(
            MotionDefineTransitionInput { motion: "t1".into(), name: "bad".into(), config: "not json".into() },
            &storage,
        ).await.unwrap();
        match result {
            MotionDefineTransitionOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_define_transition_missing_property() {
        let storage = InMemoryStorage::new();
        let handler = MotionHandlerImpl;
        let result = handler.define_transition(
            MotionDefineTransitionInput { motion: "t1".into(), name: "bad".into(), config: r#"{"duration":300}"#.into() },
            &storage,
        ).await.unwrap();
        match result {
            MotionDefineTransitionOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }
}
