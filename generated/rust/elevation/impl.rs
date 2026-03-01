// Elevation Handler Implementation
//
// Shadow-based elevation levels for depth hierarchy in UI surfaces.
// Supports defining individual levels, retrieving shadow values,
// and generating a 6-level scale from a base color.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ElevationHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("W-{}", id)
}

pub struct ElevationHandlerImpl;

#[async_trait]
impl ElevationHandler for ElevationHandlerImpl {
    async fn define(
        &self,
        input: ElevationDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElevationDefineOutput, Box<dyn std::error::Error>> {
        if input.level < 0 || input.level > 5 {
            return Ok(ElevationDefineOutput::Invalid {
                message: "Elevation level must be a number between 0 and 5".to_string(),
            });
        }

        if input.shadow.is_empty() {
            return Ok(ElevationDefineOutput::Invalid {
                message: "Shadow definition is required".to_string(),
            });
        }

        let id = if input.elevation.is_empty() { next_id() } else { input.elevation };

        storage.put("elevation", &id, json!({
            "level": input.level,
            "shadow": input.shadow,
            "color": "",
        })).await?;

        Ok(ElevationDefineOutput::Ok { elevation: id })
    }

    async fn get(
        &self,
        input: ElevationGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElevationGetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("elevation", &input.elevation).await?;
        match existing {
            Some(e) => Ok(ElevationGetOutput::Ok {
                elevation: input.elevation,
                shadow: e.get("shadow").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }),
            None => Ok(ElevationGetOutput::Notfound {
                message: format!("Elevation \"{}\" not found", input.elevation),
            }),
        }
    }

    async fn generate_scale(
        &self,
        input: ElevationGenerateScaleInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<ElevationGenerateScaleOutput, Box<dyn std::error::Error>> {
        if input.base_color.is_empty() {
            return Ok(ElevationGenerateScaleOutput::Invalid {
                message: "Base color is required for shadow scale generation".to_string(),
            });
        }

        // Generate a 6-level elevation scale (0-5) from the base color
        let mut shadows = Vec::new();
        for i in 0..=5i64 {
            let offset_y = i * 2;
            let blur = i * 4;
            let spread = if i > 1 { i - 1 } else { 0 };
            let opacity = (i as f64) * 0.05;
            shadows.push(format!(
                "0 {}px {}px {}px rgba({}, {:.2})",
                offset_y, blur, spread, input.base_color, opacity
            ));
        }

        Ok(ElevationGenerateScaleOutput::Ok {
            shadows: serde_json::to_string(&shadows)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_valid() {
        let storage = InMemoryStorage::new();
        let handler = ElevationHandlerImpl;
        let result = handler.define(
            ElevationDefineInput {
                elevation: "elev-1".to_string(),
                level: 2,
                shadow: "0 4px 8px rgba(0,0,0,0.1)".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElevationDefineOutput::Ok { elevation } => {
                assert_eq!(elevation, "elev-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_invalid_level() {
        let storage = InMemoryStorage::new();
        let handler = ElevationHandlerImpl;
        let result = handler.define(
            ElevationDefineInput {
                elevation: "elev-1".to_string(),
                level: 10,
                shadow: "0 4px 8px rgba(0,0,0,0.1)".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElevationDefineOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_define_empty_shadow() {
        let storage = InMemoryStorage::new();
        let handler = ElevationHandlerImpl;
        let result = handler.define(
            ElevationDefineInput {
                elevation: "elev-1".to_string(),
                level: 1,
                shadow: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElevationDefineOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ElevationHandlerImpl;
        let result = handler.get(
            ElevationGetInput {
                elevation: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElevationGetOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_scale() {
        let storage = InMemoryStorage::new();
        let handler = ElevationHandlerImpl;
        let result = handler.generate_scale(
            ElevationGenerateScaleInput {
                base_color: "0,0,0".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElevationGenerateScaleOutput::Ok { shadows } => {
                let parsed: Vec<String> = serde_json::from_str(&shadows).unwrap();
                assert_eq!(parsed.len(), 6);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_scale_empty_color() {
        let storage = InMemoryStorage::new();
        let handler = ElevationHandlerImpl;
        let result = handler.generate_scale(
            ElevationGenerateScaleInput {
                base_color: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ElevationGenerateScaleOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }
}
