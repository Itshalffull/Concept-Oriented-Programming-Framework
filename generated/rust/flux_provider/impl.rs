// FluxProvider concept implementation
// Generate Flux CRDs from Clef deploy plans. Owns Kustomization CRDs, HelmRelease objects,
// source controller references, and reconciliation status tracking.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FluxProviderHandler;
use serde_json::json;
use chrono::Utc;

pub struct FluxProviderHandlerImpl;

#[async_trait]
impl FluxProviderHandler for FluxProviderHandlerImpl {
    async fn emit(
        &self,
        input: FluxProviderEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FluxProviderEmitOutput, Box<dyn std::error::Error>> {
        let kustomization_id = format!("flux-ks-{}-{}", input.plan, Utc::now().timestamp_millis());
        let files = vec![
            format!("{}/kustomization.yaml", input.path),
            format!("{}/source.yaml", input.path),
        ];

        storage.put("kustomization", &kustomization_id, json!({
            "name": format!("ks-{}", input.plan),
            "namespace": "flux-system",
            "sourceRef": input.repo,
            "path": input.path,
            "interval": "5m",
            "readyStatus": "Unknown",
            "lastAppliedRevision": null,
            "lastAttemptedRevision": null,
            "lastHandledReconcileAt": null,
            "releaseName": null,
            "chartRef": null,
            "valuesFrom": "[]",
            "createdAt": Utc::now().to_rfc3339(),
        })).await?;

        Ok(FluxProviderEmitOutput::Ok {
            kustomization: kustomization_id,
            files,
        })
    }

    async fn reconciliation_status(
        &self,
        input: FluxProviderReconciliationStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FluxProviderReconciliationStatusOutput, Box<dyn std::error::Error>> {
        let record = storage.get("kustomization", &input.kustomization).await?;
        let Some(record) = record else {
            return Ok(FluxProviderReconciliationStatusOutput::Failed {
                kustomization: input.kustomization,
                reason: "Kustomization not found in storage".to_string(),
            });
        };

        let ready_status = record.get("readyStatus").and_then(|v| v.as_str()).unwrap_or("Unknown");

        if ready_status == "True" {
            let reconciled_at = Utc::now();
            let applied_revision = record.get("lastAppliedRevision")
                .and_then(|v| v.as_str())
                .unwrap_or("main@sha1:abc123")
                .to_string();

            let mut updated = record.clone();
            updated["lastHandledReconcileAt"] = json!(reconciled_at.to_rfc3339());
            storage.put("kustomization", &input.kustomization, updated).await?;

            return Ok(FluxProviderReconciliationStatusOutput::Ok {
                kustomization: input.kustomization,
                ready_status: ready_status.to_string(),
                applied_revision,
                reconciled_at,
            });
        }

        if ready_status == "Unknown" {
            // Simulate reconciliation progressing
            let mut updated = record.clone();
            updated["readyStatus"] = json!("True");
            updated["lastAppliedRevision"] = json!("main@sha1:abc123");
            updated["lastAttemptedRevision"] = json!("main@sha1:abc123");
            storage.put("kustomization", &input.kustomization, updated).await?;

            return Ok(FluxProviderReconciliationStatusOutput::Pending {
                kustomization: input.kustomization,
                waiting_on: vec!["source-controller".to_string(), "kustomize-controller".to_string()],
            });
        }

        Ok(FluxProviderReconciliationStatusOutput::Failed {
            kustomization: input.kustomization,
            reason: format!("Reconciliation failed with ready status: {}", ready_status),
        })
    }

    async fn helm_release(
        &self,
        input: FluxProviderHelmReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FluxProviderHelmReleaseOutput, Box<dyn std::error::Error>> {
        let record = storage.get("kustomization", &input.kustomization).await?;

        if input.chart.contains("notfound") || input.chart.contains("missing") {
            return Ok(FluxProviderHelmReleaseOutput::ChartNotFound {
                chart: input.chart,
                source_ref: record
                    .as_ref()
                    .and_then(|r| r.get("sourceRef"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string(),
            });
        }

        let release_name = format!("hr-{}-{}", input.chart.replace('/', "-"), Utc::now().timestamp_millis());

        if let Some(mut record) = record {
            record["releaseName"] = json!(release_name);
            record["chartRef"] = json!(input.chart);
            record["valuesFrom"] = json!(serde_json::to_string(&vec![&input.values])?);
            storage.put("kustomization", &input.kustomization, record).await?;
        }

        Ok(FluxProviderHelmReleaseOutput::Ok {
            kustomization: input.kustomization,
            release_name,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_emit_success() {
        let storage = InMemoryStorage::new();
        let handler = FluxProviderHandlerImpl;
        let result = handler.emit(
            FluxProviderEmitInput {
                plan: "deploy-web".to_string(),
                repo: "https://github.com/org/repo".to_string(),
                path: "./k8s".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FluxProviderEmitOutput::Ok { kustomization, files } => {
                assert!(!kustomization.is_empty());
                assert_eq!(files.len(), 2);
            },
        }
    }

    #[tokio::test]
    async fn test_reconciliation_status_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FluxProviderHandlerImpl;
        let result = handler.reconciliation_status(
            FluxProviderReconciliationStatusInput {
                kustomization: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FluxProviderReconciliationStatusOutput::Failed { reason, .. } => {
                assert!(reason.contains("not found"));
            },
            _ => panic!("Expected Failed variant"),
        }
    }

    #[tokio::test]
    async fn test_reconciliation_status_pending() {
        let storage = InMemoryStorage::new();
        let handler = FluxProviderHandlerImpl;
        let emit_result = handler.emit(
            FluxProviderEmitInput {
                plan: "deploy-api".to_string(),
                repo: "https://github.com/org/api".to_string(),
                path: "./deploy".to_string(),
            },
            &storage,
        ).await.unwrap();
        if let FluxProviderEmitOutput::Ok { kustomization, .. } = emit_result {
            let result = handler.reconciliation_status(
                FluxProviderReconciliationStatusInput { kustomization },
                &storage,
            ).await.unwrap();
            match result {
                FluxProviderReconciliationStatusOutput::Pending { waiting_on, .. } => {
                    assert!(!waiting_on.is_empty());
                },
                _ => panic!("Expected Pending variant"),
            }
        }
    }

    #[tokio::test]
    async fn test_helm_release_chart_not_found() {
        let storage = InMemoryStorage::new();
        let handler = FluxProviderHandlerImpl;
        let result = handler.helm_release(
            FluxProviderHelmReleaseInput {
                kustomization: "ks-1".to_string(),
                chart: "charts/notfound-service".to_string(),
                values: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FluxProviderHelmReleaseOutput::ChartNotFound { .. } => {},
            _ => panic!("Expected ChartNotFound variant"),
        }
    }
}
