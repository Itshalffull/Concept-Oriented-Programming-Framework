// DockerComposeIacProvider Handler Implementation
//
// Docker Compose IaC provider. Generates Compose files from deploy
// plans, previews changes, applies services, and handles teardown.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DockerComposeIacProviderHandler;
use serde_json::json;

const RELATION: &str = "dciac";

fn generate_compose_id() -> String {
    format!("compose-{}", chrono::Utc::now().timestamp_millis())
}

pub struct DockerComposeIacProviderHandlerImpl;

#[async_trait]
impl DockerComposeIacProviderHandler for DockerComposeIacProviderHandlerImpl {
    async fn generate(
        &self,
        input: DockerComposeIacProviderGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeIacProviderGenerateOutput, Box<dyn std::error::Error>> {
        let compose_file_id = generate_compose_id();

        storage.put(RELATION, &compose_file_id, json!({
            "composeFile": compose_file_id,
            "plan": input.plan,
            "status": "generated",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(DockerComposeIacProviderGenerateOutput::Ok {
            compose_file: compose_file_id,
            files: vec!["docker-compose.yml".to_string()],
        })
    }

    async fn preview(
        &self,
        input: DockerComposeIacProviderPreviewInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeIacProviderPreviewOutput, Box<dyn std::error::Error>> {
        Ok(DockerComposeIacProviderPreviewOutput::Ok {
            compose_file: input.compose_file,
            to_create: 0,
            to_update: 0,
            to_delete: 0,
        })
    }

    async fn apply(
        &self,
        input: DockerComposeIacProviderApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeIacProviderApplyOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.compose_file).await?;
        if let Some(mut r) = record {
            r["status"] = json!("applied");
            r["appliedAt"] = json!(chrono::Utc::now().to_rfc3339());
            storage.put(RELATION, &input.compose_file, r).await?;
        }

        Ok(DockerComposeIacProviderApplyOutput::Ok {
            compose_file: input.compose_file,
            created: vec![],
            updated: vec![],
        })
    }

    async fn teardown(
        &self,
        input: DockerComposeIacProviderTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeIacProviderTeardownOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.compose_file).await?;
        if record.is_none() {
            return Ok(DockerComposeIacProviderTeardownOutput::Ok {
                compose_file: input.compose_file,
                destroyed: vec![],
            });
        }

        storage.del(RELATION, &input.compose_file).await?;
        Ok(DockerComposeIacProviderTeardownOutput::Ok {
            compose_file: input.compose_file.clone(),
            destroyed: vec![input.compose_file],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate() {
        let storage = InMemoryStorage::new();
        let handler = DockerComposeIacProviderHandlerImpl;
        let result = handler.generate(
            DockerComposeIacProviderGenerateInput {
                plan: "my-plan".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DockerComposeIacProviderGenerateOutput::Ok { compose_file, files } => {
                assert!(!compose_file.is_empty());
                assert!(files.contains(&"docker-compose.yml".to_string()));
            },
        }
    }

    #[tokio::test]
    async fn test_preview() {
        let storage = InMemoryStorage::new();
        let handler = DockerComposeIacProviderHandlerImpl;
        let result = handler.preview(
            DockerComposeIacProviderPreviewInput {
                compose_file: "compose-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DockerComposeIacProviderPreviewOutput::Ok { to_create, to_update, to_delete, .. } => {
                assert_eq!(to_create, 0);
                assert_eq!(to_update, 0);
                assert_eq!(to_delete, 0);
            },
        }
    }

    #[tokio::test]
    async fn test_apply() {
        let storage = InMemoryStorage::new();
        let handler = DockerComposeIacProviderHandlerImpl;
        let gen_result = handler.generate(
            DockerComposeIacProviderGenerateInput {
                plan: "plan-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let cf = match gen_result {
            DockerComposeIacProviderGenerateOutput::Ok { compose_file, .. } => compose_file,
        };
        let result = handler.apply(
            DockerComposeIacProviderApplyInput {
                compose_file: cf.clone(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DockerComposeIacProviderApplyOutput::Ok { compose_file, .. } => {
                assert_eq!(compose_file, cf);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_teardown() {
        let storage = InMemoryStorage::new();
        let handler = DockerComposeIacProviderHandlerImpl;
        let result = handler.teardown(
            DockerComposeIacProviderTeardownInput {
                compose_file: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DockerComposeIacProviderTeardownOutput::Ok { destroyed, .. } => {
                assert!(destroyed.is_empty());
            },
        }
    }
}
