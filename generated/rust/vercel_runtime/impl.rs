// VercelRuntime handler implementation
// Manage Vercel project deployments: provisioning, deployment, traffic splitting,
// rollback, and teardown.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::VercelRuntimeHandler;
use serde_json::json;

pub struct VercelRuntimeHandlerImpl;

#[async_trait]
impl VercelRuntimeHandler for VercelRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: VercelRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        let concept = &input.concept;
        let team_id = &input.team_id;
        let framework = &input.framework;

        // Check for domain conflicts
        let existing_projects = storage.find("project", None).await?;
        let target_domain = format!("{}.vercel.app", concept.to_lowercase());
        for existing in &existing_projects {
            if let Some(url) = existing.get("productionUrl").and_then(|v| v.as_str()) {
                if url.contains(&target_domain) {
                    return Ok(VercelRuntimeProvisionOutput::DomainConflict {
                        domain: target_domain,
                        existing_project: existing.get("projectId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    });
                }
            }
        }

        let project_id = format!("prj-{}-{}", concept.to_lowercase(), 1000000);
        let endpoint = format!("https://{}.vercel.app", concept.to_lowercase());

        storage.put("project", &project_id, json!({
            "projectId": &project_id,
            "teamId": team_id,
            "framework": framework,
            "regions": "[\"iad1\",\"sfo1\",\"cdg1\"]",
            "deploymentUrl": null,
            "currentDeploymentId": null,
            "previousDeploymentId": null,
            "productionUrl": &endpoint,
        })).await?;

        Ok(VercelRuntimeProvisionOutput::Ok {
            project: project_id.clone(),
            project_id,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: VercelRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeDeployOutput, Box<dyn std::error::Error>> {
        let project = &input.project;
        let source_directory = &input.source_directory;

        let record = storage.get("project", project).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(VercelRuntimeDeployOutput::BuildFailed {
                project: project.clone(),
                errors: vec!["Project not found".to_string()],
            }),
        };

        if source_directory.contains("invalid") || source_directory.contains("broken") {
            return Ok(VercelRuntimeDeployOutput::BuildFailed {
                project: project.clone(),
                errors: vec!["Build failed: invalid source directory or missing build configuration".to_string()],
            });
        }

        let deployment_id = format!("dpl-{}", 1000000);
        let project_id = record.get("projectId").and_then(|v| v.as_str()).unwrap_or(project);
        let deployment_url = format!("https://{}-{}.vercel.app", project_id, deployment_id);

        let mut updated = record.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("previousDeploymentId".to_string(), record.get("currentDeploymentId").cloned().unwrap_or(json!(null)));
            obj.insert("currentDeploymentId".to_string(), json!(&deployment_id));
            obj.insert("deploymentUrl".to_string(), json!(&deployment_url));
        }
        storage.put("project", project, updated).await?;

        Ok(VercelRuntimeDeployOutput::Ok {
            project: project.clone(),
            deployment_id,
            deployment_url,
        })
    }

    async fn set_traffic_weight(
        &self,
        input: VercelRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        let project = &input.project;
        let weight = input.weight;

        let record = storage.get("project", project).await?;
        if let Some(mut rec) = record {
            if let Some(obj) = rec.as_object_mut() {
                obj.insert("trafficWeight".to_string(), json!(weight));
            }
            storage.put("project", project, rec).await?;
        }

        Ok(VercelRuntimeSetTrafficWeightOutput::Ok { project: project.clone() })
    }

    async fn rollback(
        &self,
        input: VercelRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        let project = &input.project;
        let target_deployment_id = &input.target_deployment_id;

        let record = storage.get("project", project).await?;
        if let Some(mut rec) = record {
            if let Some(obj) = rec.as_object_mut() {
                obj.insert("previousDeploymentId".to_string(), obj.get("currentDeploymentId").cloned().unwrap_or(json!(null)));
                obj.insert("currentDeploymentId".to_string(), json!(target_deployment_id));
            }
            storage.put("project", project, rec).await?;
        }

        Ok(VercelRuntimeRollbackOutput::Ok {
            project: project.clone(),
            restored_deployment_id: target_deployment_id.clone(),
        })
    }

    async fn destroy(
        &self,
        input: VercelRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VercelRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        let project = &input.project;

        storage.del("project", project).await?;

        Ok(VercelRuntimeDestroyOutput::Ok { project: project.clone() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_provision_success() {
        let storage = InMemoryStorage::new();
        let handler = VercelRuntimeHandlerImpl;
        let result = handler.provision(
            VercelRuntimeProvisionInput {
                concept: "MyApp".to_string(),
                team_id: "team-1".to_string(),
                framework: "nextjs".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VercelRuntimeProvisionOutput::Ok { project, project_id, endpoint } => {
                assert!(!project.is_empty());
                assert!(!project_id.is_empty());
                assert!(endpoint.contains("myapp"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_success() {
        let storage = InMemoryStorage::new();
        let handler = VercelRuntimeHandlerImpl;
        let prov = handler.provision(
            VercelRuntimeProvisionInput {
                concept: "MyApp".to_string(),
                team_id: "team-1".to_string(),
                framework: "nextjs".to_string(),
            },
            &storage,
        ).await.unwrap();
        let proj_id = match prov {
            VercelRuntimeProvisionOutput::Ok { project_id, .. } => project_id,
            _ => panic!("Expected Ok"),
        };
        let result = handler.deploy(
            VercelRuntimeDeployInput {
                project: proj_id.clone(),
                source_directory: "./dist".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VercelRuntimeDeployOutput::Ok { deployment_id, deployment_url, .. } => {
                assert!(!deployment_id.is_empty());
                assert!(!deployment_url.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_build_failed() {
        let storage = InMemoryStorage::new();
        let handler = VercelRuntimeHandlerImpl;
        let prov = handler.provision(
            VercelRuntimeProvisionInput {
                concept: "MyApp2".to_string(),
                team_id: "team-1".to_string(),
                framework: "nextjs".to_string(),
            },
            &storage,
        ).await.unwrap();
        let proj_id = match prov {
            VercelRuntimeProvisionOutput::Ok { project_id, .. } => project_id,
            _ => panic!("Expected Ok"),
        };
        let result = handler.deploy(
            VercelRuntimeDeployInput {
                project: proj_id,
                source_directory: "./invalid-dir".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VercelRuntimeDeployOutput::BuildFailed { errors, .. } => {
                assert!(!errors.is_empty());
            },
            _ => panic!("Expected BuildFailed variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_project_not_found() {
        let storage = InMemoryStorage::new();
        let handler = VercelRuntimeHandlerImpl;
        let result = handler.deploy(
            VercelRuntimeDeployInput {
                project: "nonexistent".to_string(),
                source_directory: "./dist".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VercelRuntimeDeployOutput::BuildFailed { .. } => {},
            _ => panic!("Expected BuildFailed variant"),
        }
    }

    #[tokio::test]
    async fn test_rollback_success() {
        let storage = InMemoryStorage::new();
        let handler = VercelRuntimeHandlerImpl;
        let prov = handler.provision(
            VercelRuntimeProvisionInput {
                concept: "MyApp3".to_string(),
                team_id: "team-1".to_string(),
                framework: "nextjs".to_string(),
            },
            &storage,
        ).await.unwrap();
        let proj_id = match prov {
            VercelRuntimeProvisionOutput::Ok { project_id, .. } => project_id,
            _ => panic!("Expected Ok"),
        };
        let result = handler.rollback(
            VercelRuntimeRollbackInput {
                project: proj_id,
                target_deployment_id: "dpl-old".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VercelRuntimeRollbackOutput::Ok { restored_deployment_id, .. } => {
                assert_eq!(restored_deployment_id, "dpl-old");
            },
        }
    }

    #[tokio::test]
    async fn test_destroy_success() {
        let storage = InMemoryStorage::new();
        let handler = VercelRuntimeHandlerImpl;
        let result = handler.destroy(
            VercelRuntimeDestroyInput {
                project: "some-project".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VercelRuntimeDestroyOutput::Ok { project } => {
                assert_eq!(project, "some-project");
            },
        }
    }
}
