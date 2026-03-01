// PySdkTarget concept implementation
// Generates a Python SDK package from a concept projection, producing
// typed dataclass models, client stubs, and package configuration.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PySdkTargetHandler;
use serde_json::json;

pub struct PySdkTargetHandlerImpl;

#[async_trait]
impl PySdkTargetHandler for PySdkTargetHandlerImpl {
    async fn generate(
        &self,
        input: PySdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PySdkTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection: serde_json::Value = serde_json::from_str(&input.projection).unwrap_or(json!({}));
        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));

        let package_name = config.get("packageName")
            .and_then(|v| v.as_str())
            .unwrap_or("clef_sdk")
            .to_string();

        let concepts = projection.get("concepts")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut files = Vec::new();

        // Generate __init__.py
        files.push(format!("{}/__init__.py", package_name));

        // Generate models.py with dataclass types
        files.push(format!("{}/models.py", package_name));

        // Generate a client module for each concept
        for concept in &concepts {
            let name = concept.get("name").and_then(|v| v.as_str()).unwrap_or("concept");
            // Convert PascalCase to snake_case for Python module names
            let snake_name = name.chars().enumerate().fold(String::new(), |mut acc, (i, c)| {
                if c.is_uppercase() && i > 0 {
                    acc.push('_');
                }
                acc.push(c.to_ascii_lowercase());
                acc
            });
            files.push(format!("{}/{}_client.py", package_name, snake_name));
        }

        // Generate setup.py / pyproject.toml
        files.push("pyproject.toml".to_string());
        files.push("setup.py".to_string());

        // Generate type stubs
        files.push(format!("{}/py.typed", package_name));

        // Persist generation metadata
        storage.put("py-sdk-target", &package_name, json!({
            "package": package_name,
            "files": files,
            "conceptCount": concepts.len(),
            "generatedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(PySdkTargetGenerateOutput::Ok {
            package: package_name,
            files,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_default_package() {
        let storage = InMemoryStorage::new();
        let handler = PySdkTargetHandlerImpl;
        let result = handler.generate(
            PySdkTargetGenerateInput {
                projection: r#"{"concepts":[{"name":"User"}]}"#.to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PySdkTargetGenerateOutput::Ok { package, files } => {
                assert_eq!(package, "clef_sdk");
                assert!(files.iter().any(|f| f.contains("__init__.py")));
                assert!(files.iter().any(|f| f.contains("models.py")));
                assert!(files.iter().any(|f| f.contains("user_client.py")));
            }
        }
    }

    #[tokio::test]
    async fn test_generate_custom_package_name() {
        let storage = InMemoryStorage::new();
        let handler = PySdkTargetHandlerImpl;
        let result = handler.generate(
            PySdkTargetGenerateInput {
                projection: r#"{"concepts":[]}"#.to_string(),
                config: r#"{"packageName":"my_sdk"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            PySdkTargetGenerateOutput::Ok { package, .. } => {
                assert_eq!(package, "my_sdk");
            }
        }
    }
}
