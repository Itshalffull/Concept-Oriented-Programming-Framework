// ArgoCDProvider concept implementation
// Generate ArgoCD Application CRDs from Clef deploy plans. Owns Application
// resources, sync wave ordering, health assessments, and auto-sync configuration.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ArgoCDProviderHandler;
use serde_json::json;

pub struct ArgoCDProviderHandlerImpl;

#[async_trait]
impl ArgoCDProviderHandler for ArgoCDProviderHandlerImpl {
    async fn emit(
        &self,
        input: ArgoCDProviderEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArgoCDProviderEmitOutput, Box<dyn std::error::Error>> {
        let now = chrono::Utc::now();
        let application_id = format!("argocd-app-{}-{}", input.plan, now.timestamp_millis());
        let app_name = format!("app-{}", input.plan);
        let files = vec![
            format!("{}/application.yaml", input.path),
            format!("{}/kustomization.yaml", input.path),
        ];

        storage.put("application", &application_id, json!({
            "appName": app_name,
            "project": "default",
            "repoUrl": input.repo,
            "targetRevision": "HEAD",
            "path": input.path,
            "namespace": "default",
            "syncStatus": "OutOfSync",
            "healthStatus": "Missing",
            "syncWave": null,
            "lastSyncedAt": null,
            "createdAt": now.to_rfc3339(),
        })).await?;

        Ok(ArgoCDProviderEmitOutput::Ok {
            application: application_id,
            files,
        })
    }

    async fn reconciliation_status(
        &self,
        input: ArgoCDProviderReconciliationStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArgoCDProviderReconciliationStatusOutput, Box<dyn std::error::Error>> {
        let record = storage.get("application", &input.application).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(ArgoCDProviderReconciliationStatusOutput::Failed {
                application: input.application,
                reason: "Application not found in storage".to_string(),
            }),
        };

        let sync_status = record["syncStatus"].as_str().unwrap_or("Unknown").to_string();
        let health_status = record["healthStatus"].as_str().unwrap_or("Unknown").to_string();

        if sync_status == "Synced" && health_status == "Healthy" {
            let reconciled_at = chrono::Utc::now().to_rfc3339();
            let mut updated = record.clone();
            updated["lastSyncedAt"] = json!(reconciled_at);
            storage.put("application", &input.application, updated).await?;

            return Ok(ArgoCDProviderReconciliationStatusOutput::Ok {
                application: input.application,
                sync_status,
                health_status,
                reconciled_at,
            });
        }

        if sync_status == "OutOfSync" || sync_status == "Unknown" {
            // Simulate sync progressing
            let mut updated = record.clone();
            updated["syncStatus"] = json!("Synced");
            updated["healthStatus"] = json!("Healthy");
            storage.put("application", &input.application, updated).await?;

            return Ok(ArgoCDProviderReconciliationStatusOutput::Pending {
                application: input.application,
                waiting_on: vec!["deployment".to_string(), "service".to_string()],
            });
        }

        if health_status == "Degraded" {
            return Ok(ArgoCDProviderReconciliationStatusOutput::Degraded {
                application: input.application,
                unhealthy_resources: vec!["pod/app-0".to_string(), "pod/app-1".to_string()],
            });
        }

        Ok(ArgoCDProviderReconciliationStatusOutput::Failed {
            application: input.application,
            reason: format!("Sync failed with status: {}", sync_status),
        })
    }

    async fn sync_wave(
        &self,
        input: ArgoCDProviderSyncWaveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArgoCDProviderSyncWaveOutput, Box<dyn std::error::Error>> {
        let record = storage.get("application", &input.application).await?;
        if let Some(mut r) = record {
            r["syncWave"] = json!(input.wave);
            storage.put("application", &input.application, r).await?;
        }

        Ok(ArgoCDProviderSyncWaveOutput::Ok {
            application: input.application,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_emit_creates_application() {
        let storage = InMemoryStorage::new();
        let handler = ArgoCDProviderHandlerImpl;
        let result = handler.emit(
            ArgoCDProviderEmitInput {
                plan: "deploy-plan-1".to_string(),
                repo: "https://github.com/org/repo".to_string(),
                path: "k8s/prod".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ArgoCDProviderEmitOutput::Ok { application, files } => {
                assert!(application.starts_with("argocd-app-"));
                assert_eq!(files.len(), 2);
                assert!(files[0].contains("application.yaml"));
            }
        }
    }

    #[tokio::test]
    async fn test_reconciliation_status_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ArgoCDProviderHandlerImpl;
        let result = handler.reconciliation_status(
            ArgoCDProviderReconciliationStatusInput {
                application: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ArgoCDProviderReconciliationStatusOutput::Failed { reason, .. } => {
                assert!(reason.contains("not found"));
            }
            _ => panic!("Expected Failed variant"),
        }
    }

    #[tokio::test]
    async fn test_reconciliation_status_pending_then_ok() {
        let storage = InMemoryStorage::new();
        let handler = ArgoCDProviderHandlerImpl;
        let emit_result = handler.emit(
            ArgoCDProviderEmitInput {
                plan: "plan-2".to_string(),
                repo: "https://github.com/org/repo".to_string(),
                path: "k8s/staging".to_string(),
            },
            &storage,
        ).await.unwrap();
        let app_id = match emit_result {
            ArgoCDProviderEmitOutput::Ok { application, .. } => application,
        };
        // First call triggers sync (OutOfSync -> Synced)
        let result = handler.reconciliation_status(
            ArgoCDProviderReconciliationStatusInput { application: app_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ArgoCDProviderReconciliationStatusOutput::Pending { .. } => {}
            _ => panic!("Expected Pending variant"),
        }
        // Second call should find Synced+Healthy -> Ok
        let result2 = handler.reconciliation_status(
            ArgoCDProviderReconciliationStatusInput { application: app_id },
            &storage,
        ).await.unwrap();
        match result2 {
            ArgoCDProviderReconciliationStatusOutput::Ok { sync_status, health_status, .. } => {
                assert_eq!(sync_status, "Synced");
                assert_eq!(health_status, "Healthy");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_sync_wave_sets_wave() {
        let storage = InMemoryStorage::new();
        let handler = ArgoCDProviderHandlerImpl;
        let emit_result = handler.emit(
            ArgoCDProviderEmitInput {
                plan: "plan-3".to_string(),
                repo: "https://github.com/org/repo".to_string(),
                path: "k8s/dev".to_string(),
            },
            &storage,
        ).await.unwrap();
        let app_id = match emit_result {
            ArgoCDProviderEmitOutput::Ok { application, .. } => application,
        };
        let result = handler.sync_wave(
            ArgoCDProviderSyncWaveInput {
                application: app_id.clone(),
                wave: 3,
            },
            &storage,
        ).await.unwrap();
        match result {
            ArgoCDProviderSyncWaveOutput::Ok { application } => {
                assert_eq!(application, app_id);
            }
        }
    }
}
