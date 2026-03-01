// Cloudflare Runtime -- manage Cloudflare Workers deployment lifecycle
// Provisions workers, deploys scripts with size validation, manages traffic and rollback.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CloudflareRuntimeHandler;
use serde_json::json;

pub struct CloudflareRuntimeHandlerImpl;

/// Cloudflare Workers script size limit: 1 MB
const SCRIPT_SIZE_LIMIT: i64 = 1_048_576;

#[async_trait]
impl CloudflareRuntimeHandler for CloudflareRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: CloudflareRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        // Check for route conflicts against existing workers
        let existing_workers = storage.find("worker", None).await?;
        for existing in &existing_workers {
            if let Some(routes_str) = existing.get("routes").and_then(|v| v.as_str()) {
                let existing_routes: Vec<String> =
                    serde_json::from_str(routes_str).unwrap_or_default();
                for route in &input.routes {
                    if existing_routes.contains(route) {
                        return Ok(CloudflareRuntimeProvisionOutput::RouteConflict {
                            route: route.clone(),
                            existing_worker: existing["scriptName"]
                                .as_str()
                                .unwrap_or("unknown")
                                .to_string(),
                        });
                    }
                }
            }
        }

        let script_name = format!("{}-worker", input.concept.to_lowercase());
        let worker_id = format!("cf-worker-{}", input.concept.to_lowercase());
        let endpoint = format!("https://{}.{}.workers.dev", script_name, input.account_id);

        storage.put("worker", &worker_id, json!({
            "scriptName": script_name,
            "accountId": input.account_id,
            "routes": serde_json::to_string(&input.routes)?,
            "currentVersion": "0",
            "trafficWeight": 100,
        })).await?;

        Ok(CloudflareRuntimeProvisionOutput::Ok {
            worker: worker_id,
            script_name,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: CloudflareRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeDeployOutput, Box<dyn std::error::Error>> {
        let size_bytes = input.script_content.len() as i64;
        if size_bytes > SCRIPT_SIZE_LIMIT {
            return Ok(CloudflareRuntimeDeployOutput::ScriptTooLarge {
                worker: input.worker.clone(),
                size_bytes,
                limit_bytes: SCRIPT_SIZE_LIMIT,
            });
        }

        let record = storage.get("worker", &input.worker).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(CloudflareRuntimeDeployOutput::ScriptTooLarge {
                    worker: input.worker,
                    size_bytes: 0,
                    limit_bytes: SCRIPT_SIZE_LIMIT,
                });
            }
        };

        let current_version = record["currentVersion"]
            .as_str()
            .unwrap_or("0")
            .parse::<i64>()
            .unwrap_or(0);
        let new_version = (current_version + 1).to_string();

        let mut updated = record.clone();
        updated["currentVersion"] = json!(new_version);
        storage.put("worker", &input.worker, updated).await?;

        Ok(CloudflareRuntimeDeployOutput::Ok {
            worker: input.worker,
            version: new_version,
        })
    }

    async fn set_traffic_weight(
        &self,
        input: CloudflareRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("worker", &input.worker).await? {
            let mut updated = record.clone();
            updated["trafficWeight"] = json!(input.weight);
            storage.put("worker", &input.worker, updated).await?;
        }

        Ok(CloudflareRuntimeSetTrafficWeightOutput::Ok {
            worker: input.worker,
        })
    }

    async fn rollback(
        &self,
        input: CloudflareRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("worker", &input.worker).await? {
            let mut updated = record.clone();
            updated["currentVersion"] = json!(input.target_version);
            storage.put("worker", &input.worker, updated).await?;
        }

        Ok(CloudflareRuntimeRollbackOutput::Ok {
            worker: input.worker,
            restored_version: input.target_version,
        })
    }

    async fn destroy(
        &self,
        input: CloudflareRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudflareRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        storage.del("worker", &input.worker).await?;

        Ok(CloudflareRuntimeDestroyOutput::Ok {
            worker: input.worker,
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
        let handler = CloudflareRuntimeHandlerImpl;
        let result = handler.provision(
            CloudflareRuntimeProvisionInput {
                concept: "Comment".to_string(),
                account_id: "abc123".to_string(),
                routes: vec!["example.com/*".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudflareRuntimeProvisionOutput::Ok { worker, script_name, endpoint } => {
                assert!(worker.contains("comment"));
                assert!(script_name.contains("comment"));
                assert!(endpoint.contains("workers.dev"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_script_too_large() {
        let storage = InMemoryStorage::new();
        let handler = CloudflareRuntimeHandlerImpl;

        // Provision first
        handler.provision(
            CloudflareRuntimeProvisionInput {
                concept: "Test".to_string(),
                account_id: "abc".to_string(),
                routes: vec![],
            },
            &storage,
        ).await.unwrap();

        let large_script = "x".repeat(1_048_577);
        let result = handler.deploy(
            CloudflareRuntimeDeployInput {
                worker: "cf-worker-test".to_string(),
                script_content: large_script,
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudflareRuntimeDeployOutput::ScriptTooLarge { size_bytes, limit_bytes, .. } => {
                assert!(size_bytes > limit_bytes);
            },
            _ => panic!("Expected ScriptTooLarge variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_success() {
        let storage = InMemoryStorage::new();
        let handler = CloudflareRuntimeHandlerImpl;

        handler.provision(
            CloudflareRuntimeProvisionInput {
                concept: "Test".to_string(),
                account_id: "abc".to_string(),
                routes: vec![],
            },
            &storage,
        ).await.unwrap();

        let result = handler.deploy(
            CloudflareRuntimeDeployInput {
                worker: "cf-worker-test".to_string(),
                script_content: "console.log('hello');".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudflareRuntimeDeployOutput::Ok { version, .. } => {
                assert_eq!(version, "1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_destroy_success() {
        let storage = InMemoryStorage::new();
        let handler = CloudflareRuntimeHandlerImpl;
        let result = handler.destroy(
            CloudflareRuntimeDestroyInput {
                worker: "cf-worker-test".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudflareRuntimeDestroyOutput::Ok { worker } => {
                assert_eq!(worker, "cf-worker-test");
            },
        }
    }

    #[tokio::test]
    async fn test_rollback() {
        let storage = InMemoryStorage::new();
        let handler = CloudflareRuntimeHandlerImpl;
        let result = handler.rollback(
            CloudflareRuntimeRollbackInput {
                worker: "cf-worker-test".to_string(),
                target_version: "2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudflareRuntimeRollbackOutput::Ok { restored_version, .. } => {
                assert_eq!(restored_version, "2");
            },
        }
    }
}
