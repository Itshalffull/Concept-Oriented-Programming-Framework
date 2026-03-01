// Generator concept implementation
// Code generation: plan targets from interface manifest, generate code, regenerate specific targets.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::GeneratorHandler;
use serde_json::json;
use chrono::Utc;

pub struct GeneratorHandlerImpl;

#[async_trait]
impl GeneratorHandler for GeneratorHandlerImpl {
    async fn plan(
        &self,
        input: GeneratorPlanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GeneratorPlanOutput, Box<dyn std::error::Error>> {
        // Parse the interface manifest to discover concepts and targets
        let manifest: serde_json::Value = match serde_json::from_str(&input.interface_manifest) {
            Ok(v) => v,
            Err(_) => {
                return Ok(GeneratorPlanOutput::NoTargetsConfigured {
                    kit: input.kit.clone(),
                });
            }
        };

        let targets: Vec<String> = manifest.get("targets")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        if targets.is_empty() {
            return Ok(GeneratorPlanOutput::NoTargetsConfigured {
                kit: input.kit,
            });
        }

        let concepts: Vec<String> = manifest.get("concepts")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        // Check for missing providers
        for target in &targets {
            let provider = storage.get("provider", target).await?;
            if provider.is_none() {
                return Ok(GeneratorPlanOutput::MissingProvider {
                    target: target.clone(),
                });
            }
        }

        let estimated_files = (concepts.len() * targets.len()) as i64;
        let plan_id = format!("plan-{}-{}", input.kit, Utc::now().timestamp_millis());

        storage.put("plan", &plan_id, json!({
            "plan": plan_id,
            "kit": input.kit,
            "targets": serde_json::to_string(&targets)?,
            "concepts": serde_json::to_string(&concepts)?,
            "estimatedFiles": estimated_files,
            "status": "planned",
            "createdAt": Utc::now().to_rfc3339(),
        })).await?;

        Ok(GeneratorPlanOutput::Ok {
            plan: plan_id,
            targets,
            concepts,
            estimated_files,
        })
    }

    async fn generate(
        &self,
        input: GeneratorGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GeneratorGenerateOutput, Box<dyn std::error::Error>> {
        let record = storage.get("plan", &input.plan).await?;
        let Some(mut plan_record) = record else {
            return Ok(GeneratorGenerateOutput::Blocked {
                plan: input.plan,
                breaking_changes: vec!["Plan not found".to_string()],
            });
        };

        let targets: Vec<String> = plan_record.get("targets")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let concepts: Vec<String> = plan_record.get("concepts")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let start = Utc::now();
        let mut files_generated: i64 = 0;
        let mut files_unchanged: i64 = 0;
        let mut generated_list: Vec<String> = Vec::new();
        let mut failed_list: Vec<String> = Vec::new();

        for concept in &concepts {
            for target in &targets {
                let file_key = format!("{}/{}", concept, target);
                let existing = storage.get("generated_file", &file_key).await?;

                if existing.is_some() {
                    // Check if content would change (simplified: treat as unchanged)
                    files_unchanged += 1;
                } else {
                    // Generate the file
                    storage.put("generated_file", &file_key, json!({
                        "concept": concept,
                        "target": target,
                        "plan": input.plan,
                        "generatedAt": Utc::now().to_rfc3339(),
                    })).await?;
                    files_generated += 1;
                    generated_list.push(file_key);
                }
            }
        }

        let duration = (Utc::now() - start).num_milliseconds();

        plan_record["status"] = json!("generated");
        plan_record["filesGenerated"] = json!(files_generated);
        plan_record["generatedAt"] = json!(Utc::now().to_rfc3339());
        storage.put("plan", &input.plan, plan_record).await?;

        if !failed_list.is_empty() {
            return Ok(GeneratorGenerateOutput::Partial {
                plan: input.plan,
                generated: generated_list,
                failed: failed_list,
            });
        }

        Ok(GeneratorGenerateOutput::Ok {
            plan: input.plan,
            files_generated,
            files_unchanged,
            duration,
        })
    }

    async fn regenerate(
        &self,
        input: GeneratorRegenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GeneratorRegenerateOutput, Box<dyn std::error::Error>> {
        let record = storage.get("plan", &input.plan).await?;
        let Some(plan_record) = record else {
            return Ok(GeneratorRegenerateOutput::Ok {
                plan: input.plan,
                files_regenerated: 0,
            });
        };

        let concepts: Vec<String> = plan_record.get("concepts")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let mut files_regenerated: i64 = 0;

        for concept in &concepts {
            for target in &input.targets {
                let file_key = format!("{}/{}", concept, target);

                // Delete existing and regenerate
                let _ = storage.del("generated_file", &file_key).await;
                storage.put("generated_file", &file_key, json!({
                    "concept": concept,
                    "target": target,
                    "plan": input.plan,
                    "regenerated": true,
                    "generatedAt": Utc::now().to_rfc3339(),
                })).await?;
                files_regenerated += 1;
            }
        }

        Ok(GeneratorRegenerateOutput::Ok {
            plan: input.plan,
            files_regenerated,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_plan_no_targets() {
        let storage = InMemoryStorage::new();
        let handler = GeneratorHandlerImpl;
        let result = handler.plan(
            GeneratorPlanInput {
                kit: "my-kit".to_string(),
                interface_manifest: r#"{"concepts":["user"]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GeneratorPlanOutput::NoTargetsConfigured { kit } => {
                assert_eq!(kit, "my-kit");
            },
            _ => panic!("Expected NoTargetsConfigured variant"),
        }
    }

    #[tokio::test]
    async fn test_plan_invalid_manifest() {
        let storage = InMemoryStorage::new();
        let handler = GeneratorHandlerImpl;
        let result = handler.plan(
            GeneratorPlanInput {
                kit: "my-kit".to_string(),
                interface_manifest: "not json".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GeneratorPlanOutput::NoTargetsConfigured { .. } => {},
            _ => panic!("Expected NoTargetsConfigured variant"),
        }
    }

    #[tokio::test]
    async fn test_plan_missing_provider() {
        let storage = InMemoryStorage::new();
        let handler = GeneratorHandlerImpl;
        let result = handler.plan(
            GeneratorPlanInput {
                kit: "my-kit".to_string(),
                interface_manifest: r#"{"concepts":["user"],"targets":["rust"]}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            GeneratorPlanOutput::MissingProvider { target } => {
                assert_eq!(target, "rust");
            },
            _ => panic!("Expected MissingProvider variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_plan_not_found() {
        let storage = InMemoryStorage::new();
        let handler = GeneratorHandlerImpl;
        let result = handler.generate(
            GeneratorGenerateInput { plan: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            GeneratorGenerateOutput::Blocked { .. } => {},
            _ => panic!("Expected Blocked variant"),
        }
    }

    #[tokio::test]
    async fn test_regenerate_plan_not_found() {
        let storage = InMemoryStorage::new();
        let handler = GeneratorHandlerImpl;
        let result = handler.regenerate(
            GeneratorRegenerateInput {
                plan: "nonexistent".to_string(),
                targets: vec!["rust".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            GeneratorRegenerateOutput::Ok { files_regenerated, .. } => {
                assert_eq!(files_regenerated, 0);
            },
        }
    }
}
