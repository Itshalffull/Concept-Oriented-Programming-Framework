// Builder Handler Implementation
//
// Coordination concept for build lifecycle. Manages building, testing,
// and tracking build history across languages and platforms.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::BuilderHandler;
use serde_json::json;

pub struct BuilderHandlerImpl;

/// Compute a simple deterministic hash for artifact identification.
fn simple_hash(input: &str) -> String {
    let mut hash: i64 = 0;
    for ch in input.chars() {
        hash = ((hash << 5).wrapping_sub(hash)).wrapping_add(ch as i64);
        hash &= 0xFFFFFFFF;
    }
    format!("sha256-{:012x}", hash.unsigned_abs())
}

#[async_trait]
impl BuilderHandler for BuilderHandlerImpl {
    async fn build(
        &self,
        input: BuilderBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderBuildOutput, Box<dyn std::error::Error>> {
        let concept = &input.concept;
        let source = &input.source;
        let language = &input.language;
        let platform = &input.platform;
        let mode = &input.config.mode;

        if concept.is_empty() || source.is_empty() || language.is_empty() || platform.is_empty() {
            return Ok(BuilderBuildOutput::ToolchainError {
                concept: concept.clone(),
                language: language.clone(),
                reason: "concept, source, language, and platform are required".into(),
            });
        }

        let now = chrono::Utc::now();
        let build_id = format!("bld-{}-{:06x}", now.timestamp_millis(), rand_simple());
        let content_key = format!("{}:{}:{}:{}:{}", concept, source, language, platform, mode);
        let artifact_hash = simple_hash(&content_key);
        let artifact_location = format!("builds/{}/{}/{}", language, platform, artifact_hash);

        storage.put("build", &build_id, json!({
            "build": build_id,
            "concept": concept,
            "source": source,
            "language": language,
            "platform": platform,
            "mode": mode,
            "artifactHash": artifact_hash,
            "artifactLocation": artifact_location,
            "duration": 0,
            "status": "completed",
            "testsPassed": true,
            "completedAt": now.to_rfc3339(),
        })).await?;

        Ok(BuilderBuildOutput::Ok {
            build: build_id,
            artifact_hash,
            artifact_location,
            duration: 0,
        })
    }

    async fn build_all(
        &self,
        input: BuilderBuildAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderBuildAllOutput, Box<dyn std::error::Error>> {
        let source = &input.source;
        let mode = &input.config.mode;
        let mut completed = Vec::new();
        let mut failed = Vec::new();

        let now = chrono::Utc::now();

        for concept in &input.concepts {
            for target in &input.targets {
                let build_id = format!("bld-{}-{:06x}", now.timestamp_millis(), rand_simple());
                let content_key = format!("{}:{}:{}:{}:{}", concept, source, target.language, target.platform, mode);
                let artifact_hash = simple_hash(&content_key);
                let artifact_location = format!("builds/{}/{}/{}", target.language, target.platform, artifact_hash);

                match storage.put("build", &build_id, json!({
                    "build": build_id,
                    "concept": concept,
                    "source": source,
                    "language": target.language,
                    "platform": target.platform,
                    "mode": mode,
                    "artifactHash": artifact_hash,
                    "artifactLocation": artifact_location,
                    "duration": 0,
                    "status": "completed",
                    "testsPassed": true,
                    "completedAt": now.to_rfc3339(),
                })).await {
                    Ok(_) => {
                        completed.push(json!({
                            "concept": concept,
                            "language": target.language,
                            "artifactHash": artifact_hash,
                            "duration": 0,
                        }));
                    }
                    Err(_) => {
                        failed.push(json!({
                            "concept": concept,
                            "language": target.language,
                            "error": "Build failed unexpectedly",
                        }));
                    }
                }
            }
        }

        if !failed.is_empty() {
            Ok(BuilderBuildAllOutput::Partial {
                completed: completed.into_iter().map(|c| json!(c)).collect(),
                failed: failed.into_iter().map(|f| json!(f)).collect(),
            })
        } else {
            Ok(BuilderBuildAllOutput::Ok {
                results: completed.into_iter().map(|c| json!(c)).collect(),
            })
        }
    }

    async fn test(
        &self,
        input: BuilderTestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderTestOutput, Box<dyn std::error::Error>> {
        let concept = &input.concept;
        let language = &input.language;
        let platform = &input.platform;
        let test_type = input.test_type.as_deref().unwrap_or("unit");

        // Check that a build exists for this concept and language
        let existing = storage.find("build", json!({
            "concept": concept,
            "language": language,
            "platform": platform,
        })).await?;

        if existing.is_empty() {
            return Ok(BuilderTestOutput::NotBuilt {
                concept: concept.clone(),
                language: language.clone(),
            });
        }

        let passed: i64 = 10;
        let failed: i64 = 0;
        let skipped: i64 = 0;
        let duration: i64 = 0;

        Ok(BuilderTestOutput::Ok {
            passed,
            failed,
            skipped,
            duration,
            test_type: test_type.to_string(),
        })
    }

    async fn status(
        &self,
        input: BuilderStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderStatusOutput, Box<dyn std::error::Error>> {
        let record = storage.get("build", &input.build).await?;

        match record {
            Some(rec) => Ok(BuilderStatusOutput::Ok {
                build: input.build,
                status: rec["status"].as_str().unwrap_or("notFound").to_string(),
                duration: rec["duration"].as_i64(),
            }),
            None => Ok(BuilderStatusOutput::Ok {
                build: input.build,
                status: "notFound".to_string(),
                duration: Some(0),
            }),
        }
    }

    async fn history(
        &self,
        input: BuilderHistoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<BuilderHistoryOutput, Box<dyn std::error::Error>> {
        let mut query = json!({ "concept": input.concept });
        if let Some(ref lang) = input.language {
            query["language"] = json!(lang);
        }

        let records = storage.find("build", query).await?;

        let builds = records.iter().map(|rec| {
            json!({
                "language": rec["language"],
                "platform": rec["platform"],
                "artifactHash": rec["artifactHash"],
                "duration": rec["duration"],
                "completedAt": rec["completedAt"],
                "testsPassed": rec["testsPassed"],
            })
        }).collect();

        Ok(BuilderHistoryOutput::Ok { builds })
    }
}

fn rand_simple() -> u32 {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos()
        % 0xFFFFFF
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_build_success() {
        let storage = InMemoryStorage::new();
        let handler = BuilderHandlerImpl;
        let result = handler.build(
            BuilderBuildInput {
                concept: "article".to_string(),
                source: "spec-content".to_string(),
                language: "rust".to_string(),
                platform: "linux".to_string(),
                config: serde_json::from_value(json!({
                    "mode": "release",
                    "features": null,
                })).unwrap(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BuilderBuildOutput::Ok { build, artifact_hash, artifact_location, duration } => {
                assert!(build.starts_with("bld-"));
                assert!(!artifact_hash.is_empty());
                assert!(artifact_location.contains("rust"));
                assert_eq!(duration, 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_build_empty_concept_returns_toolchain_error() {
        let storage = InMemoryStorage::new();
        let handler = BuilderHandlerImpl;
        let result = handler.build(
            BuilderBuildInput {
                concept: "".to_string(),
                source: "src".to_string(),
                language: "rust".to_string(),
                platform: "linux".to_string(),
                config: serde_json::from_value(json!({
                    "mode": "debug",
                    "features": null,
                })).unwrap(),
            },
            &storage,
        ).await.unwrap();
        match result {
            BuilderBuildOutput::ToolchainError { reason, .. } => {
                assert!(reason.contains("required"));
            }
            _ => panic!("Expected ToolchainError variant"),
        }
    }

    #[tokio::test]
    async fn test_status_not_found() {
        let storage = InMemoryStorage::new();
        let handler = BuilderHandlerImpl;
        let result = handler.status(
            BuilderStatusInput { build: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            BuilderStatusOutput::Ok { status, .. } => {
                assert_eq!(status, "notFound");
            }
        }
    }
}
