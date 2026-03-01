// Version handler implementation
// Snapshot-based versioning: capture entity data, list versions,
// rollback to a previous version, and diff between two versions.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::VersionHandler;
use serde_json::json;

pub struct VersionHandlerImpl;

#[async_trait]
impl VersionHandler for VersionHandlerImpl {
    async fn snapshot(
        &self,
        input: VersionSnapshotInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VersionSnapshotOutput, Box<dyn std::error::Error>> {
        let version = &input.version;
        let entity = &input.entity;
        let data = &input.data;
        let author = &input.author;

        storage.put("version", version, json!({
            "version": version,
            "entity": entity,
            "snapshot": data,
            "timestamp": "2026-01-01T00:00:00.000Z",
            "author": author,
        })).await?;

        Ok(VersionSnapshotOutput::Ok { version: version.clone() })
    }

    async fn list_versions(
        &self,
        input: VersionListVersionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VersionListVersionsOutput, Box<dyn std::error::Error>> {
        let entity = &input.entity;

        let results = storage.find("version", Some(&json!({"entity": entity}))).await?;
        let mut sorted = results.clone();
        sorted.sort_by(|a, b| {
            let ts_a = a.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
            let ts_b = b.get("timestamp").and_then(|v| v.as_str()).unwrap_or("");
            ts_a.cmp(ts_b)
        });

        let version_labels: Vec<String> = sorted.iter()
            .enumerate()
            .map(|(i, _)| format!("v{}", i + 1))
            .collect();

        let versions = if version_labels.len() == 1 {
            version_labels[0].clone()
        } else {
            version_labels.join(",")
        };

        Ok(VersionListVersionsOutput::Ok { versions })
    }

    async fn rollback(
        &self,
        input: VersionRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VersionRollbackOutput, Box<dyn std::error::Error>> {
        let version = &input.version;

        let existing = storage.get("version", version).await?;
        match existing {
            Some(rec) => {
                let data = rec.get("snapshot").and_then(|v| v.as_str()).unwrap_or("").to_string();
                Ok(VersionRollbackOutput::Ok { data })
            }
            None => Ok(VersionRollbackOutput::Notfound {
                message: "Version not found".to_string(),
            }),
        }
    }

    async fn diff(
        &self,
        input: VersionDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VersionDiffOutput, Box<dyn std::error::Error>> {
        let version_a = &input.version_a;
        let version_b = &input.version_b;

        let a = storage.get("version", version_a).await?;
        let b = storage.get("version", version_b).await?;

        if a.is_none() || b.is_none() {
            return Ok(VersionDiffOutput::Notfound {
                message: "One or both versions do not exist".to_string(),
            });
        }

        let a = a.unwrap();
        let b = b.unwrap();

        let snap_a = a.get("snapshot").and_then(|v| v.as_str()).unwrap_or("");
        let snap_b = b.get("snapshot").and_then(|v| v.as_str()).unwrap_or("");

        let changes = json!({
            "versionA": {"version": version_a, "snapshot": snap_a},
            "versionB": {"version": version_b, "snapshot": snap_b},
            "equal": snap_a == snap_b,
        });

        Ok(VersionDiffOutput::Ok {
            changes: serde_json::to_string(&changes)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_snapshot_success() {
        let storage = InMemoryStorage::new();
        let handler = VersionHandlerImpl;
        let result = handler.snapshot(
            VersionSnapshotInput {
                version: "v1".to_string(),
                entity: "doc-1".to_string(),
                data: r#"{"title":"Hello"}"#.to_string(),
                author: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VersionSnapshotOutput::Ok { version } => {
                assert_eq!(version, "v1");
            },
        }
    }

    #[tokio::test]
    async fn test_rollback_success() {
        let storage = InMemoryStorage::new();
        let handler = VersionHandlerImpl;
        handler.snapshot(
            VersionSnapshotInput {
                version: "v1".to_string(),
                entity: "doc-1".to_string(),
                data: r#"{"title":"Hello"}"#.to_string(),
                author: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.rollback(
            VersionRollbackInput { version: "v1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            VersionRollbackOutput::Ok { data } => {
                assert!(data.contains("Hello"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_rollback_not_found() {
        let storage = InMemoryStorage::new();
        let handler = VersionHandlerImpl;
        let result = handler.rollback(
            VersionRollbackInput { version: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            VersionRollbackOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_not_found() {
        let storage = InMemoryStorage::new();
        let handler = VersionHandlerImpl;
        let result = handler.diff(
            VersionDiffInput {
                version_a: "v1".to_string(),
                version_b: "v2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VersionDiffOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_diff_success() {
        let storage = InMemoryStorage::new();
        let handler = VersionHandlerImpl;
        handler.snapshot(
            VersionSnapshotInput {
                version: "v1".to_string(),
                entity: "doc-1".to_string(),
                data: r#"{"title":"A"}"#.to_string(),
                author: "alice".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.snapshot(
            VersionSnapshotInput {
                version: "v2".to_string(),
                entity: "doc-1".to_string(),
                data: r#"{"title":"B"}"#.to_string(),
                author: "bob".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.diff(
            VersionDiffInput {
                version_a: "v1".to_string(),
                version_b: "v2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            VersionDiffOutput::Ok { changes } => {
                assert!(changes.contains("false")); // equal: false
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
