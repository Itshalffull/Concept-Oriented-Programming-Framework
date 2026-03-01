// SDK concept implementation
// Generates typed SDK packages from concept projections for multiple target
// languages, and publishes them to package registries with version management.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SdkHandler;
use serde_json::json;

pub struct SdkHandlerImpl;

/// Map language identifiers to file extensions and package manifest names
fn language_config(language: &str) -> Option<(&'static str, &'static str, &'static str)> {
    match language {
        "typescript" | "ts" => Some((".ts", "package.json", "npm")),
        "javascript" | "js" => Some((".js", "package.json", "npm")),
        "python" | "py" => Some((".py", "pyproject.toml", "pypi")),
        "rust" | "rs" => Some((".rs", "Cargo.toml", "crates.io")),
        "swift" => Some((".swift", "Package.swift", "spm")),
        "go" => Some((".go", "go.mod", "go")),
        "java" => Some((".java", "pom.xml", "maven")),
        _ => None,
    }
}

#[async_trait]
impl SdkHandler for SdkHandlerImpl {
    async fn generate(
        &self,
        input: SdkGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SdkGenerateOutput, Box<dyn std::error::Error>> {
        let lang_config = match language_config(&input.language) {
            Some(c) => c,
            None => return Ok(SdkGenerateOutput::LanguageError {
                language: input.language,
                reason: "Unsupported target language".to_string(),
            }),
        };

        let (ext, manifest_name, _registry_type) = lang_config;

        let projection: serde_json::Value = serde_json::from_str(&input.projection).unwrap_or(json!({}));
        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));

        let package_name = config.get("packageName")
            .and_then(|v| v.as_str())
            .unwrap_or("clef-sdk")
            .to_string();

        let concepts = projection.get("concepts")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut files = Vec::new();

        // Generate a client file for each concept
        for concept in &concepts {
            let name = concept.get("name").and_then(|v| v.as_str()).unwrap_or("concept");

            // Convert PascalCase to appropriate casing for the language
            let file_name = name.chars().enumerate().fold(String::new(), |mut acc, (i, c)| {
                if c.is_uppercase() && i > 0 {
                    acc.push('_');
                }
                acc.push(c.to_ascii_lowercase());
                acc
            });

            files.push(format!("src/{}{}", file_name, ext));

            // Check for unsupported types in the concept
            if let Some(actions) = concept.get("actions").and_then(|v| v.as_array()) {
                for action in actions {
                    if let Some(type_name) = action.get("unsupportedType").and_then(|v| v.as_str()) {
                        return Ok(SdkGenerateOutput::UnsupportedType {
                            type_name: type_name.to_string(),
                            language: input.language,
                        });
                    }
                }
            }
        }

        // Generate index/barrel file
        files.push(format!("src/index{}", ext));

        // Generate types file
        files.push(format!("src/types{}", ext));

        // Generate package manifest
        let package_json = json!({
            "name": package_name,
            "version": "0.1.0",
            "language": input.language,
            "concepts": concepts.len(),
        });
        files.push(manifest_name.to_string());

        // Persist generation metadata
        storage.put("sdk", &package_name, json!({
            "package": package_name,
            "language": input.language,
            "files": files,
            "conceptCount": concepts.len(),
            "generatedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(SdkGenerateOutput::Ok {
            package: package_name,
            files,
            package_json: serde_json::to_string(&package_json)?,
        })
    }

    async fn publish(
        &self,
        input: SdkPublishInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SdkPublishOutput, Box<dyn std::error::Error>> {
        // Check if the package exists in generation records
        let pkg_record = storage.get("sdk", &input.package).await?;
        if pkg_record.is_none() {
            return Ok(SdkPublishOutput::RegistryUnavailable {
                registry: input.registry,
            });
        }

        // Check for existing published version
        let pub_key = format!("{}:{}", input.package, input.registry);
        let existing_pub = storage.get("sdk-published", &pub_key).await?;
        if let Some(pub_record) = existing_pub {
            let version = pub_record.get("version").and_then(|v| v.as_str()).unwrap_or("0.1.0").to_string();
            return Ok(SdkPublishOutput::VersionExists {
                package: input.package,
                version,
            });
        }

        let version = "0.1.0".to_string();

        storage.put("sdk-published", &pub_key, json!({
            "package": input.package,
            "registry": input.registry,
            "version": version,
            "publishedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(SdkPublishOutput::Ok {
            package: input.package,
            published_version: version,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_typescript() {
        let storage = InMemoryStorage::new();
        let handler = SdkHandlerImpl;
        let result = handler.generate(
            SdkGenerateInput {
                projection: r#"{"concepts":[{"name":"User","actions":[]}]}"#.to_string(),
                language: "typescript".to_string(),
                config: r#"{"packageName":"my-sdk"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SdkGenerateOutput::Ok { package, files, .. } => {
                assert_eq!(package, "my-sdk");
                assert!(!files.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_unsupported_language() {
        let storage = InMemoryStorage::new();
        let handler = SdkHandlerImpl;
        let result = handler.generate(
            SdkGenerateInput {
                projection: "{}".to_string(),
                language: "brainfuck".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SdkGenerateOutput::LanguageError { language, .. } => {
                assert_eq!(language, "brainfuck");
            },
            _ => panic!("Expected LanguageError variant"),
        }
    }

    #[tokio::test]
    async fn test_publish_not_generated() {
        let storage = InMemoryStorage::new();
        let handler = SdkHandlerImpl;
        let result = handler.publish(
            SdkPublishInput {
                package: "missing-pkg".to_string(),
                registry: "npm".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SdkPublishOutput::RegistryUnavailable { .. } => {},
            _ => panic!("Expected RegistryUnavailable variant"),
        }
    }
}
