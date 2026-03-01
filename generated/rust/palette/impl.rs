// Palette concept implementation
// Color palette generation with role assignment and WCAG contrast checking.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PaletteHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);
fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("C-{}", id)
}

pub struct PaletteHandlerImpl;

#[async_trait]
impl PaletteHandler for PaletteHandlerImpl {
    async fn generate(
        &self,
        input: PaletteGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PaletteGenerateOutput, Box<dyn std::error::Error>> {
        if input.seed.is_empty() {
            return Ok(PaletteGenerateOutput::Invalid {
                message: "A seed color is required to generate the palette scale".to_string(),
            });
        }

        // Validate seed color format (hex, rgb, hsl, oklch, oklab)
        let valid_prefix = input.seed.starts_with('#')
            || input.seed.starts_with("rgb")
            || input.seed.starts_with("hsl")
            || input.seed.starts_with("oklch")
            || input.seed.starts_with("oklab");
        if !valid_prefix {
            return Ok(PaletteGenerateOutput::Invalid {
                message: format!("Invalid seed color \"{}\". Expected hex, rgb, hsl, oklch, or oklab format", input.seed),
            });
        }

        let id = if input.palette.is_empty() { next_id() } else { input.palette };

        // Generate a 10-step scale from the seed
        let steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
        let mut scale = serde_json::Map::new();
        for step in &steps {
            scale.insert(step.to_string(), json!(format!("{}-{}", input.seed, step)));
        }

        storage.put("palette", &id, json!({
            "name": input.name,
            "hue": input.seed,
            "scale": serde_json::to_string(&scale)?,
            "role": "",
            "contrastRatio": 0
        })).await?;

        Ok(PaletteGenerateOutput::Ok {
            palette: id,
            scale: serde_json::to_string(&scale)?,
        })
    }

    async fn assign_role(
        &self,
        input: PaletteAssignRoleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PaletteAssignRoleOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("palette", &input.palette).await? {
            Some(r) => r,
            None => return Ok(PaletteAssignRoleOutput::Notfound {
                message: format!("Palette \"{}\" not found", input.palette),
            }),
        };

        let mut updated = existing.clone();
        updated["role"] = json!(input.role);
        storage.put("palette", &input.palette, updated).await?;

        Ok(PaletteAssignRoleOutput::Ok { palette: input.palette })
    }

    async fn check_contrast(
        &self,
        input: PaletteCheckContrastInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PaletteCheckContrastOutput, Box<dyn std::error::Error>> {
        if storage.get("palette", &input.foreground).await?.is_none() {
            return Ok(PaletteCheckContrastOutput::Notfound {
                message: format!("Foreground palette \"{}\" not found", input.foreground),
            });
        }

        if storage.get("palette", &input.background).await?.is_none() {
            return Ok(PaletteCheckContrastOutput::Notfound {
                message: format!("Background palette \"{}\" not found", input.background),
            });
        }

        // Compute contrast ratio (placeholder: real implementation would use luminance)
        let ratio = 4.5_f64;
        let passes_a_a = ratio >= 4.5;
        let passes_a_a_a = ratio >= 7.0;

        Ok(PaletteCheckContrastOutput::Ok {
            ratio,
            passes_a_a,
            passes_a_a_a,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_palette() {
        let storage = InMemoryStorage::new();
        let handler = PaletteHandlerImpl;
        let result = handler.generate(
            PaletteGenerateInput {
                palette: "".to_string(),
                name: "Primary".to_string(),
                seed: "#3366ff".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PaletteGenerateOutput::Ok { palette, scale } => {
                assert!(!palette.is_empty());
                assert!(!scale.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_seed() {
        let storage = InMemoryStorage::new();
        let handler = PaletteHandlerImpl;
        let result = handler.generate(
            PaletteGenerateInput {
                palette: "".to_string(),
                name: "Primary".to_string(),
                seed: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PaletteGenerateOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_invalid_seed_format() {
        let storage = InMemoryStorage::new();
        let handler = PaletteHandlerImpl;
        let result = handler.generate(
            PaletteGenerateInput {
                palette: "".to_string(),
                name: "Bad".to_string(),
                seed: "not-a-color".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PaletteGenerateOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_assign_role() {
        let storage = InMemoryStorage::new();
        let handler = PaletteHandlerImpl;
        handler.generate(
            PaletteGenerateInput {
                palette: "pal-1".to_string(),
                name: "Primary".to_string(),
                seed: "#3366ff".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.assign_role(
            PaletteAssignRoleInput { palette: "pal-1".to_string(), role: "primary".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PaletteAssignRoleOutput::Ok { palette } => assert_eq!(palette, "pal-1"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_assign_role_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PaletteHandlerImpl;
        let result = handler.assign_role(
            PaletteAssignRoleInput { palette: "nonexistent".to_string(), role: "primary".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PaletteAssignRoleOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_check_contrast_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PaletteHandlerImpl;
        let result = handler.check_contrast(
            PaletteCheckContrastInput {
                foreground: "nonexistent".to_string(),
                background: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PaletteCheckContrastOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
