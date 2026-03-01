use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RustSdkTargetHandler;
use serde_json::json;

pub struct RustSdkTargetHandlerImpl;

#[async_trait]
impl RustSdkTargetHandler for RustSdkTargetHandlerImpl {
    async fn generate(
        &self,
        input: RustSdkTargetGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<RustSdkTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection: serde_json::Value = serde_json::from_str(&input.projection)
            .unwrap_or(json!({"concept": "unknown", "actions": []}));
        let config: serde_json::Value = serde_json::from_str(&input.config)
            .unwrap_or(json!({}));

        let concept = projection.get("concept").and_then(|v| v.as_str()).unwrap_or("unknown");
        let crate_name = config.get("crateName")
            .and_then(|v| v.as_str())
            .unwrap_or(&format!("clef-sdk-{}", concept.replace('_', "-")))
            .to_string();

        // Generate SDK crate files
        let mut files = vec![
            format!("{}/Cargo.toml", crate_name),
            format!("{}/src/lib.rs", crate_name),
            format!("{}/src/client.rs", crate_name),
            format!("{}/src/types.rs", crate_name),
        ];

        if let Some(actions) = projection.get("actions").and_then(|v| v.as_array()) {
            for action in actions {
                if let Some(name) = action.as_str() {
                    files.push(format!("{}/src/{}.rs", crate_name, name.replace('-', "_")));
                }
            }
        }

        Ok(RustSdkTargetGenerateOutput::Ok {
            crate_name: crate_name,
            files,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_default_crate_name() {
        let storage = InMemoryStorage::new();
        let handler = RustSdkTargetHandlerImpl;
        let result = handler.generate(
            RustSdkTargetGenerateInput {
                projection: r#"{"concept":"user","actions":["create","get"]}"#.to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RustSdkTargetGenerateOutput::Ok { crate_name, files } => {
                assert!(crate_name.contains("user"));
                assert!(files.len() >= 4);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_custom_crate_name() {
        let storage = InMemoryStorage::new();
        let handler = RustSdkTargetHandlerImpl;
        let result = handler.generate(
            RustSdkTargetGenerateInput {
                projection: r#"{"concept":"article","actions":[]}"#.to_string(),
                config: r#"{"crateName":"my-custom-sdk"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RustSdkTargetGenerateOutput::Ok { crate_name, .. } => {
                assert_eq!(crate_name, "my-custom-sdk");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
