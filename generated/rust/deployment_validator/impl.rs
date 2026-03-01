// DeploymentValidator Handler Implementation
//
// Parses and validates deployment manifests. Validates concept
// deployments against runtime capabilities, sync assignments,
// and upstream hierarchy.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DeploymentValidatorHandler;
use serde_json::json;

fn generate_id() -> String {
    format!("manifest-{}", chrono::Utc::now().timestamp_millis())
}

pub struct DeploymentValidatorHandlerImpl;

#[async_trait]
impl DeploymentValidatorHandler for DeploymentValidatorHandlerImpl {
    async fn parse(
        &self,
        input: DeploymentValidatorParseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeploymentValidatorParseOutput, Box<dyn std::error::Error>> {
        if input.raw.is_empty() {
            return Ok(DeploymentValidatorParseOutput::Error {
                message: "raw is required and must be a string".to_string(),
            });
        }

        let parsed: serde_json::Value = match serde_json::from_str(&input.raw) {
            Ok(v) => v,
            Err(e) => return Ok(DeploymentValidatorParseOutput::Error {
                message: format!("Parse error: {}", e),
            }),
        };

        // Validate required app fields
        let app = parsed.get("app");
        if app.is_none()
            || app.and_then(|a| a.get("name")).is_none()
            || app.and_then(|a| a.get("version")).is_none()
            || app.and_then(|a| a.get("uri")).is_none()
        {
            return Ok(DeploymentValidatorParseOutput::Error {
                message: "Deployment manifest must have app.name, app.version, and app.uri".to_string(),
            });
        }

        let manifest_id = generate_id();
        storage.put("manifests", &manifest_id, json!({ "manifestId": manifest_id })).await?;
        storage.put("plan", &manifest_id, json!({
            "manifestId": manifest_id,
            "manifest": parsed,
        })).await?;

        Ok(DeploymentValidatorParseOutput::Ok { manifest: manifest_id })
    }

    async fn validate(
        &self,
        input: DeploymentValidatorValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeploymentValidatorValidateOutput, Box<dyn std::error::Error>> {
        if input.manifest.is_empty() {
            return Ok(DeploymentValidatorValidateOutput::Error {
                issues: vec!["manifest reference is required".to_string()],
            });
        }

        let stored = storage.get("plan", &input.manifest).await?;
        if stored.is_none() {
            return Ok(DeploymentValidatorValidateOutput::Error {
                issues: vec!["manifest not found".to_string()],
            });
        }

        let stored = stored.unwrap();
        let manifest = stored.get("manifest").cloned().unwrap_or(json!({}));

        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Validate concepts against runtimes
        let runtimes = manifest.get("runtimes").and_then(|v| v.as_object());
        let manifest_concepts = manifest.get("concepts").and_then(|v| v.as_object());

        if let Some(concepts) = manifest_concepts {
            for (concept_name, deployment) in concepts {
                if let Some(impls) = deployment.get("implementations").and_then(|v| v.as_array()) {
                    for imp in impls {
                        let runtime_name = imp.get("runtime").and_then(|v| v.as_str()).unwrap_or("");
                        if let Some(rts) = runtimes {
                            if !rts.contains_key(runtime_name) {
                                errors.push(format!(
                                    "Concept \"{}\" references runtime \"{}\" which is not defined",
                                    concept_name, runtime_name
                                ));
                            }
                        }
                    }
                }
            }
        }

        // Validate syncs reference valid engine runtimes
        if let Some(syncs) = manifest.get("syncs").and_then(|v| v.as_array()) {
            for sync in syncs {
                let engine = sync.get("engine").and_then(|v| v.as_str()).unwrap_or("");
                if let Some(rts) = runtimes {
                    if let Some(rt) = rts.get(engine) {
                        if !rt.get("engine").and_then(|v| v.as_bool()).unwrap_or(false) {
                            errors.push(format!(
                                "Sync assigned to runtime \"{}\" which does not have engine: true",
                                engine
                            ));
                        }
                    } else {
                        errors.push(format!(
                            "Sync assigned to engine \"{}\" which is not a defined runtime",
                            engine
                        ));
                    }
                }
            }
        }

        if !errors.is_empty() {
            return Ok(DeploymentValidatorValidateOutput::Error { issues: errors });
        }

        // Build plan
        let plan = json!({
            "conceptPlacements": [],
            "syncAssignments": [],
        });

        if !warnings.is_empty() {
            Ok(DeploymentValidatorValidateOutput::Warning {
                plan,
                issues: warnings,
            })
        } else {
            Ok(DeploymentValidatorValidateOutput::Ok { plan })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_parse_empty_raw() {
        let storage = InMemoryStorage::new();
        let handler = DeploymentValidatorHandlerImpl;
        let result = handler.parse(
            DeploymentValidatorParseInput {
                raw: "".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DeploymentValidatorParseOutput::Error { message } => {
                assert!(message.contains("required"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_invalid_json() {
        let storage = InMemoryStorage::new();
        let handler = DeploymentValidatorHandlerImpl;
        let result = handler.parse(
            DeploymentValidatorParseInput {
                raw: "not-json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DeploymentValidatorParseOutput::Error { message } => {
                assert!(message.contains("Parse error"));
            },
            _ => panic!("Expected Error variant"),
        }
    }

    #[tokio::test]
    async fn test_parse_valid_manifest() {
        let storage = InMemoryStorage::new();
        let handler = DeploymentValidatorHandlerImpl;
        let manifest = json!({
            "app": {"name": "test", "version": "1.0", "uri": "test://app"},
            "runtimes": {},
            "concepts": {},
        });
        let result = handler.parse(
            DeploymentValidatorParseInput {
                raw: serde_json::to_string(&manifest).unwrap(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DeploymentValidatorParseOutput::Ok { manifest } => {
                assert!(!manifest.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_empty_manifest() {
        let storage = InMemoryStorage::new();
        let handler = DeploymentValidatorHandlerImpl;
        let result = handler.validate(
            DeploymentValidatorValidateInput {
                manifest: "".to_string(),
                concepts: vec![],
                syncs: vec![],
            },
            &storage,
        ).await.unwrap();
        match result {
            DeploymentValidatorValidateOutput::Error { issues } => {
                assert!(!issues.is_empty());
            },
            _ => panic!("Expected Error variant"),
        }
    }
}
