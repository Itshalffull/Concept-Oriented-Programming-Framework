// GitOps concept implementation
// Emit GitOps manifests for supported controllers (ArgoCD, Flux) and track reconciliation status.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GitOpsHandler;
use serde_json::json;
use chrono::Utc;

pub struct GitOpsHandlerImpl;

fn emit_argocd_manifest(plan: &str, repo: &str, path: &str) -> (String, Vec<String>) {
    let app_name = plan.replace('/', "-").replace(' ', "-").to_lowercase();
    let manifest = format!(
        r#"apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: {app_name}
  namespace: argocd
spec:
  project: default
  source:
    repoURL: {repo}
    path: {path}
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true"#
    );

    let files = vec![format!("{}/application.yaml", path)];
    (manifest, files)
}

fn emit_flux_manifest(plan: &str, repo: &str, path: &str) -> (String, Vec<String>) {
    let source_name = plan.replace('/', "-").replace(' ', "-").to_lowercase();
    let manifest = format!(
        r#"apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: {source_name}
  namespace: flux-system
spec:
  interval: 1m
  url: {repo}
  ref:
    branch: main
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: {source_name}
  namespace: flux-system
spec:
  interval: 10m
  path: {path}
  sourceRef:
    kind: GitRepository
    name: {source_name}
  prune: true"#
    );

    let files = vec![
        format!("{}/git-repository.yaml", path),
        format!("{}/kustomization.yaml", path),
    ];
    (manifest, files)
}

#[async_trait]
impl GitOpsHandler for GitOpsHandlerImpl {
    async fn emit(
        &self,
        input: GitOpsEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GitOpsEmitOutput, Box<dyn std::error::Error>> {
        let controller_lower = input.controller.to_lowercase();

        let (manifest, files) = match controller_lower.as_str() {
            "argocd" | "argo" => emit_argocd_manifest(&input.plan, &input.repo, &input.path),
            "flux" | "fluxcd" => emit_flux_manifest(&input.plan, &input.repo, &input.path),
            _ => {
                return Ok(GitOpsEmitOutput::ControllerUnsupported {
                    controller: input.controller,
                });
            }
        };

        let manifest_id = format!("{}-{}", input.plan, controller_lower);
        storage.put("manifest", &manifest_id, json!({
            "manifest": manifest_id,
            "controller": input.controller,
            "repo": input.repo,
            "path": input.path,
            "content": manifest,
            "files": serde_json::to_string(&files)?,
            "status": "emitted",
            "emittedAt": Utc::now().to_rfc3339(),
        })).await?;

        Ok(GitOpsEmitOutput::Ok {
            manifest: manifest_id,
            files,
        })
    }

    async fn reconciliation_status(
        &self,
        input: GitOpsReconciliationStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GitOpsReconciliationStatusOutput, Box<dyn std::error::Error>> {
        let record = storage.get("manifest", &input.manifest).await?;

        let Some(manifest_record) = record else {
            return Ok(GitOpsReconciliationStatusOutput::Failed {
                manifest: input.manifest,
                reason: "Manifest not found".to_string(),
            });
        };

        let status = manifest_record.get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        match status {
            "reconciled" | "synced" => {
                Ok(GitOpsReconciliationStatusOutput::Ok {
                    manifest: input.manifest,
                    status: "reconciled".to_string(),
                    reconciled_at: Utc::now(),
                })
            }
            "pending" | "emitted" => {
                let waiting_on = manifest_record.get("waitingOn")
                    .and_then(|v| v.as_str())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .unwrap_or_else(|| vec!["initial-sync".to_string()]);

                Ok(GitOpsReconciliationStatusOutput::Pending {
                    manifest: input.manifest,
                    waiting_on,
                })
            }
            "failed" | "error" => {
                let reason = manifest_record.get("failureReason")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown reconciliation failure")
                    .to_string();

                Ok(GitOpsReconciliationStatusOutput::Failed {
                    manifest: input.manifest,
                    reason,
                })
            }
            _ => {
                Ok(GitOpsReconciliationStatusOutput::Pending {
                    manifest: input.manifest,
                    waiting_on: vec![format!("unknown-status:{}", status)],
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_emit_argocd() {
        let storage = InMemoryStorage::new();
        let handler = GitOpsHandlerImpl;
        let result = handler.emit(
            GitOpsEmitInput {
                plan: "web-app".to_string(),
                controller: "argocd".to_string(),
                repo: "https://github.com/org/repo".to_string(),
                path: "./k8s".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GitOpsEmitOutput::Ok { manifest, files } => {
                assert!(!manifest.is_empty());
                assert!(files.iter().any(|f| f.contains("application.yaml")));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_emit_flux() {
        let storage = InMemoryStorage::new();
        let handler = GitOpsHandlerImpl;
        let result = handler.emit(
            GitOpsEmitInput {
                plan: "api-service".to_string(),
                controller: "flux".to_string(),
                repo: "https://github.com/org/api".to_string(),
                path: "./deploy".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GitOpsEmitOutput::Ok { files, .. } => {
                assert!(files.iter().any(|f| f.contains("kustomization.yaml")));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_emit_unsupported_controller() {
        let storage = InMemoryStorage::new();
        let handler = GitOpsHandlerImpl;
        let result = handler.emit(
            GitOpsEmitInput {
                plan: "plan".to_string(),
                controller: "jenkins".to_string(),
                repo: "repo".to_string(),
                path: "./path".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GitOpsEmitOutput::ControllerUnsupported { controller } => {
                assert_eq!(controller, "jenkins");
            },
            _ => panic!("Expected ControllerUnsupported variant"),
        }
    }

    #[tokio::test]
    async fn test_reconciliation_status_not_found() {
        let storage = InMemoryStorage::new();
        let handler = GitOpsHandlerImpl;
        let result = handler.reconciliation_status(
            GitOpsReconciliationStatusInput { manifest: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GitOpsReconciliationStatusOutput::Failed { reason, .. } => {
                assert!(reason.contains("not found"));
            },
            _ => panic!("Expected Failed variant"),
        }
    }

    #[tokio::test]
    async fn test_reconciliation_status_pending_after_emit() {
        let storage = InMemoryStorage::new();
        let handler = GitOpsHandlerImpl;
        let emit_result = handler.emit(
            GitOpsEmitInput {
                plan: "deploy".to_string(),
                controller: "argocd".to_string(),
                repo: "repo".to_string(),
                path: "./k8s".to_string(),
            },
            &storage,
        ).await.unwrap();
        if let GitOpsEmitOutput::Ok { manifest, .. } = emit_result {
            let result = handler.reconciliation_status(
                GitOpsReconciliationStatusInput { manifest },
                &storage,
            ).await.unwrap();
            match result {
                GitOpsReconciliationStatusOutput::Pending { waiting_on, .. } => {
                    assert!(!waiting_on.is_empty());
                },
                _ => panic!("Expected Pending variant"),
            }
        }
    }
}
