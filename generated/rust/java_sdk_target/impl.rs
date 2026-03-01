// Java SDK target implementation
// Generates Java SDK packages from concept projections.
// Produces Maven-compatible package structure with type-safe
// client classes for each concept action.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::JavaSdkTargetHandler;
use serde_json::json;

pub struct JavaSdkTargetHandlerImpl;

fn to_java_class_name(name: &str) -> String {
    name.chars()
        .enumerate()
        .map(|(i, c)| {
            if i == 0 { c.to_uppercase().next().unwrap() }
            else if name.as_bytes().get(i.wrapping_sub(1)).map_or(false, |&b| b == b'-' || b == b'_') {
                c.to_uppercase().next().unwrap()
            } else if c == '-' || c == '_' { '\0' }
            else { c }
        })
        .filter(|&c| c != '\0')
        .collect()
}

#[async_trait]
impl JavaSdkTargetHandler for JavaSdkTargetHandlerImpl {
    async fn generate(
        &self,
        input: JavaSdkTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<JavaSdkTargetGenerateOutput, Box<dyn std::error::Error>> {
        let config: serde_json::Value = serde_json::from_str(&input.config)
            .unwrap_or_else(|_| json!({}));

        let package_name = config.get("packageName")
            .and_then(|v| v.as_str())
            .unwrap_or("com.org.app.sdk");

        let concept_name = input.projection
            .replace("-projection", "")
            .replace('-', "");
        let class_name = to_java_class_name(&concept_name);
        let package_path = package_name.replace('.', "/");

        let artifact = format!("{}:{}", package_name, concept_name);

        let files = vec![
            format!("src/main/java/{}/{}Client.java", package_path, class_name),
            format!("src/main/java/{}/{}Types.java", package_path, class_name),
            format!("src/main/java/{}/{}Exception.java", package_path, class_name),
            "pom.xml".to_string(),
        ];

        let gen_id = format!("java-sdk-{}-{}", concept_name, chrono::Utc::now().timestamp_millis());
        storage.put("sdk-target", &gen_id, json!({
            "artifact": artifact,
            "files": files,
            "projection": input.projection,
            "generatedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(JavaSdkTargetGenerateOutput::Ok { artifact, files })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_default_config() {
        let storage = InMemoryStorage::new();
        let handler = JavaSdkTargetHandlerImpl;
        let result = handler.generate(
            JavaSdkTargetGenerateInput {
                projection: "user-projection".into(),
                config: "{}".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            JavaSdkTargetGenerateOutput::Ok { artifact, files } => {
                assert!(artifact.contains("com.org.app.sdk"));
                assert!(files.iter().any(|f| f.contains("Client.java")));
                assert!(files.iter().any(|f| f.contains("pom.xml")));
            }
        }
    }

    #[tokio::test]
    async fn test_generate_custom_package() {
        let storage = InMemoryStorage::new();
        let handler = JavaSdkTargetHandlerImpl;
        let result = handler.generate(
            JavaSdkTargetGenerateInput {
                projection: "article-projection".into(),
                config: r#"{"packageName":"com.myapp.sdk"}"#.into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            JavaSdkTargetGenerateOutput::Ok { artifact, files } => {
                assert!(artifact.contains("com.myapp.sdk"));
                assert!(files.len() == 4);
            }
        }
    }
}
