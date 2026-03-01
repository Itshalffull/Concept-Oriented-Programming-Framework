// Artifact concept implementation
// Manage immutable, content-addressed build artifacts for concept deployments.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ArtifactHandler;
use serde_json::json;
use sha2::{Sha256, Digest};

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub struct ArtifactHandlerImpl;

#[async_trait]
impl ArtifactHandler for ArtifactHandlerImpl {
    async fn build(
        &self,
        input: ArtifactBuildInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArtifactBuildOutput, Box<dyn std::error::Error>> {
        let deps_list: Vec<String> = serde_json::from_str(&input.deps)?;

        // Compute content hash from all inputs
        let mut hash_parts = vec![
            input.concept.clone(),
            input.spec.clone(),
            input.implementation.clone(),
        ];
        hash_parts.extend(deps_list.iter().cloned());
        let hash_input = hash_parts.join("|");
        let hash = sha256_hex(&hash_input);

        // Check if artifact with same hash already exists
        let existing = storage.get("artifact", &hash).await?;
        if let Some(record) = existing {
            return Ok(ArtifactBuildOutput::Ok {
                artifact: hash.clone(),
                hash,
                size_bytes: record["sizeBytes"].as_i64().unwrap_or(0),
            });
        }

        // Compute artifact size from input lengths
        let size_bytes = (input.spec.len() + input.implementation.len() +
            deps_list.iter().map(|d| d.len()).sum::<usize>()) as i64;

        let built_at = chrono::Utc::now().to_rfc3339();
        let location = format!("artifacts/{}/{}", input.concept, hash);

        let input_hashes: Vec<serde_json::Value> = {
            let mut hashes = vec![
                json!({ "name": "spec", "hash": sha256_hex(&input.spec) }),
                json!({ "name": "implementation", "hash": sha256_hex(&input.implementation) }),
            ];
            for d in &deps_list {
                hashes.push(json!({ "name": d, "hash": sha256_hex(d) }));
            }
            hashes
        };

        storage.put("artifact", &hash, json!({
            "hash": hash,
            "suiteName": input.concept,
            "kitVersion": "1.0.0",
            "conceptName": input.concept,
            "builtAt": built_at,
            "inputs": serde_json::to_string(&input_hashes)?,
            "location": location,
            "sizeBytes": size_bytes,
        })).await?;

        Ok(ArtifactBuildOutput::Ok {
            artifact: hash.clone(),
            hash,
            size_bytes,
        })
    }

    async fn resolve(
        &self,
        input: ArtifactResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArtifactResolveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("artifact", &input.hash).await?;
        match existing {
            Some(r) => Ok(ArtifactResolveOutput::Ok {
                artifact: input.hash,
                location: r["location"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(ArtifactResolveOutput::Notfound {
                hash: input.hash,
            }),
        }
    }

    async fn gc(
        &self,
        input: ArtifactGcInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArtifactGcOutput, Box<dyn std::error::Error>> {
        let all_artifacts = storage.find("artifact", None).await?;
        let cutoff = chrono::DateTime::parse_from_rfc3339(&input.older_than)
            .map(|dt| dt.timestamp_millis())
            .unwrap_or(0);

        // Group artifacts by concept
        let mut by_concept: std::collections::HashMap<String, Vec<(String, i64, i64)>> = std::collections::HashMap::new();
        for artifact in &all_artifacts {
            let concept_name = artifact["conceptName"].as_str().unwrap_or("").to_string();
            let hash = artifact["hash"].as_str().unwrap_or("").to_string();
            let built_at = chrono::DateTime::parse_from_rfc3339(
                artifact["builtAt"].as_str().unwrap_or("1970-01-01T00:00:00Z")
            ).map(|dt| dt.timestamp_millis()).unwrap_or(0);
            let size_bytes = artifact["sizeBytes"].as_i64().unwrap_or(0);
            by_concept.entry(concept_name).or_default().push((hash, built_at, size_bytes));
        }

        let mut removed: i64 = 0;
        let mut freed_bytes: i64 = 0;

        for (_concept, mut entries) in by_concept {
            // Sort by builtAt descending to keep most recent
            entries.sort_by(|a, b| b.1.cmp(&a.1));
            for (i, (hash, built_at, size_bytes)) in entries.iter().enumerate() {
                if (i as i64) < input.keep_versions { continue; }
                if *built_at < cutoff {
                    storage.del("artifact", hash).await?;
                    removed += 1;
                    freed_bytes += size_bytes;
                }
            }
        }

        Ok(ArtifactGcOutput::Ok { removed, freed_bytes })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_build_creates_artifact() {
        let storage = InMemoryStorage::new();
        let handler = ArtifactHandlerImpl;
        let result = handler.build(
            ArtifactBuildInput {
                concept: "article".to_string(),
                spec: "spec-content".to_string(),
                implementation: "impl-content".to_string(),
                deps: r#"["dep1","dep2"]"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ArtifactBuildOutput::Ok { artifact, hash, size_bytes } => {
                assert!(!artifact.is_empty());
                assert!(!hash.is_empty());
                assert!(size_bytes > 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_build_same_inputs_returns_same_hash() {
        let storage = InMemoryStorage::new();
        let handler = ArtifactHandlerImpl;
        let result1 = handler.build(
            ArtifactBuildInput {
                concept: "echo".to_string(),
                spec: "spec".to_string(),
                implementation: "impl".to_string(),
                deps: "[]".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result2 = handler.build(
            ArtifactBuildInput {
                concept: "echo".to_string(),
                spec: "spec".to_string(),
                implementation: "impl".to_string(),
                deps: "[]".to_string(),
            },
            &storage,
        ).await.unwrap();
        let hash1 = match result1 { ArtifactBuildOutput::Ok { hash, .. } => hash, _ => panic!("Expected Ok") };
        let hash2 = match result2 { ArtifactBuildOutput::Ok { hash, .. } => hash, _ => panic!("Expected Ok") };
        assert_eq!(hash1, hash2);
    }

    #[tokio::test]
    async fn test_resolve_existing_artifact() {
        let storage = InMemoryStorage::new();
        let handler = ArtifactHandlerImpl;
        let build_result = handler.build(
            ArtifactBuildInput {
                concept: "user".to_string(),
                spec: "spec".to_string(),
                implementation: "impl".to_string(),
                deps: "[]".to_string(),
            },
            &storage,
        ).await.unwrap();
        let hash = match build_result { ArtifactBuildOutput::Ok { hash, .. } => hash, _ => panic!("Expected Ok") };
        let result = handler.resolve(
            ArtifactResolveInput { hash: hash.clone() },
            &storage,
        ).await.unwrap();
        match result {
            ArtifactResolveOutput::Ok { location, .. } => {
                assert!(location.contains("user"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_nonexistent_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ArtifactHandlerImpl;
        let result = handler.resolve(
            ArtifactResolveInput { hash: "nonexistent-hash".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ArtifactResolveOutput::Notfound { hash } => {
                assert_eq!(hash, "nonexistent-hash");
            }
            _ => panic!("Expected Notfound variant"),
        }
    }
}
