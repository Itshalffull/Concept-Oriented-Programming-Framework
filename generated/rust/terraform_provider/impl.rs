// TerraformProvider concept implementation
// Generate and apply Terraform HCL modules from Clef deploy plans. Owns Terraform
// state file management, lock handling, and workspace configuration.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TerraformProviderHandler;
use serde_json::json;

pub struct TerraformProviderHandlerImpl;

#[async_trait]
impl TerraformProviderHandler for TerraformProviderHandlerImpl {
    async fn generate(
        &self,
        input: TerraformProviderGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerraformProviderGenerateOutput, Box<dyn std::error::Error>> {
        let now = chrono::Utc::now().to_rfc3339();
        let workspace_id = format!("tf-workspace-{}-{}", input.plan, now);
        let files = vec![
            format!("terraform/{}/main.tf", input.plan),
            format!("terraform/{}/variables.tf", input.plan),
            format!("terraform/{}/outputs.tf", input.plan),
            format!("terraform/{}/providers.tf", input.plan),
        ];

        storage.put("workspace", &workspace_id, json!({
            "stateBackend": "s3://terraform-state",
            "lockTable": "terraform-locks",
            "workspace": format!("ws-{}", input.plan),
            "lockId": null,
            "serial": 0,
            "lastAppliedAt": null,
            "createdAt": now
        })).await?;

        Ok(TerraformProviderGenerateOutput::Ok {
            workspace: workspace_id,
            files,
        })
    }

    async fn preview(
        &self,
        input: TerraformProviderPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerraformProviderPreviewOutput, Box<dyn std::error::Error>> {
        let record = storage.get("workspace", &input.workspace).await?;
        if record.is_none() {
            return Ok(TerraformProviderPreviewOutput::BackendInitRequired {
                workspace: input.workspace,
            });
        }

        let record = record.unwrap();
        if let Some(lock_id) = record["lockId"].as_str() {
            if !lock_id.is_empty() {
                return Ok(TerraformProviderPreviewOutput::StateLocked {
                    workspace: input.workspace,
                    lock_id: lock_id.to_string(),
                    locked_by: "another-process".to_string(),
                });
            }
        }

        Ok(TerraformProviderPreviewOutput::Ok {
            workspace: input.workspace,
            to_create: 4,
            to_update: 1,
            to_delete: 0,
        })
    }

    async fn apply(
        &self,
        input: TerraformProviderApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerraformProviderApplyOutput, Box<dyn std::error::Error>> {
        let record = storage.get("workspace", &input.workspace).await?;
        if record.is_none() {
            return Ok(TerraformProviderApplyOutput::StateLocked {
                workspace: input.workspace,
                lock_id: "unknown".to_string(),
            });
        }

        let record = record.unwrap();
        if let Some(lock_id) = record["lockId"].as_str() {
            if !lock_id.is_empty() {
                return Ok(TerraformProviderApplyOutput::StateLocked {
                    workspace: input.workspace,
                    lock_id: lock_id.to_string(),
                });
            }
        }

        let serial = record["serial"].as_i64().unwrap_or(0) + 1;
        let created = vec![
            "aws_vpc.main".to_string(),
            "aws_subnet.primary".to_string(),
            "aws_ecs_cluster.app".to_string(),
            "aws_security_group.web".to_string(),
        ];
        let updated = vec!["aws_iam_role.exec".to_string()];

        let mut updated_record = record.clone();
        updated_record["serial"] = json!(serial);
        updated_record["lastAppliedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("workspace", &input.workspace, updated_record).await?;

        Ok(TerraformProviderApplyOutput::Ok {
            workspace: input.workspace,
            created,
            updated,
        })
    }

    async fn teardown(
        &self,
        input: TerraformProviderTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TerraformProviderTeardownOutput, Box<dyn std::error::Error>> {
        let destroyed = vec![
            "aws_vpc.main".to_string(),
            "aws_subnet.primary".to_string(),
            "aws_ecs_cluster.app".to_string(),
            "aws_security_group.web".to_string(),
            "aws_iam_role.exec".to_string(),
        ];

        if let Some(record) = storage.get("workspace", &input.workspace).await? {
            let serial = record["serial"].as_i64().unwrap_or(0) + 1;
            let mut updated = record.clone();
            updated["serial"] = json!(serial);
            updated["lastAppliedAt"] = json!(chrono::Utc::now().to_rfc3339());
            storage.put("workspace", &input.workspace, updated).await?;
        }

        storage.del("workspace", &input.workspace).await?;

        Ok(TerraformProviderTeardownOutput::Ok {
            workspace: input.workspace,
            destroyed,
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
        let handler = TerraformProviderHandlerImpl;
        let result = handler.generate(
            TerraformProviderGenerateInput {
                plan: "my-app".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TerraformProviderGenerateOutput::Ok { workspace, files } => {
                assert!(!workspace.is_empty());
                assert_eq!(files.len(), 4);
                assert!(files[0].contains("main.tf"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_backend_init_required() {
        let storage = InMemoryStorage::new();
        let handler = TerraformProviderHandlerImpl;
        let result = handler.preview(
            TerraformProviderPreviewInput {
                workspace: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TerraformProviderPreviewOutput::BackendInitRequired { .. } => {},
            _ => panic!("Expected BackendInitRequired variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_after_generate() {
        let storage = InMemoryStorage::new();
        let handler = TerraformProviderHandlerImpl;
        let gen_result = handler.generate(
            TerraformProviderGenerateInput { plan: "test-plan".to_string() },
            &storage,
        ).await.unwrap();
        let workspace = match gen_result {
            TerraformProviderGenerateOutput::Ok { workspace, .. } => workspace,
            _ => panic!("Expected Ok"),
        };
        let result = handler.preview(
            TerraformProviderPreviewInput { workspace: workspace.clone() },
            &storage,
        ).await.unwrap();
        match result {
            TerraformProviderPreviewOutput::Ok { to_create, .. } => {
                assert!(to_create > 0);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_no_workspace() {
        let storage = InMemoryStorage::new();
        let handler = TerraformProviderHandlerImpl;
        let result = handler.apply(
            TerraformProviderApplyInput {
                workspace: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TerraformProviderApplyOutput::StateLocked { .. } => {},
            _ => panic!("Expected StateLocked variant for missing workspace"),
        }
    }

    #[tokio::test]
    async fn test_apply_after_generate() {
        let storage = InMemoryStorage::new();
        let handler = TerraformProviderHandlerImpl;
        let gen_result = handler.generate(
            TerraformProviderGenerateInput { plan: "apply-plan".to_string() },
            &storage,
        ).await.unwrap();
        let workspace = match gen_result {
            TerraformProviderGenerateOutput::Ok { workspace, .. } => workspace,
            _ => panic!("Expected Ok"),
        };
        let result = handler.apply(
            TerraformProviderApplyInput { workspace: workspace.clone() },
            &storage,
        ).await.unwrap();
        match result {
            TerraformProviderApplyOutput::Ok { created, updated, .. } => {
                assert!(!created.is_empty());
                assert!(!updated.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_teardown() {
        let storage = InMemoryStorage::new();
        let handler = TerraformProviderHandlerImpl;
        let gen_result = handler.generate(
            TerraformProviderGenerateInput { plan: "teardown-plan".to_string() },
            &storage,
        ).await.unwrap();
        let workspace = match gen_result {
            TerraformProviderGenerateOutput::Ok { workspace, .. } => workspace,
            _ => panic!("Expected Ok"),
        };
        let result = handler.teardown(
            TerraformProviderTeardownInput { workspace: workspace.clone() },
            &storage,
        ).await.unwrap();
        match result {
            TerraformProviderTeardownOutput::Ok { destroyed, .. } => {
                assert!(!destroyed.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
