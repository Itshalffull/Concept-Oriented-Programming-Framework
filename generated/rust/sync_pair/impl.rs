// SyncPair concept implementation
// Manages bidirectional synchronization pairs between two data sources.
// Supports linking, syncing, conflict detection, resolution, and change logging.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SyncPairHandler;
use serde_json::json;

pub struct SyncPairHandlerImpl;

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}Z", t.as_secs())
}

fn generate_id(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}-{}-{}", prefix, t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl SyncPairHandler for SyncPairHandlerImpl {
    async fn link(
        &self,
        input: SyncPairLinkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairLinkOutput, Box<dyn std::error::Error>> {
        // Validate that both endpoints exist (or at least record the link)
        storage.put("sync_pair", &input.pair_id, json!({
            "pairId": &input.pair_id,
            "idA": &input.id_a,
            "idB": &input.id_b,
            "status": "linked",
            "linkedAt": current_timestamp(),
            "lastSyncAt": null,
            "version": 0,
        })).await?;

        Ok(SyncPairLinkOutput::Ok)
    }

    async fn sync(
        &self,
        input: SyncPairSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairSyncOutput, Box<dyn std::error::Error>> {
        let pair = storage.get("sync_pair", &input.pair_id).await?;
        let pair = match pair {
            Some(p) => p,
            None => {
                return Ok(SyncPairSyncOutput::Notfound {
                    message: format!("Sync pair \"{}\" not found", input.pair_id),
                });
            }
        };

        // Check for pending conflicts
        let conflicts = storage.find("sync_pair_conflict", Some(&json!({
            "pairId": &input.pair_id,
            "status": "unresolved",
        }))).await?;

        if !conflicts.is_empty() {
            let conflict_descriptions: Vec<String> = conflicts.iter()
                .filter_map(|c| c.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .collect();
            return Ok(SyncPairSyncOutput::Conflict {
                conflicts: serde_json::to_string(&conflict_descriptions)
                    .unwrap_or_else(|_| "[]".to_string()),
            });
        }

        let ts = current_timestamp();
        let version = pair.get("version").and_then(|v| v.as_i64()).unwrap_or(0) + 1;

        // Record the sync event
        let change_id = generate_id("change");
        storage.put("sync_pair_changelog", &change_id, json!({
            "changeId": &change_id,
            "pairId": &input.pair_id,
            "timestamp": &ts,
            "version": version,
            "direction": "bidirectional",
        })).await?;

        // Update the pair's last sync time
        let mut updated = pair.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("lastSyncAt".to_string(), json!(&ts));
            obj.insert("version".to_string(), json!(version));
        }
        storage.put("sync_pair", &input.pair_id, updated).await?;

        Ok(SyncPairSyncOutput::Ok {
            changes: serde_json::to_string(&json!({
                "version": version,
                "syncedAt": &ts,
            })).unwrap_or_default(),
        })
    }

    async fn detect_conflicts(
        &self,
        input: SyncPairDetectConflictsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairDetectConflictsOutput, Box<dyn std::error::Error>> {
        let pair = storage.get("sync_pair", &input.pair_id).await?;
        if pair.is_none() {
            return Ok(SyncPairDetectConflictsOutput::Notfound {
                message: format!("Sync pair \"{}\" not found", input.pair_id),
            });
        }

        let conflicts = storage.find("sync_pair_conflict", Some(&json!({
            "pairId": &input.pair_id,
            "status": "unresolved",
        }))).await?;

        let conflict_list: Vec<serde_json::Value> = conflicts.iter()
            .map(|c| json!({
                "conflictId": c.get("conflictId").and_then(|v| v.as_str()).unwrap_or(""),
                "description": c.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                "field": c.get("field").and_then(|v| v.as_str()).unwrap_or(""),
            }))
            .collect();

        Ok(SyncPairDetectConflictsOutput::Ok {
            conflicts: serde_json::to_string(&conflict_list).unwrap_or_else(|_| "[]".to_string()),
        })
    }

    async fn resolve(
        &self,
        input: SyncPairResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairResolveOutput, Box<dyn std::error::Error>> {
        let conflict = storage.get("sync_pair_conflict", &input.conflict_id).await?;
        let conflict = match conflict {
            Some(c) => c,
            None => {
                return Ok(SyncPairResolveOutput::Notfound {
                    message: format!("Conflict \"{}\" not found", input.conflict_id),
                });
            }
        };

        let valid_resolutions = ["a-wins", "b-wins", "merge", "manual"];
        if !valid_resolutions.contains(&input.resolution.as_str()) {
            return Ok(SyncPairResolveOutput::Error {
                message: format!(
                    "Invalid resolution \"{}\". Valid: {}",
                    input.resolution,
                    valid_resolutions.join(", ")
                ),
            });
        }

        let winner = match input.resolution.as_str() {
            "a-wins" => conflict.get("valueA").and_then(|v| v.as_str()).unwrap_or("A").to_string(),
            "b-wins" => conflict.get("valueB").and_then(|v| v.as_str()).unwrap_or("B").to_string(),
            _ => input.resolution.clone(),
        };

        // Mark conflict as resolved
        let mut updated = conflict.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("status".to_string(), json!("resolved"));
            obj.insert("resolution".to_string(), json!(&input.resolution));
            obj.insert("resolvedAt".to_string(), json!(current_timestamp()));
        }
        storage.put("sync_pair_conflict", &input.conflict_id, updated).await?;

        Ok(SyncPairResolveOutput::Ok { winner })
    }

    async fn unlink(
        &self,
        input: SyncPairUnlinkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairUnlinkOutput, Box<dyn std::error::Error>> {
        let pair = storage.get("sync_pair", &input.pair_id).await?;
        if pair.is_none() {
            return Ok(SyncPairUnlinkOutput::Notfound {
                message: format!("Sync pair \"{}\" not found", input.pair_id),
            });
        }

        storage.del("sync_pair", &input.pair_id).await?;

        Ok(SyncPairUnlinkOutput::Ok)
    }

    async fn get_change_log(
        &self,
        input: SyncPairGetChangeLogInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SyncPairGetChangeLogOutput, Box<dyn std::error::Error>> {
        let pair = storage.get("sync_pair", &input.pair_id).await?;
        if pair.is_none() {
            return Ok(SyncPairGetChangeLogOutput::Notfound {
                message: format!("Sync pair \"{}\" not found", input.pair_id),
            });
        }

        let all_changes = storage.find("sync_pair_changelog", Some(&json!({
            "pairId": &input.pair_id,
        }))).await?;

        // Filter by since timestamp
        let filtered: Vec<&serde_json::Value> = all_changes.iter()
            .filter(|c| {
                let ts = c.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
                ts >= input.since.as_str()
            })
            .collect();

        Ok(SyncPairGetChangeLogOutput::Ok {
            log: serde_json::to_string(&filtered).unwrap_or_else(|_| "[]".to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_link() {
        let storage = InMemoryStorage::new();
        let handler = SyncPairHandlerImpl;
        let result = handler.link(
            SyncPairLinkInput {
                pair_id: "pair-1".to_string(),
                id_a: "source-a".to_string(),
                id_b: "source-b".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SyncPairLinkOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_sync_after_link() {
        let storage = InMemoryStorage::new();
        let handler = SyncPairHandlerImpl;
        handler.link(
            SyncPairLinkInput { pair_id: "pair-1".to_string(), id_a: "a".to_string(), id_b: "b".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.sync(
            SyncPairSyncInput { pair_id: "pair-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncPairSyncOutput::Ok { changes } => {
                assert!(changes.contains("version"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_sync_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyncPairHandlerImpl;
        let result = handler.sync(
            SyncPairSyncInput { pair_id: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncPairSyncOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_unlink() {
        let storage = InMemoryStorage::new();
        let handler = SyncPairHandlerImpl;
        handler.link(
            SyncPairLinkInput { pair_id: "pair-1".to_string(), id_a: "a".to_string(), id_b: "b".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.unlink(
            SyncPairUnlinkInput { pair_id: "pair-1".to_string(), id_a: "a".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncPairUnlinkOutput::Ok => {},
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_unlink_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyncPairHandlerImpl;
        let result = handler.unlink(
            SyncPairUnlinkInput { pair_id: "nonexistent".to_string(), id_a: "a".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncPairUnlinkOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SyncPairHandlerImpl;
        let result = handler.resolve(
            SyncPairResolveInput { conflict_id: "nonexistent".to_string(), resolution: "a-wins".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SyncPairResolveOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
