// PulumiProvider concept implementation
// Infrastructure-as-Code provider for Pulumi stacks: generates TypeScript programs,
// previews resource changes, applies deployments, and tears down stacks.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PulumiProviderHandler;
use serde_json::json;

pub struct PulumiProviderHandlerImpl;

#[async_trait]
impl PulumiProviderHandler for PulumiProviderHandlerImpl {
    async fn generate(
        &self,
        input: PulumiProviderGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PulumiProviderGenerateOutput, Box<dyn std::error::Error>> {
        let plan: serde_json::Value = serde_json::from_str(&input.plan).unwrap_or(json!({}));
        let stack_name = plan.get("stack").and_then(|v| v.as_str()).unwrap_or("default").to_string();

        let resources = plan.get("resources").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let mut files = Vec::new();

        // Generate the Pulumi index.ts entry point
        files.push("index.ts".to_string());

        // Generate a resource file for each resource in the plan
        for resource in &resources {
            let name = resource.get("name").and_then(|v| v.as_str()).unwrap_or("resource");
            files.push(format!("{}.ts", name));
        }

        // Generate Pulumi.yaml stack configuration
        files.push("Pulumi.yaml".to_string());
        files.push(format!("Pulumi.{}.yaml", stack_name));

        // Persist the generated stack metadata
        storage.put("pulumi-stack", &stack_name, json!({
            "stack": stack_name,
            "plan": input.plan,
            "files": files,
            "status": "generated",
            "resourceCount": resources.len(),
        })).await?;

        Ok(PulumiProviderGenerateOutput::Ok {
            stack: stack_name,
            files,
        })
    }

    async fn preview(
        &self,
        input: PulumiProviderPreviewInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PulumiProviderPreviewOutput, Box<dyn std::error::Error>> {
        let stack_record = storage.get("pulumi-stack", &input.stack).await?;
        if stack_record.is_none() {
            return Ok(PulumiProviderPreviewOutput::BackendUnreachable {
                backend: input.stack.clone(),
            });
        }

        let record = stack_record.unwrap();
        let plan_str = record.get("plan").and_then(|v| v.as_str()).unwrap_or("{}");
        let plan: serde_json::Value = serde_json::from_str(plan_str).unwrap_or(json!({}));

        let resources = plan.get("resources").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        // Compute preview: count resources by operation type
        let mut to_create: i64 = 0;
        let mut to_update: i64 = 0;
        let mut to_delete: i64 = 0;

        let deployed = storage.find("pulumi-resource", Some(&json!({"stack": input.stack}))).await?;
        let deployed_names: Vec<String> = deployed.iter()
            .filter_map(|r| r.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        for resource in &resources {
            let name = resource.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if deployed_names.contains(&name.to_string()) {
                to_update += 1;
            } else {
                to_create += 1;
            }
        }

        for deployed_name in &deployed_names {
            let still_in_plan = resources.iter().any(|r| {
                r.get("name").and_then(|v| v.as_str()) == Some(deployed_name)
            });
            if !still_in_plan {
                to_delete += 1;
            }
        }

        let estimated_cost = (to_create as f64) * 0.01 + (to_update as f64) * 0.005;

        Ok(PulumiProviderPreviewOutput::Ok {
            stack: input.stack,
            to_create,
            to_update,
            to_delete,
            estimated_cost,
        })
    }

    async fn apply(
        &self,
        input: PulumiProviderApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PulumiProviderApplyOutput, Box<dyn std::error::Error>> {
        let stack_record = storage.get("pulumi-stack", &input.stack).await?;
        if stack_record.is_none() {
            return Ok(PulumiProviderApplyOutput::PluginMissing {
                plugin: "pulumi".to_string(),
                version: "latest".to_string(),
            });
        }

        let record = stack_record.unwrap();
        let plan_str = record.get("plan").and_then(|v| v.as_str()).unwrap_or("{}");
        let plan: serde_json::Value = serde_json::from_str(plan_str).unwrap_or(json!({}));
        let resources = plan.get("resources").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        let mut created = Vec::new();
        let mut updated = Vec::new();

        let deployed = storage.find("pulumi-resource", Some(&json!({"stack": input.stack}))).await?;
        let deployed_names: Vec<String> = deployed.iter()
            .filter_map(|r| r.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .collect();

        for resource in &resources {
            let name = resource.get("name").and_then(|v| v.as_str()).unwrap_or("resource").to_string();
            let resource_type = resource.get("type").and_then(|v| v.as_str()).unwrap_or("custom").to_string();

            storage.put("pulumi-resource", &name, json!({
                "name": name,
                "stack": input.stack,
                "type": resource_type,
                "status": "deployed",
            })).await?;

            if deployed_names.contains(&name) {
                updated.push(name);
            } else {
                created.push(name);
            }
        }

        // Update stack status
        let mut updated_record = record.clone();
        updated_record["status"] = json!("deployed");
        storage.put("pulumi-stack", &input.stack, updated_record).await?;

        Ok(PulumiProviderApplyOutput::Ok {
            stack: input.stack,
            created,
            updated,
        })
    }

    async fn teardown(
        &self,
        input: PulumiProviderTeardownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PulumiProviderTeardownOutput, Box<dyn std::error::Error>> {
        let deployed = storage.find("pulumi-resource", Some(&json!({"stack": input.stack}))).await?;

        let mut destroyed = Vec::new();

        for resource in &deployed {
            let name = resource.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let is_protected = resource.get("protected").and_then(|v| v.as_bool()).unwrap_or(false);

            if is_protected {
                return Ok(PulumiProviderTeardownOutput::ProtectedResource {
                    stack: input.stack,
                    resource: name,
                });
            }

            storage.del("pulumi-resource", &name).await?;
            destroyed.push(name);
        }

        // Mark stack as destroyed
        if let Some(mut stack_record) = storage.get("pulumi-stack", &input.stack).await? {
            stack_record["status"] = json!("destroyed");
            storage.put("pulumi-stack", &input.stack, stack_record).await?;
        }

        Ok(PulumiProviderTeardownOutput::Ok {
            stack: input.stack,
            destroyed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_stack() {
        let storage = InMemoryStorage::new();
        let handler = PulumiProviderHandlerImpl;
        let plan = r#"{"stack":"dev","resources":[{"name":"bucket","type":"aws:s3:Bucket"}]}"#;
        let result = handler.generate(
            PulumiProviderGenerateInput { plan: plan.to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PulumiProviderGenerateOutput::Ok { stack, files } => {
                assert_eq!(stack, "dev");
                assert!(files.contains(&"index.ts".to_string()));
                assert!(files.contains(&"bucket.ts".to_string()));
            }
        }
    }

    #[tokio::test]
    async fn test_preview_backend_unreachable() {
        let storage = InMemoryStorage::new();
        let handler = PulumiProviderHandlerImpl;
        let result = handler.preview(
            PulumiProviderPreviewInput { stack: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PulumiProviderPreviewOutput::BackendUnreachable { .. } => {}
            _ => panic!("Expected BackendUnreachable variant"),
        }
    }

    #[tokio::test]
    async fn test_preview_after_generate() {
        let storage = InMemoryStorage::new();
        let handler = PulumiProviderHandlerImpl;
        let plan = r#"{"stack":"dev","resources":[{"name":"bucket","type":"aws:s3:Bucket"}]}"#;
        handler.generate(PulumiProviderGenerateInput { plan: plan.to_string() }, &storage).await.unwrap();
        let result = handler.preview(
            PulumiProviderPreviewInput { stack: "dev".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PulumiProviderPreviewOutput::Ok { to_create, .. } => {
                assert_eq!(to_create, 1);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_plugin_missing() {
        let storage = InMemoryStorage::new();
        let handler = PulumiProviderHandlerImpl;
        let result = handler.apply(
            PulumiProviderApplyInput { stack: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PulumiProviderApplyOutput::PluginMissing { .. } => {}
            _ => panic!("Expected PluginMissing variant"),
        }
    }

    #[tokio::test]
    async fn test_teardown_empty() {
        let storage = InMemoryStorage::new();
        let handler = PulumiProviderHandlerImpl;
        let result = handler.teardown(
            PulumiProviderTeardownInput { stack: "dev".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PulumiProviderTeardownOutput::Ok { destroyed, .. } => {
                assert!(destroyed.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
