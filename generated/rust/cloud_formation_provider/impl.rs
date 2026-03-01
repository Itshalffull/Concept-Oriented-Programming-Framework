// CloudFormation Provider -- generate and manage AWS CloudFormation stacks
// Translates deploy plans into CloudFormation templates, previews change sets, and manages lifecycle.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CloudFormationProviderHandler;
use serde_json::json;

pub struct CloudFormationProviderHandlerImpl;

#[async_trait]
impl CloudFormationProviderHandler for CloudFormationProviderHandlerImpl {
    async fn generate(
        &self,
        input: CloudFormationProviderGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudFormationProviderGenerateOutput, Box<dyn std::error::Error>> {
        let plan: serde_json::Value = serde_json::from_str(&input.plan).unwrap_or(json!({}));
        let stack_name = plan["stackName"]
            .as_str()
            .unwrap_or("clef-stack")
            .to_string();

        // Generate CloudFormation template from plan
        let template = json!({
            "AWSTemplateFormatVersion": "2010-09-09",
            "Description": format!("Generated stack: {}", stack_name),
            "Resources": {}
        });

        let template_path = format!("infra/cloudformation/{}.json", stack_name);

        storage.put("stack", &stack_name, json!({
            "stackName": stack_name,
            "template": template.to_string(),
            "templatePath": template_path,
            "status": "generated",
        })).await?;

        Ok(CloudFormationProviderGenerateOutput::Ok {
            stack: stack_name,
            files: vec![template_path],
        })
    }

    async fn preview(
        &self,
        input: CloudFormationProviderPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudFormationProviderPreviewOutput, Box<dyn std::error::Error>> {
        let record = storage.get("stack", &input.stack).await?;
        if record.is_none() {
            return Ok(CloudFormationProviderPreviewOutput::ChangeSetEmpty {
                stack: input.stack,
            });
        }

        let change_set_id = format!("cs-{}-{}", input.stack, chrono::Utc::now().timestamp());

        storage.put("changeset", &change_set_id, json!({
            "changeSetId": change_set_id,
            "stack": input.stack,
            "status": "pending",
        })).await?;

        Ok(CloudFormationProviderPreviewOutput::Ok {
            stack: input.stack,
            change_set_id,
            to_create: 0,
            to_update: 0,
            to_delete: 0,
        })
    }

    async fn apply(
        &self,
        input: CloudFormationProviderApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudFormationProviderApplyOutput, Box<dyn std::error::Error>> {
        let record = storage.get("stack", &input.stack).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(CloudFormationProviderApplyOutput::RollbackComplete {
                    stack: input.stack,
                    reason: "Stack not found".to_string(),
                });
            }
        };

        let stack_id = format!("arn:aws:cloudformation:us-east-1:000000000000:stack/{}/{}",
            input.stack, chrono::Utc::now().timestamp());

        // Update stack status
        let mut updated = record.clone();
        updated["status"] = json!("applied");
        updated["stackId"] = json!(stack_id);
        storage.put("stack", &input.stack, updated).await?;

        Ok(CloudFormationProviderApplyOutput::Ok {
            stack: input.stack,
            stack_id,
            created: vec![],
            updated: vec![],
        })
    }

    async fn teardown(
        &self,
        input: CloudFormationProviderTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudFormationProviderTeardownOutput, Box<dyn std::error::Error>> {
        let record = storage.get("stack", &input.stack).await?;
        if record.is_none() {
            return Ok(CloudFormationProviderTeardownOutput::DeletionFailed {
                stack: input.stack.clone(),
                resource: "stack".to_string(),
                reason: "Stack not found".to_string(),
            });
        }

        storage.del("stack", &input.stack).await?;

        Ok(CloudFormationProviderTeardownOutput::Ok {
            stack: input.stack,
            destroyed: vec![],
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
        let handler = CloudFormationProviderHandlerImpl;
        let result = handler.generate(
            CloudFormationProviderGenerateInput {
                plan: r#"{"stackName":"my-stack"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudFormationProviderGenerateOutput::Ok { stack, files } => {
                assert_eq!(stack, "my-stack");
                assert!(!files.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_preview_empty_changeset() {
        let storage = InMemoryStorage::new();
        let handler = CloudFormationProviderHandlerImpl;
        let result = handler.preview(
            CloudFormationProviderPreviewInput {
                stack: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudFormationProviderPreviewOutput::ChangeSetEmpty { stack } => {
                assert_eq!(stack, "nonexistent");
            },
            _ => panic!("Expected ChangeSetEmpty variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_rollback_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CloudFormationProviderHandlerImpl;
        let result = handler.apply(
            CloudFormationProviderApplyInput {
                stack: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudFormationProviderApplyOutput::RollbackComplete { reason, .. } => {
                assert!(reason.contains("not found"));
            },
            _ => panic!("Expected RollbackComplete variant"),
        }
    }

    #[tokio::test]
    async fn test_teardown_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CloudFormationProviderHandlerImpl;
        let result = handler.teardown(
            CloudFormationProviderTeardownInput {
                stack: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudFormationProviderTeardownOutput::DeletionFailed { reason, .. } => {
                assert!(reason.contains("not found"));
            },
            _ => panic!("Expected DeletionFailed variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_then_apply() {
        let storage = InMemoryStorage::new();
        let handler = CloudFormationProviderHandlerImpl;

        handler.generate(
            CloudFormationProviderGenerateInput {
                plan: r#"{"stackName":"test-stack"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();

        let result = handler.apply(
            CloudFormationProviderApplyInput {
                stack: "test-stack".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudFormationProviderApplyOutput::Ok { stack, .. } => {
                assert_eq!(stack, "test-stack");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
