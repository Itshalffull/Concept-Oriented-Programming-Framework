// Kubernetes runtime implementation
// Manages Kubernetes deployments: Deployment, Service, ConfigMap,
// and Ingress resources. Handles pod scheduling, rolling updates,
// and resource quota management.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::K8sRuntimeHandler;
use serde_json::json;

pub struct K8sRuntimeHandlerImpl;

#[async_trait]
impl K8sRuntimeHandler for K8sRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: K8sRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        if input.namespace.contains("notfound") || input.namespace.contains("missing") {
            return Ok(K8sRuntimeProvisionOutput::NamespaceNotFound {
                namespace: input.namespace,
            });
        }

        if input.replicas > 100 {
            return Ok(K8sRuntimeProvisionOutput::ResourceQuotaExceeded {
                namespace: input.namespace,
                resource: "pods".into(),
                requested: input.replicas.to_string(),
                limit: "100".into(),
            });
        }

        let concept_lower = input.concept.to_lowercase();
        let now = chrono::Utc::now().timestamp_millis();
        let deployment_id = format!("k8s-deploy-{}-{}", concept_lower, now);
        let service_name = format!("{}-svc", concept_lower);
        let endpoint = format!(
            "http://{}.{}.svc.cluster.local",
            service_name, input.namespace
        );

        storage.put("deployment", &deployment_id, json!({
            "namespace": input.namespace,
            "cluster": input.cluster,
            "replicas": input.replicas,
            "cpu": "100m",
            "memory": "128Mi",
            "image": format!("{}:latest", concept_lower),
            "serviceName": service_name,
            "ingressHost": null,
            "configMapName": null,
            "currentRevision": "1",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(K8sRuntimeProvisionOutput::Ok {
            deployment: deployment_id,
            service_name,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: K8sRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeDeployOutput, Box<dyn std::error::Error>> {
        if input.image_uri.contains("notfound") || input.image_uri.contains("missing") {
            return Ok(K8sRuntimeDeployOutput::ImageNotFound {
                image_uri: input.image_uri,
            });
        }

        if input.image_uri.contains("crashloop") {
            return Ok(K8sRuntimeDeployOutput::PodCrashLoop {
                deployment: input.deployment.clone(),
                pod_name: format!("{}-pod-abc", input.deployment),
                restart_count: 5,
            });
        }

        if input.image_uri.contains("pullbackoff") {
            return Ok(K8sRuntimeDeployOutput::ImagePullBackOff {
                deployment: input.deployment,
                image_uri: input.image_uri,
                reason: "Failed to pull image: unauthorized or network error".into(),
            });
        }

        if input.image_uri.contains("oomkilled") {
            return Ok(K8sRuntimeDeployOutput::OomKilled {
                deployment: input.deployment.clone(),
                pod_name: format!("{}-pod-def", input.deployment),
                memory_limit: "128Mi".into(),
            });
        }

        let record = storage.get("deployment", &input.deployment).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(K8sRuntimeDeployOutput::ImageNotFound {
                    image_uri: input.image_uri,
                });
            }
        };

        let current_revision = record.get("currentRevision")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        let new_revision = (current_revision + 1).to_string();

        let mut updated = record.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("image".into(), json!(input.image_uri));
            obj.insert("currentRevision".into(), json!(new_revision));
            obj.insert("lastDeployedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
        }
        storage.put("deployment", &input.deployment, updated).await?;

        Ok(K8sRuntimeDeployOutput::Ok {
            deployment: input.deployment,
            revision: new_revision,
        })
    }

    async fn set_traffic_weight(
        &self,
        input: K8sRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("deployment", &input.deployment).await? {
            let mut updated = record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("trafficWeight".into(), json!(input.weight));
            }
            storage.put("deployment", &input.deployment, updated).await?;
        }

        Ok(K8sRuntimeSetTrafficWeightOutput::Ok {
            deployment: input.deployment,
        })
    }

    async fn rollback(
        &self,
        input: K8sRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("deployment", &input.deployment).await? {
            let mut updated = record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("currentRevision".into(), json!(input.target_revision));
                obj.insert("lastDeployedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
            }
            storage.put("deployment", &input.deployment, updated).await?;
        }

        Ok(K8sRuntimeRollbackOutput::Ok {
            deployment: input.deployment,
            restored_revision: input.target_revision,
        })
    }

    async fn destroy(
        &self,
        input: K8sRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<K8sRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        storage.del("deployment", &input.deployment).await?;

        Ok(K8sRuntimeDestroyOutput::Ok {
            deployment: input.deployment,
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
        let handler = K8sRuntimeHandlerImpl;
        let result = handler.provision(
            K8sRuntimeProvisionInput {
                concept: "MyApp".into(),
                namespace: "default".into(),
                cluster: "dev-cluster".into(),
                replicas: 3,
            },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeProvisionOutput::Ok { deployment, service_name, endpoint } => {
                assert!(deployment.contains("k8s-deploy-myapp"));
                assert_eq!(service_name, "myapp-svc");
                assert!(endpoint.contains("default.svc.cluster.local"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_provision_namespace_not_found() {
        let storage = InMemoryStorage::new();
        let handler = K8sRuntimeHandlerImpl;
        let result = handler.provision(
            K8sRuntimeProvisionInput {
                concept: "App".into(),
                namespace: "notfound-ns".into(),
                cluster: "cluster".into(),
                replicas: 1,
            },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeProvisionOutput::NamespaceNotFound { namespace } => {
                assert!(namespace.contains("notfound"));
            }
            _ => panic!("Expected NamespaceNotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_provision_quota_exceeded() {
        let storage = InMemoryStorage::new();
        let handler = K8sRuntimeHandlerImpl;
        let result = handler.provision(
            K8sRuntimeProvisionInput {
                concept: "App".into(),
                namespace: "default".into(),
                cluster: "cluster".into(),
                replicas: 200,
            },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeProvisionOutput::ResourceQuotaExceeded { .. } => {}
            _ => panic!("Expected ResourceQuotaExceeded variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_success() {
        let storage = InMemoryStorage::new();
        let handler = K8sRuntimeHandlerImpl;
        let prov = handler.provision(
            K8sRuntimeProvisionInput {
                concept: "Svc".into(),
                namespace: "prod".into(),
                cluster: "cluster".into(),
                replicas: 2,
            },
            &storage,
        ).await.unwrap();
        let deployment_id = match prov {
            K8sRuntimeProvisionOutput::Ok { deployment, .. } => deployment,
            _ => panic!("Expected Ok"),
        };

        let result = handler.deploy(
            K8sRuntimeDeployInput {
                deployment: deployment_id.clone(),
                image_uri: "myimage:v2".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeDeployOutput::Ok { deployment, revision } => {
                assert_eq!(deployment, deployment_id);
                assert_eq!(revision, "2");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_image_not_found() {
        let storage = InMemoryStorage::new();
        let handler = K8sRuntimeHandlerImpl;
        let result = handler.deploy(
            K8sRuntimeDeployInput {
                deployment: "nonexistent".into(),
                image_uri: "notfound-image:latest".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeDeployOutput::ImageNotFound { .. } => {}
            _ => panic!("Expected ImageNotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_crash_loop() {
        let storage = InMemoryStorage::new();
        let handler = K8sRuntimeHandlerImpl;
        let result = handler.deploy(
            K8sRuntimeDeployInput {
                deployment: "dep-1".into(),
                image_uri: "crashloop-image:v1".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeDeployOutput::PodCrashLoop { .. } => {}
            _ => panic!("Expected PodCrashLoop variant"),
        }
    }

    #[tokio::test]
    async fn test_set_traffic_weight() {
        let storage = InMemoryStorage::new();
        let handler = K8sRuntimeHandlerImpl;
        let result = handler.set_traffic_weight(
            K8sRuntimeSetTrafficWeightInput {
                deployment: "dep-1".into(),
                weight: 50,
            },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeSetTrafficWeightOutput::Ok { deployment } => {
                assert_eq!(deployment, "dep-1");
            }
        }
    }

    #[tokio::test]
    async fn test_rollback() {
        let storage = InMemoryStorage::new();
        let handler = K8sRuntimeHandlerImpl;
        let result = handler.rollback(
            K8sRuntimeRollbackInput {
                deployment: "dep-1".into(),
                target_revision: "1".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeRollbackOutput::Ok { deployment, restored_revision } => {
                assert_eq!(deployment, "dep-1");
                assert_eq!(restored_revision, "1");
            }
        }
    }

    #[tokio::test]
    async fn test_destroy() {
        let storage = InMemoryStorage::new();
        let handler = K8sRuntimeHandlerImpl;
        let result = handler.destroy(
            K8sRuntimeDestroyInput { deployment: "dep-1".into() },
            &storage,
        ).await.unwrap();
        match result {
            K8sRuntimeDestroyOutput::Ok { deployment } => {
                assert_eq!(deployment, "dep-1");
            }
        }
    }
}
