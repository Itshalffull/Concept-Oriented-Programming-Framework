// IaC -- infrastructure-as-code generation and application across providers.
// Coordinates emit, preview, apply, drift detection, and teardown of
// cloud resources through pluggable IaC providers.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::IaCHandler;
use serde_json::json;

pub struct IaCHandlerImpl;

#[async_trait]
impl IaCHandler for IaCHandlerImpl {
    async fn emit(
        &self,
        input: IaCEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCEmitOutput, Box<dyn std::error::Error>> {
        let supported_providers = ["pulumi", "terraform", "cdk", "cloudformation"];
        if !supported_providers.contains(&input.provider.as_str()) {
            return Ok(IaCEmitOutput::UnsupportedResource {
                resource: "unknown".to_string(),
                provider: input.provider,
            });
        }

        let output_ref = format!("iac-{}-output", input.provider);
        let file_count: i64 = 3;

        storage.put("resource", &output_ref, json!({
            "resourceId": output_ref,
            "provider": input.provider,
            "resourceType": "iac-output",
            "concept": input.plan,
            "driftDetected": false,
            "output": output_ref,
            "fileCount": file_count,
        })).await?;

        Ok(IaCEmitOutput::Ok {
            output: output_ref,
            file_count,
        })
    }

    async fn preview(
        &self,
        input: IaCPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCPreviewOutput, Box<dyn std::error::Error>> {
        let all_resources = storage.find("resource", "{}").await?;

        let mut to_create: Vec<String> = Vec::new();
        let mut to_update: Vec<String> = Vec::new();
        let to_delete: Vec<String> = Vec::new();

        for resource in &all_resources {
            if resource["provider"].as_str() != Some(&input.provider) {
                continue;
            }
            if resource["resourceType"].as_str() == Some("iac-output") {
                continue;
            }
            if let Some(id) = resource["resourceId"].as_str() {
                to_update.push(id.to_string());
            }
        }

        let estimated_monthly_cost = (to_create.len() + to_update.len()) as f64 * 25.0;

        Ok(IaCPreviewOutput::Ok {
            to_create,
            to_update,
            to_delete,
            estimated_monthly_cost,
        })
    }

    async fn apply(
        &self,
        input: IaCApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCApplyOutput, Box<dyn std::error::Error>> {
        let mut created: Vec<String> = Vec::new();
        let updated: Vec<String> = Vec::new();
        let deleted: Vec<String> = Vec::new();

        let resource_id = format!("{}-{}-managed", input.provider, input.plan);
        storage.put("resource", &resource_id, json!({
            "resourceId": resource_id,
            "provider": input.provider,
            "resourceType": "managed",
            "concept": input.plan,
            "driftDetected": false,
        })).await?;
        created.push(resource_id);

        Ok(IaCApplyOutput::Ok {
            created,
            updated,
            deleted,
        })
    }

    async fn detect_drift(
        &self,
        input: IaCDetectDriftInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCDetectDriftOutput, Box<dyn std::error::Error>> {
        let all_resources = storage.find("resource", "{}").await?;

        let mut drifted: Vec<String> = Vec::new();
        let mut clean: Vec<String> = Vec::new();

        for resource in &all_resources {
            if resource["provider"].as_str() != Some(&input.provider) {
                continue;
            }
            if resource["resourceType"].as_str() != Some("managed") {
                continue;
            }
            let resource_id = resource["resourceId"].as_str().unwrap_or("").to_string();
            if resource["driftDetected"].as_bool().unwrap_or(false) {
                drifted.push(resource_id);
            } else {
                clean.push(resource_id);
            }
        }

        if drifted.is_empty() {
            return Ok(IaCDetectDriftOutput::NoDrift);
        }

        Ok(IaCDetectDriftOutput::Ok { drifted, clean })
    }

    async fn teardown(
        &self,
        input: IaCTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<IaCTeardownOutput, Box<dyn std::error::Error>> {
        let all_resources = storage.find("resource", "{}").await?;

        let mut destroyed: Vec<String> = Vec::new();

        for resource in &all_resources {
            if resource["provider"].as_str() != Some(&input.provider) {
                continue;
            }
            if resource["concept"].as_str() != Some(&input.plan) {
                continue;
            }
            let resource_id = resource["resourceId"].as_str().unwrap_or("").to_string();
            storage.del("resource", &resource_id).await?;
            destroyed.push(resource_id);
        }

        Ok(IaCTeardownOutput::Ok { destroyed })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_emit_success() {
        let storage = InMemoryStorage::new();
        let handler = IaCHandlerImpl;
        let result = handler.emit(
            IaCEmitInput {
                plan: "my-app".to_string(),
                provider: "terraform".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IaCEmitOutput::Ok { output, file_count } => {
                assert!(!output.is_empty());
                assert_eq!(file_count, 3);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_emit_unsupported_provider() {
        let storage = InMemoryStorage::new();
        let handler = IaCHandlerImpl;
        let result = handler.emit(
            IaCEmitInput {
                plan: "my-app".to_string(),
                provider: "unknown-provider".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IaCEmitOutput::UnsupportedResource { provider, .. } => {
                assert_eq!(provider, "unknown-provider");
            },
            _ => panic!("Expected UnsupportedResource variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_success() {
        let storage = InMemoryStorage::new();
        let handler = IaCHandlerImpl;
        let result = handler.preview(
            IaCPreviewInput {
                plan: "my-app".to_string(),
                provider: "pulumi".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IaCPreviewOutput::Ok { to_create, to_update, to_delete, .. } => {
                // Fresh storage so all lists empty
                assert!(to_create.is_empty());
                assert!(to_update.is_empty());
                assert!(to_delete.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_success() {
        let storage = InMemoryStorage::new();
        let handler = IaCHandlerImpl;
        let result = handler.apply(
            IaCApplyInput {
                plan: "my-app".to_string(),
                provider: "terraform".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IaCApplyOutput::Ok { created, .. } => {
                assert!(!created.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_detect_drift_no_drift() {
        let storage = InMemoryStorage::new();
        let handler = IaCHandlerImpl;
        // Apply first so we have a managed resource
        handler.apply(
            IaCApplyInput {
                plan: "my-app".to_string(),
                provider: "terraform".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.detect_drift(
            IaCDetectDriftInput { provider: "terraform".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            IaCDetectDriftOutput::NoDrift => {},
            _ => panic!("Expected NoDrift variant"),
        }
    }

    #[tokio::test]
    async fn test_teardown_success() {
        let storage = InMemoryStorage::new();
        let handler = IaCHandlerImpl;
        // Apply first
        handler.apply(
            IaCApplyInput {
                plan: "my-app".to_string(),
                provider: "terraform".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.teardown(
            IaCTeardownInput {
                plan: "my-app".to_string(),
                provider: "terraform".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            IaCTeardownOutput::Ok { destroyed } => {
                assert!(!destroyed.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
