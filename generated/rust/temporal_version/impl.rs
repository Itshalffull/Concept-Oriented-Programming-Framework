// TemporalVersion concept implementation
// Track content versions with bitemporal semantics -- when recorded (system time)
// and when valid (application time). Enables time-travel queries across both dimensions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::TemporalVersionHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("temporal-version-{}", id)
}

pub struct TemporalVersionHandlerImpl;

#[async_trait]
impl TemporalVersionHandler for TemporalVersionHandlerImpl {
    async fn record(
        &self,
        input: TemporalVersionRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionRecordOutput, Box<dyn std::error::Error>> {
        let id = next_id();
        let now = chrono::Utc::now().to_rfc3339();

        // Close the system time window on the previous current version
        if let Some(current_meta) = storage.get("temporal-version", "__current").await? {
            if let Some(prev_id) = current_meta["versionId"].as_str() {
                if let Some(prev_record) = storage.get("temporal-version", prev_id).await? {
                    let mut updated = prev_record.clone();
                    updated["systemTo"] = json!(now);
                    storage.put("temporal-version", prev_id, updated).await?;
                }
            }
        }

        let metadata_str = String::from_utf8_lossy(&input.metadata).to_string();

        storage.put("temporal-version", &id, json!({
            "id": id,
            "contentHash": input.content_hash,
            "systemFrom": now,
            "systemTo": null,
            "validFrom": input.valid_from,
            "validTo": input.valid_to,
            "metadata": metadata_str
        })).await?;

        storage.put("temporal-version", "__current", json!({
            "versionId": id,
            "contentHash": input.content_hash
        })).await?;

        Ok(TemporalVersionRecordOutput::Ok { version_id: id })
    }

    async fn as_of(
        &self,
        input: TemporalVersionAsOfInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionAsOfOutput, Box<dyn std::error::Error>> {
        let all_versions = storage.find("temporal-version", None).await?;
        let versions: Vec<&serde_json::Value> = all_versions.iter()
            .filter(|v| {
                let id = v["id"].as_str().unwrap_or("");
                id != "__current" && v["systemFrom"].is_string()
            })
            .collect();

        let mut candidates = versions;

        if let Some(ref system_time) = input.system_time {
            candidates = candidates.into_iter().filter(|v| {
                let from = v["systemFrom"].as_str().unwrap_or("");
                let to = v["systemTo"].as_str();
                from <= system_time.as_str() && (to.is_none() || to.unwrap() > system_time.as_str())
            }).collect();
        }

        if let Some(ref valid_time) = input.valid_time {
            candidates = candidates.into_iter().filter(|v| {
                let from = v["validFrom"].as_str();
                let to = v["validTo"].as_str();
                match from {
                    None => true,
                    Some(f) => f <= valid_time.as_str() && (to.is_none() || to.unwrap() > valid_time.as_str()),
                }
            }).collect();
        }

        if candidates.is_empty() {
            return Ok(TemporalVersionAsOfOutput::NotFound {
                message: "No version active at the specified times".to_string(),
            });
        }

        candidates.sort_by(|a, b| {
            let a_from = a["systemFrom"].as_str().unwrap_or("");
            let b_from = b["systemFrom"].as_str().unwrap_or("");
            b_from.cmp(a_from)
        });

        let best = candidates[0];
        Ok(TemporalVersionAsOfOutput::Ok {
            version_id: best["id"].as_str().unwrap_or("").to_string(),
            content_hash: best["contentHash"].as_str().unwrap_or("").to_string(),
        })
    }

    async fn between(
        &self,
        input: TemporalVersionBetweenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionBetweenOutput, Box<dyn std::error::Error>> {
        if input.dimension != "system" && input.dimension != "valid" {
            return Ok(TemporalVersionBetweenOutput::InvalidDimension {
                message: r#"Dimension must be "system" or "valid""#.to_string(),
            });
        }

        let all_versions = storage.find("temporal-version", None).await?;
        let versions: Vec<&serde_json::Value> = all_versions.iter()
            .filter(|v| {
                let id = v["id"].as_str().unwrap_or("");
                id != "__current" && v["systemFrom"].is_string()
            })
            .collect();

        let matching: Vec<String> = versions.iter().filter(|v| {
            if input.dimension == "system" {
                let from = v["systemFrom"].as_str().unwrap_or("");
                let to = v["systemTo"].as_str();
                from <= input.end.as_str() && (to.is_none() || to.unwrap() >= input.start.as_str())
            } else {
                let from = v["validFrom"].as_str();
                let to = v["validTo"].as_str();
                match from {
                    None => true,
                    Some(f) => f <= input.end.as_str() && (to.is_none() || to.unwrap() >= input.start.as_str()),
                }
            }
        }).map(|v| v["id"].as_str().unwrap_or("").to_string()).collect();

        Ok(TemporalVersionBetweenOutput::Ok { versions: matching })
    }

    async fn current(
        &self,
        _input: TemporalVersionCurrentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionCurrentOutput, Box<dyn std::error::Error>> {
        match storage.get("temporal-version", "__current").await? {
            None => Ok(TemporalVersionCurrentOutput::Empty {
                message: "No versions recorded yet".to_string(),
            }),
            Some(meta) => Ok(TemporalVersionCurrentOutput::Ok {
                version_id: meta["versionId"].as_str().unwrap_or("").to_string(),
                content_hash: meta["contentHash"].as_str().unwrap_or("").to_string(),
            }),
        }
    }

    async fn supersede(
        &self,
        input: TemporalVersionSupersedeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionSupersedeOutput, Box<dyn std::error::Error>> {
        let old_version = storage.get("temporal-version", &input.version_id).await?;
        if old_version.is_none() {
            return Ok(TemporalVersionSupersedeOutput::NotFound {
                message: format!("Version '{}' not found", input.version_id),
            });
        }

        let old = old_version.unwrap();
        let now = chrono::Utc::now().to_rfc3339();

        let mut updated = old.clone();
        updated["systemTo"] = json!(now);
        storage.put("temporal-version", &input.version_id, updated).await?;

        let new_id = next_id();
        storage.put("temporal-version", &new_id, json!({
            "id": new_id,
            "contentHash": input.content_hash,
            "systemFrom": now,
            "systemTo": null,
            "validFrom": old["validFrom"],
            "validTo": old["validTo"],
            "metadata": old["metadata"].as_str().unwrap_or("")
        })).await?;

        storage.put("temporal-version", "__current", json!({
            "versionId": new_id,
            "contentHash": input.content_hash
        })).await?;

        Ok(TemporalVersionSupersedeOutput::Ok { new_version_id: new_id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_record_success() {
        let storage = InMemoryStorage::new();
        let handler = TemporalVersionHandlerImpl;
        let result = handler.record(
            TemporalVersionRecordInput {
                content_hash: "sha256:abc123".to_string(),
                valid_from: Some("2026-01-01T00:00:00Z".to_string()),
                valid_to: Some("2026-12-31T23:59:59Z".to_string()),
                metadata: b"test metadata".to_vec(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemporalVersionRecordOutput::Ok { version_id } => {
                assert!(!version_id.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_current_empty() {
        let storage = InMemoryStorage::new();
        let handler = TemporalVersionHandlerImpl;
        let result = handler.current(
            TemporalVersionCurrentInput {},
            &storage,
        ).await.unwrap();
        match result {
            TemporalVersionCurrentOutput::Empty { .. } => {},
            _ => panic!("Expected Empty variant"),
        }
    }

    #[tokio::test]
    async fn test_current_after_record() {
        let storage = InMemoryStorage::new();
        let handler = TemporalVersionHandlerImpl;
        handler.record(
            TemporalVersionRecordInput {
                content_hash: "sha256:abc".to_string(),
                valid_from: None,
                valid_to: None,
                metadata: vec![],
            },
            &storage,
        ).await.unwrap();
        let result = handler.current(
            TemporalVersionCurrentInput {},
            &storage,
        ).await.unwrap();
        match result {
            TemporalVersionCurrentOutput::Ok { content_hash, .. } => {
                assert_eq!(content_hash, "sha256:abc");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_between_invalid_dimension() {
        let storage = InMemoryStorage::new();
        let handler = TemporalVersionHandlerImpl;
        let result = handler.between(
            TemporalVersionBetweenInput {
                start: "2026-01-01".to_string(),
                end: "2026-12-31".to_string(),
                dimension: "invalid".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemporalVersionBetweenOutput::InvalidDimension { .. } => {},
            _ => panic!("Expected InvalidDimension variant"),
        }
    }

    #[tokio::test]
    async fn test_between_system_dimension() {
        let storage = InMemoryStorage::new();
        let handler = TemporalVersionHandlerImpl;
        handler.record(
            TemporalVersionRecordInput {
                content_hash: "sha256:abc".to_string(),
                valid_from: None,
                valid_to: None,
                metadata: vec![],
            },
            &storage,
        ).await.unwrap();
        let result = handler.between(
            TemporalVersionBetweenInput {
                start: "2020-01-01T00:00:00Z".to_string(),
                end: "2030-12-31T23:59:59Z".to_string(),
                dimension: "system".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemporalVersionBetweenOutput::Ok { versions } => {
                assert!(!versions.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_supersede_notfound() {
        let storage = InMemoryStorage::new();
        let handler = TemporalVersionHandlerImpl;
        let result = handler.supersede(
            TemporalVersionSupersedeInput {
                version_id: "nonexistent".to_string(),
                content_hash: "sha256:new".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            TemporalVersionSupersedeOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_as_of_not_found() {
        let storage = InMemoryStorage::new();
        let handler = TemporalVersionHandlerImpl;
        let result = handler.as_of(
            TemporalVersionAsOfInput {
                system_time: Some("2020-01-01T00:00:00Z".to_string()),
                valid_time: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            TemporalVersionAsOfOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }
}
