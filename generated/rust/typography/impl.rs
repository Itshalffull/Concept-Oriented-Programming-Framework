// Typography handler implementation
// Typographic scales, font stacks, and text style definitions.
// Generates modular type scales using base size and ratio.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TypographyHandler;
use serde_json::{json, Value, Map};
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("X-{}", id)
}

const VALID_CATEGORIES: &[&str] = &["serif", "sans-serif", "monospace", "display", "handwriting"];

pub struct TypographyHandlerImpl;

#[async_trait]
impl TypographyHandler for TypographyHandlerImpl {
    async fn define_scale(
        &self,
        input: TypographyDefineScaleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypographyDefineScaleOutput, Box<dyn std::error::Error>> {
        let base_size = input.base_size;
        let ratio = input.ratio;
        let steps = input.steps;

        if base_size <= 0.0 {
            return Ok(TypographyDefineScaleOutput::Invalid {
                message: "Base size must be a positive number".to_string(),
            });
        }
        if ratio <= 0.0 {
            return Ok(TypographyDefineScaleOutput::Invalid {
                message: "Ratio must be a positive number".to_string(),
            });
        }
        if steps < 1 || steps != (steps as i64) {
            return Ok(TypographyDefineScaleOutput::Invalid {
                message: "Steps must be a positive integer".to_string(),
            });
        }

        let id = if input.typography.is_empty() { next_id() } else { input.typography.clone() };

        // Generate a modular type scale
        let mut scale = Map::new();
        for i in -2..=steps {
            let size = (base_size * ratio.powi(i as i32) * 100.0).round() / 100.0;
            let label = if i < 0 {
                format!("sm{}", i.unsigned_abs())
            } else if i == 0 {
                "base".to_string()
            } else {
                format!("h{}", i.min(6))
            };
            scale.insert(label, json!(size));
        }

        let scale_value = Value::Object(scale.clone());

        storage.put("typography", &id, json!({
            "name": format!("scale-{}", id),
            "kind": "scale",
            "value": json!({"baseSize": base_size, "ratio": ratio, "steps": steps}).to_string(),
            "scale": serde_json::to_string(&scale_value)?,
        })).await?;

        Ok(TypographyDefineScaleOutput::Ok {
            typography: id,
            scale: serde_json::to_string(&scale_value)?,
        })
    }

    async fn define_font_stack(
        &self,
        input: TypographyDefineFontStackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypographyDefineFontStackOutput, Box<dyn std::error::Error>> {
        let name = &input.name;
        let fonts = &input.fonts;
        let category = &input.category;

        if !VALID_CATEGORIES.contains(&category.as_str()) {
            return Ok(TypographyDefineFontStackOutput::Duplicate {
                message: format!(
                    "Invalid category \"{}\". Valid categories: {}",
                    category,
                    VALID_CATEGORIES.join(", ")
                ),
            });
        }

        let id = if input.typography.is_empty() { next_id() } else { input.typography.clone() };

        // Check for duplicate
        let existing = storage.get("typography", &id).await?;
        if let Some(ref rec) = existing {
            if rec.get("kind").and_then(|v| v.as_str()) == Some("fontStack")
                && rec.get("name").and_then(|v| v.as_str()) == Some(name)
            {
                return Ok(TypographyDefineFontStackOutput::Duplicate {
                    message: format!("Font stack \"{}\" already exists", name),
                });
            }
        }

        // Parse font list
        let mut font_list: Vec<String> = if let Ok(parsed) = serde_json::from_str::<Vec<String>>(fonts) {
            parsed
        } else {
            fonts.split(',').map(|f| f.trim().to_string()).collect()
        };

        // Append generic family fallback
        if !font_list.iter().any(|f| f == category) {
            font_list.push(category.clone());
        }

        storage.put("typography", &id, json!({
            "name": name,
            "kind": "fontStack",
            "value": font_list.join(", "),
            "scale": "",
        })).await?;

        Ok(TypographyDefineFontStackOutput::Ok { typography: id })
    }

    async fn define_style(
        &self,
        input: TypographyDefineStyleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypographyDefineStyleOutput, Box<dyn std::error::Error>> {
        let name = &input.name;
        let config = &input.config;

        let parsed: Value = match serde_json::from_str(config) {
            Ok(v) => v,
            Err(_) => return Ok(TypographyDefineStyleOutput::Invalid {
                message: "Style config must be valid JSON with fontSize, fontWeight, lineHeight, letterSpacing fields".to_string(),
            }),
        };

        if parsed.get("fontSize").is_none() {
            return Ok(TypographyDefineStyleOutput::Invalid {
                message: "Style config must include at least \"fontSize\"".to_string(),
            });
        }

        let id = if input.typography.is_empty() { next_id() } else { input.typography.clone() };

        storage.put("typography", &id, json!({
            "name": name,
            "kind": "style",
            "value": serde_json::to_string(&parsed)?,
            "scale": "",
        })).await?;

        Ok(TypographyDefineStyleOutput::Ok { typography: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_define_scale_success() {
        let storage = InMemoryStorage::new();
        let handler = TypographyHandlerImpl;
        let result = handler.define_scale(
            TypographyDefineScaleInput {
                typography: "".to_string(),
                base_size: 16.0,
                ratio: 1.25,
                steps: 4,
            },
            &storage,
        ).await.unwrap();
        match result {
            TypographyDefineScaleOutput::Ok { typography, scale } => {
                assert!(!typography.is_empty());
                assert!(scale.contains("base"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_scale_invalid_base_size() {
        let storage = InMemoryStorage::new();
        let handler = TypographyHandlerImpl;
        let result = handler.define_scale(
            TypographyDefineScaleInput {
                typography: "".to_string(),
                base_size: -1.0,
                ratio: 1.25,
                steps: 4,
            },
            &storage,
        ).await.unwrap();
        match result {
            TypographyDefineScaleOutput::Invalid { message } => {
                assert!(message.contains("positive"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_define_font_stack_success() {
        let storage = InMemoryStorage::new();
        let handler = TypographyHandlerImpl;
        let result = handler.define_font_stack(
            TypographyDefineFontStackInput {
                typography: "".to_string(),
                name: "body".to_string(),
                fonts: "Inter, Helvetica".to_string(),
                category: "sans-serif".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypographyDefineFontStackOutput::Ok { typography } => {
                assert!(!typography.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_font_stack_invalid_category() {
        let storage = InMemoryStorage::new();
        let handler = TypographyHandlerImpl;
        let result = handler.define_font_stack(
            TypographyDefineFontStackInput {
                typography: "".to_string(),
                name: "body".to_string(),
                fonts: "Inter".to_string(),
                category: "invalid-category".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypographyDefineFontStackOutput::Duplicate { message } => {
                assert!(message.contains("Invalid category"));
            },
            _ => panic!("Expected Duplicate variant for invalid category"),
        }
    }

    #[tokio::test]
    async fn test_define_style_success() {
        let storage = InMemoryStorage::new();
        let handler = TypographyHandlerImpl;
        let result = handler.define_style(
            TypographyDefineStyleInput {
                typography: "".to_string(),
                name: "heading".to_string(),
                config: r#"{"fontSize": 24, "fontWeight": 700}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypographyDefineStyleOutput::Ok { typography } => {
                assert!(!typography.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_define_style_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = TypographyHandlerImpl;
        let result = handler.define_style(
            TypographyDefineStyleInput {
                typography: "".to_string(),
                name: "heading".to_string(),
                config: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypographyDefineStyleOutput::Invalid { .. } => {},
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_define_style_missing_font_size() {
        let storage = InMemoryStorage::new();
        let handler = TypographyHandlerImpl;
        let result = handler.define_style(
            TypographyDefineStyleInput {
                typography: "".to_string(),
                name: "heading".to_string(),
                config: r#"{"fontWeight": 700}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TypographyDefineStyleOutput::Invalid { message } => {
                assert!(message.contains("fontSize"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }
}
