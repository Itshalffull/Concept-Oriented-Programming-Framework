// COIF Theme Scaffold Generator -- generate theme scaffolding for the COIF UI framework
// Produces theme tokens, color palettes, typography scales, and mode variants.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CoifThemeScaffoldGenHandler;
use serde_json::json;

pub struct CoifThemeScaffoldGenHandlerImpl;

fn to_kebab(name: &str) -> String {
    let mut result = String::new();
    for (i, ch) in name.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('-');
        }
        result.push(ch.to_lowercase().next().unwrap_or(ch));
    }
    result.replace(' ', "-").replace('_', "-")
}

#[async_trait]
impl CoifThemeScaffoldGenHandler for CoifThemeScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: CoifThemeScaffoldGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifThemeScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(CoifThemeScaffoldGenGenerateOutput::Error {
                message: "Theme name is required".to_string(),
            });
        }

        let kebab = to_kebab(&input.name);
        let mut files: Vec<serde_json::Value> = Vec::new();

        // Generate CSS custom properties (design tokens)
        let tokens_content = format!(
            ":root {{\n\
             \x20 --theme-primary: {};\n\
             \x20 --theme-font-family: {};\n\
             \x20 --theme-base-size: {}px;\n\
             \x20 --theme-mode: {};\n\
             }}\n",
            input.primary_color, input.font_family, input.base_size, input.mode
        );
        files.push(json!({
            "path": format!("themes/{}/tokens.css", kebab),
            "content": tokens_content,
        }));

        // Generate theme configuration JSON
        let config_content = json!({
            "name": input.name,
            "primaryColor": input.primary_color,
            "fontFamily": input.font_family,
            "baseSize": input.base_size,
            "mode": input.mode,
            "scale": [0.75, 0.875, 1.0, 1.125, 1.25, 1.5, 2.0, 3.0],
        });
        files.push(json!({
            "path": format!("themes/{}/config.json", kebab),
            "content": config_content.to_string(),
        }));

        // Generate mode variant file
        let (bg, fg) = if input.mode == "dark" {
            ("#1a1a1a", "#ffffff")
        } else {
            ("#ffffff", "#1a1a1a")
        };
        let mode_content = format!(
            "/* {} mode for {} theme */\n\
             [data-theme=\"{}\"][data-mode=\"{}\"] {{\n\
             \x20 --theme-bg: {};\n\
             \x20 --theme-fg: {};\n\
             }}\n",
            input.mode, input.name, kebab, input.mode, bg, fg,
        );
        files.push(json!({
            "path": format!("themes/{}/{}.css", kebab, input.mode),
            "content": mode_content,
        }));

        let files_generated = files.len() as i64;

        storage.put("theme_scaffold", &kebab, json!({
            "name": input.name,
            "primaryColor": input.primary_color,
            "fontFamily": input.font_family,
            "baseSize": input.base_size,
            "mode": input.mode,
            "filesGenerated": files_generated,
        })).await?;

        Ok(CoifThemeScaffoldGenGenerateOutput::Ok {
            files,
            files_generated,
        })
    }

    async fn preview(
        &self,
        input: CoifThemeScaffoldGenPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CoifThemeScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(CoifThemeScaffoldGenPreviewOutput::Error {
                message: "Theme name is required".to_string(),
            });
        }

        let kebab = to_kebab(&input.name);
        if storage.get("theme_scaffold", &kebab).await?.is_some() {
            return Ok(CoifThemeScaffoldGenPreviewOutput::Cached);
        }

        let files = vec![
            json!({ "path": format!("themes/{}/tokens.css", kebab) }),
            json!({ "path": format!("themes/{}/config.json", kebab) }),
            json!({ "path": format!("themes/{}/{}.css", kebab, input.mode) }),
        ];

        Ok(CoifThemeScaffoldGenPreviewOutput::Ok {
            files,
            would_write: 3,
            would_skip: 0,
        })
    }

    async fn register(
        &self,
        _input: CoifThemeScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<CoifThemeScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(CoifThemeScaffoldGenRegisterOutput::Ok {
            name: "CoifThemeScaffoldGen".to_string(),
            input_kind: "ThemeConfig".to_string(),
            output_kind: "ThemeScaffold".to_string(),
            capabilities: vec![
                "theme-scaffold".to_string(),
                "design-tokens".to_string(),
                "color-palette".to_string(),
                "typography".to_string(),
                "mode-variants".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_success() {
        let storage = InMemoryStorage::new();
        let handler = CoifThemeScaffoldGenHandlerImpl;
        let result = handler.generate(
            CoifThemeScaffoldGenGenerateInput {
                name: "Ocean".to_string(),
                primary_color: "#0066cc".to_string(),
                font_family: "Inter".to_string(),
                base_size: 16,
                mode: "light".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CoifThemeScaffoldGenGenerateOutput::Ok { files, files_generated } => {
                assert_eq!(files_generated, 3);
                assert_eq!(files.len(), 3);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_empty_name() {
        let storage = InMemoryStorage::new();
        let handler = CoifThemeScaffoldGenHandlerImpl;
        let result = handler.generate(
            CoifThemeScaffoldGenGenerateInput {
                name: "".to_string(),
                primary_color: "#000".to_string(),
                font_family: "sans".to_string(),
                base_size: 16,
                mode: "light".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CoifThemeScaffoldGenGenerateOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_success() {
        let storage = InMemoryStorage::new();
        let handler = CoifThemeScaffoldGenHandlerImpl;
        let result = handler.preview(
            CoifThemeScaffoldGenPreviewInput {
                name: "TestTheme".to_string(),
                primary_color: "#fff".to_string(),
                font_family: "serif".to_string(),
                base_size: 14,
                mode: "dark".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CoifThemeScaffoldGenPreviewOutput::Ok { would_write, .. } => {
                assert_eq!(would_write, 3);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register() {
        let storage = InMemoryStorage::new();
        let handler = CoifThemeScaffoldGenHandlerImpl;
        let result = handler.register(
            CoifThemeScaffoldGenRegisterInput {},
            &storage,
        ).await.unwrap();
        match result {
            CoifThemeScaffoldGenRegisterOutput::Ok { name, capabilities, .. } => {
                assert_eq!(name, "CoifThemeScaffoldGen");
                assert!(capabilities.contains(&"design-tokens".to_string()));
            },
        }
    }
}
