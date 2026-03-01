// GcfRuntime concept implementation
// Google Cloud Functions runtime provisioning, deployment, traffic management, and teardown.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GcfRuntimeHandler;
use serde_json::json;
use chrono::Utc;

pub struct GcfRuntimeHandlerImpl;

#[async_trait]
impl GcfRuntimeHandler for GcfRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: GcfRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        let function_name = format!("{}-{}-fn", input.concept, input.region);
        let endpoint = format!("https://{}-{}.cloudfunctions.net/{}", input.region, input.project_id, function_name);

        storage.put("function", &function_name, json!({
            "function": function_name,
            "concept": input.concept,
            "projectId": input.project_id,
            "region": input.region,
            "runtime": input.runtime,
            "triggerType": input.trigger_type,
            "endpoint": endpoint,
            "version": "1",
            "trafficWeight": 100,
            "createdAt": Utc::now().to_rfc3339(),
        })).await?;

        Ok(GcfRuntimeProvisionOutput::Ok {
            function: function_name,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: GcfRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeDeployOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("function", &input.function).await?;
        let version = existing
            .as_ref()
            .and_then(|r| r.get("version").and_then(|v| v.as_str()))
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(0) + 1;

        if let Some(mut record) = existing {
            record["version"] = json!(version.to_string());
            record["sourceArchive"] = json!(input.source_archive);
            record["deployedAt"] = json!(Utc::now().to_rfc3339());
            storage.put("function", &input.function, record).await?;
        }

        Ok(GcfRuntimeDeployOutput::Ok {
            function: input.function,
            version: version.to_string(),
        })
    }

    async fn set_traffic_weight(
        &self,
        input: GcfRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        if let Some(mut record) = storage.get("function", &input.function).await? {
            record["trafficWeight"] = json!(input.weight);
            storage.put("function", &input.function, record).await?;
        }

        Ok(GcfRuntimeSetTrafficWeightOutput::Ok {
            function: input.function,
        })
    }

    async fn rollback(
        &self,
        input: GcfRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        if let Some(mut record) = storage.get("function", &input.function).await? {
            record["version"] = json!(input.target_version);
            storage.put("function", &input.function, record).await?;
        }

        Ok(GcfRuntimeRollbackOutput::Ok {
            function: input.function,
            restored_version: input.target_version,
        })
    }

    async fn destroy(
        &self,
        input: GcfRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GcfRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        storage.del("function", &input.function).await?;
        Ok(GcfRuntimeDestroyOutput::Ok {
            function: input.function,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_provision_success() {
        let storage = InMemoryStorage::new();
        let handler = GcfRuntimeHandlerImpl;
        let result = handler.provision(
            GcfRuntimeProvisionInput {
                concept: "user".to_string(),
                project_id: "my-project".to_string(),
                region: "us-central1".to_string(),
                runtime: "nodejs20".to_string(),
                trigger_type: "http".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GcfRuntimeProvisionOutput::Ok { function, endpoint } => {
                assert!(function.contains("user"));
                assert!(endpoint.contains("cloudfunctions.net"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_increments_version() {
        let storage = InMemoryStorage::new();
        let handler = GcfRuntimeHandlerImpl;
        let prov = handler.provision(
            GcfRuntimeProvisionInput {
                concept: "article".to_string(),
                project_id: "proj".to_string(),
                region: "us-east1".to_string(),
                runtime: "nodejs20".to_string(),
                trigger_type: "http".to_string(),
            },
            &storage,
        ).await.unwrap();
        if let GcfRuntimeProvisionOutput::Ok { function, .. } = prov {
            let result = handler.deploy(
                GcfRuntimeDeployInput {
                    function: function.clone(),
                    source_archive: "gs://bucket/archive.zip".to_string(),
                },
                &storage,
            ).await.unwrap();
            match result {
                GcfRuntimeDeployOutput::Ok { version, .. } => {
                    assert_eq!(version, "2");
                },
                _ => panic!("Expected Ok variant"),
            }
        }
    }

    #[tokio::test]
    async fn test_set_traffic_weight() {
        let storage = InMemoryStorage::new();
        let handler = GcfRuntimeHandlerImpl;
        let result = handler.set_traffic_weight(
            GcfRuntimeSetTrafficWeightInput {
                function: "fn-1".to_string(),
                weight: 50,
            },
            &storage,
        ).await.unwrap();
        match result {
            GcfRuntimeSetTrafficWeightOutput::Ok { .. } => {},
        }
    }

    #[tokio::test]
    async fn test_rollback() {
        let storage = InMemoryStorage::new();
        let handler = GcfRuntimeHandlerImpl;
        let result = handler.rollback(
            GcfRuntimeRollbackInput {
                function: "fn-1".to_string(),
                target_version: "1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GcfRuntimeRollbackOutput::Ok { restored_version, .. } => {
                assert_eq!(restored_version, "1");
            },
        }
    }

    #[tokio::test]
    async fn test_destroy() {
        let storage = InMemoryStorage::new();
        let handler = GcfRuntimeHandlerImpl;
        let result = handler.destroy(
            GcfRuntimeDestroyInput { function: "fn-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GcfRuntimeDestroyOutput::Ok { function } => {
                assert_eq!(function, "fn-1");
            },
        }
    }
}
