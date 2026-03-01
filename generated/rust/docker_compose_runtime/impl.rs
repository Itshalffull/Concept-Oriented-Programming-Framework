// DockerComposeRuntime Handler Implementation
//
// Docker Compose provider for the Runtime coordination concept.
// Manages service provisioning, container deployment, traffic
// shifting, rollback, and teardown.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DockerComposeRuntimeHandler;
use serde_json::json;

const RELATION: &str = "dockercompose";

fn generate_service_id() -> String {
    format!("dc-{}", chrono::Utc::now().timestamp_millis())
}

fn generate_container_id() -> String {
    format!("ctr-{}", chrono::Utc::now().timestamp_millis())
}

pub struct DockerComposeRuntimeHandlerImpl;

#[async_trait]
impl DockerComposeRuntimeHandler for DockerComposeRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: DockerComposeRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        let service_id = generate_service_id();
        let service_name = format!("{}-service", input.concept);
        let first_port = input.ports.first()
            .and_then(|p| p.split(':').next())
            .unwrap_or("8080");
        let endpoint = format!("http://localhost:{}", first_port);

        storage.put(RELATION, &service_id, json!({
            "service": service_id,
            "concept": input.concept,
            "composePath": input.compose_path,
            "serviceName": service_name,
            "ports": serde_json::to_string(&input.ports)?,
            "endpoint": endpoint,
            "containerId": "",
            "status": "provisioned",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(DockerComposeRuntimeProvisionOutput::Ok {
            service: service_id,
            service_name,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: DockerComposeRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeDeployOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.service).await?;
        if record.is_none() {
            return Ok(DockerComposeRuntimeDeployOutput::Ok {
                service: input.service,
                container_id: String::new(),
            });
        }

        let container_id = generate_container_id();
        let mut updated = record.unwrap();
        updated["containerId"] = json!(container_id);
        updated["imageUri"] = json!(input.image_uri);
        updated["status"] = json!("deployed");
        updated["deployedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put(RELATION, &input.service, updated).await?;

        Ok(DockerComposeRuntimeDeployOutput::Ok {
            service: input.service,
            container_id,
        })
    }

    async fn set_traffic_weight(
        &self,
        input: DockerComposeRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.service).await?;
        if let Some(mut r) = record {
            r["trafficWeight"] = json!(input.weight);
            storage.put(RELATION, &input.service, r).await?;
        }

        Ok(DockerComposeRuntimeSetTrafficWeightOutput::Ok {
            service: input.service,
        })
    }

    async fn rollback(
        &self,
        input: DockerComposeRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.service).await?;
        if let Some(mut r) = record {
            r["imageUri"] = json!(input.target_image);
            r["status"] = json!("rolledback");
            storage.put(RELATION, &input.service, r).await?;
        }

        Ok(DockerComposeRuntimeRollbackOutput::Ok {
            service: input.service,
            restored_image: input.target_image,
        })
    }

    async fn destroy(
        &self,
        input: DockerComposeRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.service).await?;
        if record.is_none() {
            return Ok(DockerComposeRuntimeDestroyOutput::Ok {
                service: input.service,
            });
        }

        storage.del(RELATION, &input.service).await?;
        Ok(DockerComposeRuntimeDestroyOutput::Ok {
            service: input.service,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_provision() {
        let storage = InMemoryStorage::new();
        let handler = DockerComposeRuntimeHandlerImpl;
        let result = handler.provision(
            DockerComposeRuntimeProvisionInput {
                concept: "echo".to_string(),
                compose_path: "./docker-compose.yml".to_string(),
                ports: vec!["8080:8080".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            DockerComposeRuntimeProvisionOutput::Ok { service, service_name, endpoint } => {
                assert!(!service.is_empty());
                assert!(service_name.contains("echo"));
                assert!(endpoint.contains("8080"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_not_provisioned() {
        let storage = InMemoryStorage::new();
        let handler = DockerComposeRuntimeHandlerImpl;
        let result = handler.deploy(
            DockerComposeRuntimeDeployInput {
                service: "missing".to_string(),
                image_uri: "image:latest".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DockerComposeRuntimeDeployOutput::Ok { container_id, .. } => {
                assert!(container_id.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_destroy_nonexistent() {
        let storage = InMemoryStorage::new();
        let handler = DockerComposeRuntimeHandlerImpl;
        let result = handler.destroy(
            DockerComposeRuntimeDestroyInput {
                service: "missing".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DockerComposeRuntimeDestroyOutput::Ok { service } => {
                assert_eq!(service, "missing");
            },
        }
    }
}
