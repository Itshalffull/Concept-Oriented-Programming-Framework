// EcsRuntime Handler Implementation
//
// AWS ECS Fargate provider for the Runtime coordination concept.
// Manages ECS service provisioning, task deployments, traffic
// shifting, rollback, and teardown.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EcsRuntimeHandler;
use serde_json::json;

const RELATION: &str = "ecs";

fn generate_service_id() -> String {
    format!("svc-{}", chrono::Utc::now().timestamp_millis())
}

pub struct EcsRuntimeHandlerImpl;

#[async_trait]
impl EcsRuntimeHandler for EcsRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: EcsRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        if input.cluster.is_empty() {
            return Ok(EcsRuntimeProvisionOutput::ClusterNotFound {
                cluster: String::new(),
            });
        }

        let service_id = generate_service_id();
        let service_arn = format!(
            "arn:aws:ecs:us-east-1:123456789:service/{}/{}",
            input.cluster, input.concept
        );
        let endpoint = format!("https://{}.ecs.deploy.local", input.concept);

        storage.put(RELATION, &service_id, json!({
            "service": service_id,
            "concept": input.concept,
            "serviceArn": service_arn,
            "endpoint": endpoint,
            "cpu": input.cpu,
            "memory": input.memory,
            "cluster": input.cluster,
            "currentTaskDef": "",
            "trafficWeight": 100,
            "desiredCount": 1,
            "runningCount": 0,
            "status": "provisioned",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(EcsRuntimeProvisionOutput::Ok {
            service: service_id,
            service_arn,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: EcsRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeDeployOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.service).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(EcsRuntimeDeployOutput::ImageNotFound {
                image_uri: input.image_uri,
            }),
        };

        let task_definition = format!("td-{}", chrono::Utc::now().timestamp_millis());
        let desired_count = record.get("desiredCount").and_then(|v| v.as_i64()).unwrap_or(1);

        let mut updated = record.clone();
        updated["currentTaskDef"] = json!(task_definition);
        updated["imageUri"] = json!(input.image_uri);
        updated["status"] = json!("deployed");
        updated["runningCount"] = json!(desired_count);
        updated["deployedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put(RELATION, &input.service, updated).await?;

        Ok(EcsRuntimeDeployOutput::Ok {
            service: input.service,
            task_definition,
        })
    }

    async fn set_traffic_weight(
        &self,
        input: EcsRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.service).await?;
        if let Some(mut r) = record {
            r["trafficWeight"] = json!(input.weight);
            storage.put(RELATION, &input.service, r).await?;
        }

        Ok(EcsRuntimeSetTrafficWeightOutput::Ok {
            service: input.service,
        })
    }

    async fn rollback(
        &self,
        input: EcsRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.service).await?;
        if let Some(mut r) = record {
            r["currentTaskDef"] = json!(input.target_task_definition);
            r["status"] = json!("rolledback");
            storage.put(RELATION, &input.service, r).await?;
        }

        Ok(EcsRuntimeRollbackOutput::Ok {
            service: input.service,
        })
    }

    async fn destroy(
        &self,
        input: EcsRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.service).await?;
        if record.is_none() {
            return Ok(EcsRuntimeDestroyOutput::Ok {
                service: input.service,
            });
        }

        storage.del(RELATION, &input.service).await?;
        Ok(EcsRuntimeDestroyOutput::Ok {
            service: input.service,
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
        let handler = EcsRuntimeHandlerImpl;
        let result = handler.provision(
            EcsRuntimeProvisionInput {
                concept: "echo".to_string(),
                cpu: 256,
                memory: 512,
                cluster: "my-cluster".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EcsRuntimeProvisionOutput::Ok { service, service_arn, endpoint } => {
                assert!(!service.is_empty());
                assert!(service_arn.contains("my-cluster"));
                assert!(endpoint.contains("echo"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_provision_empty_cluster() {
        let storage = InMemoryStorage::new();
        let handler = EcsRuntimeHandlerImpl;
        let result = handler.provision(
            EcsRuntimeProvisionInput {
                concept: "echo".to_string(),
                cpu: 256,
                memory: 512,
                cluster: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EcsRuntimeProvisionOutput::ClusterNotFound { .. } => {},
            _ => panic!("Expected ClusterNotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_service_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EcsRuntimeHandlerImpl;
        let result = handler.deploy(
            EcsRuntimeDeployInput {
                service: "missing".to_string(),
                image_uri: "image:latest".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EcsRuntimeDeployOutput::ImageNotFound { .. } => {},
            _ => panic!("Expected ImageNotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_destroy_nonexistent() {
        let storage = InMemoryStorage::new();
        let handler = EcsRuntimeHandlerImpl;
        let result = handler.destroy(
            EcsRuntimeDestroyInput {
                service: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EcsRuntimeDestroyOutput::Ok { service } => {
                assert_eq!(service, "missing");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
