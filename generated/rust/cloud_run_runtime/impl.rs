// Cloud Run Runtime -- manage Google Cloud Run service lifecycle
// Provisions, deploys, manages traffic weights, rollback, and destruction of Cloud Run services.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::CloudRunRuntimeHandler;
use serde_json::json;

pub struct CloudRunRuntimeHandlerImpl;

const VALID_REGIONS: &[&str] = &[
    "us-central1", "us-east1", "us-west1", "europe-west1",
    "europe-west2", "asia-east1", "asia-northeast1",
];

#[async_trait]
impl CloudRunRuntimeHandler for CloudRunRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: CloudRunRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        if !VALID_REGIONS.contains(&input.region.as_str()) {
            return Ok(CloudRunRuntimeProvisionOutput::RegionUnavailable {
                region: input.region,
            });
        }

        let service_name = format!("{}-svc", input.concept.to_lowercase());
        let service_url = format!(
            "https://{}-{}.a.run.app",
            service_name, input.region
        );
        let endpoint = format!("{}/api", service_url);

        storage.put("service", &service_name, json!({
            "service": service_name,
            "projectId": input.project_id,
            "region": input.region,
            "cpu": input.cpu,
            "memory": input.memory,
            "serviceUrl": service_url,
            "currentRevision": "0",
            "status": "provisioned",
        })).await?;

        Ok(CloudRunRuntimeProvisionOutput::Ok {
            service: service_name,
            service_url,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: CloudRunRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeDeployOutput, Box<dyn std::error::Error>> {
        let record = storage.get("service", &input.service).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(CloudRunRuntimeDeployOutput::ImageNotFound {
                    image_uri: input.image_uri,
                });
            }
        };

        let current_rev = record["currentRevision"]
            .as_str()
            .unwrap_or("0")
            .parse::<i64>()
            .unwrap_or(0);
        let new_revision = format!("{}-rev-{}", input.service, current_rev + 1);

        let mut updated = record.clone();
        updated["currentRevision"] = json!((current_rev + 1).to_string());
        updated["imageUri"] = json!(input.image_uri);
        updated["status"] = json!("deployed");
        storage.put("service", &input.service, updated).await?;

        Ok(CloudRunRuntimeDeployOutput::Ok {
            service: input.service,
            revision: new_revision,
        })
    }

    async fn set_traffic_weight(
        &self,
        input: CloudRunRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("service", &input.service).await? {
            let mut updated = record.clone();
            updated["trafficWeight"] = json!(input.weight);
            storage.put("service", &input.service, updated).await?;
        }

        Ok(CloudRunRuntimeSetTrafficWeightOutput::Ok {
            service: input.service,
        })
    }

    async fn rollback(
        &self,
        input: CloudRunRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("service", &input.service).await? {
            let mut updated = record.clone();
            // Extract revision number from target_revision string
            let rev_num = input.target_revision
                .rsplit('-')
                .next()
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0);
            updated["currentRevision"] = json!(rev_num.to_string());
            updated["status"] = json!("rolled_back");
            storage.put("service", &input.service, updated).await?;
        }

        Ok(CloudRunRuntimeRollbackOutput::Ok {
            service: input.service,
            restored_revision: input.target_revision,
        })
    }

    async fn destroy(
        &self,
        input: CloudRunRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CloudRunRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        storage.del("service", &input.service).await?;

        Ok(CloudRunRuntimeDestroyOutput::Ok {
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
        let handler = CloudRunRuntimeHandlerImpl;
        let result = handler.provision(
            CloudRunRuntimeProvisionInput {
                concept: "Comment".to_string(),
                project_id: "my-project".to_string(),
                region: "us-central1".to_string(),
                cpu: 1,
                memory: 256,
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudRunRuntimeProvisionOutput::Ok { service, service_url, endpoint } => {
                assert!(service.contains("comment"));
                assert!(service_url.contains("run.app"));
                assert!(endpoint.contains("/api"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_provision_region_unavailable() {
        let storage = InMemoryStorage::new();
        let handler = CloudRunRuntimeHandlerImpl;
        let result = handler.provision(
            CloudRunRuntimeProvisionInput {
                concept: "Comment".to_string(),
                project_id: "my-project".to_string(),
                region: "invalid-region".to_string(),
                cpu: 1,
                memory: 256,
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudRunRuntimeProvisionOutput::RegionUnavailable { region } => {
                assert_eq!(region, "invalid-region");
            },
            _ => panic!("Expected RegionUnavailable variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_service_not_found() {
        let storage = InMemoryStorage::new();
        let handler = CloudRunRuntimeHandlerImpl;
        let result = handler.deploy(
            CloudRunRuntimeDeployInput {
                service: "nonexistent".to_string(),
                image_uri: "gcr.io/test/image:latest".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudRunRuntimeDeployOutput::ImageNotFound { .. } => {},
            _ => panic!("Expected ImageNotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_destroy_success() {
        let storage = InMemoryStorage::new();
        let handler = CloudRunRuntimeHandlerImpl;
        let result = handler.destroy(
            CloudRunRuntimeDestroyInput {
                service: "test-svc".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudRunRuntimeDestroyOutput::Ok { service } => {
                assert_eq!(service, "test-svc");
            },
        }
    }

    #[tokio::test]
    async fn test_set_traffic_weight() {
        let storage = InMemoryStorage::new();
        let handler = CloudRunRuntimeHandlerImpl;
        let result = handler.set_traffic_weight(
            CloudRunRuntimeSetTrafficWeightInput {
                service: "test-svc".to_string(),
                weight: 50,
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudRunRuntimeSetTrafficWeightOutput::Ok { service } => {
                assert_eq!(service, "test-svc");
            },
        }
    }

    #[tokio::test]
    async fn test_rollback() {
        let storage = InMemoryStorage::new();
        let handler = CloudRunRuntimeHandlerImpl;
        let result = handler.rollback(
            CloudRunRuntimeRollbackInput {
                service: "test-svc".to_string(),
                target_revision: "test-svc-rev-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            CloudRunRuntimeRollbackOutput::Ok { service, restored_revision } => {
                assert_eq!(service, "test-svc");
                assert_eq!(restored_revision, "test-svc-rev-1");
            },
        }
    }
}
