// Version Concept Implementation (Rust)
//
// Manages version history with snapshots, rollback, and diff.
// See Architecture doc Sections on version control and history.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Snapshot ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotInput {
    pub entity_id: String,
    pub snapshot_data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SnapshotOutput {
    #[serde(rename = "ok")]
    Ok {
        entity_id: String,
        version_id: String,
    },
}

// ── ListVersions ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListVersionsInput {
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ListVersionsOutput {
    #[serde(rename = "ok")]
    Ok {
        entity_id: String,
        versions: String,
    },
}

// ── Rollback ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackInput {
    pub entity_id: String,
    pub version_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RollbackOutput {
    #[serde(rename = "ok")]
    Ok { entity_id: String },
    #[serde(rename = "version_notfound")]
    VersionNotFound { message: String },
}

// ── Diff ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffInput {
    pub entity_id: String,
    pub version_a: String,
    pub version_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DiffOutput {
    #[serde(rename = "ok")]
    Ok { entity_id: String, changes: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct VersionHandler;

impl VersionHandler {
    pub async fn snapshot(
        &self,
        input: SnapshotInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SnapshotOutput> {
        let now = chrono::Utc::now();
        let version_id = format!("v_{}_{}", input.entity_id, now.timestamp_millis());

        let snapshot_data: serde_json::Value =
            serde_json::from_str(&input.snapshot_data).unwrap_or(json!({}));

        // Store the version snapshot
        storage
            .put(
                "version_history",
                &version_id,
                json!({
                    "version_id": version_id,
                    "entity_id": input.entity_id,
                    "snapshot_data": snapshot_data,
                    "created_at": now.to_rfc3339(),
                }),
            )
            .await?;

        Ok(SnapshotOutput::Ok {
            entity_id: input.entity_id,
            version_id,
        })
    }

    pub async fn list_versions(
        &self,
        input: ListVersionsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ListVersionsOutput> {
        let all_versions = storage
            .find(
                "version_history",
                Some(&json!({ "entity_id": input.entity_id })),
            )
            .await?;

        let mut versions: Vec<serde_json::Value> = all_versions
            .into_iter()
            .map(|v| {
                json!({
                    "version_id": v["version_id"],
                    "entity_id": v["entity_id"],
                    "created_at": v["created_at"],
                })
            })
            .collect();

        versions.sort_by(|a, b| {
            let da = a["created_at"].as_str().unwrap_or("");
            let db = b["created_at"].as_str().unwrap_or("");
            db.cmp(da)
        });

        Ok(ListVersionsOutput::Ok {
            entity_id: input.entity_id,
            versions: serde_json::to_string(&versions)?,
        })
    }

    pub async fn rollback(
        &self,
        input: RollbackInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RollbackOutput> {
        let version = storage
            .get("version_history", &input.version_id)
            .await?;

        match version {
            None => Ok(RollbackOutput::VersionNotFound {
                message: format!("Version '{}' not found", input.version_id),
            }),
            Some(version_record) => {
                let entity_id_in_version = version_record["entity_id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                if entity_id_in_version != input.entity_id {
                    return Ok(RollbackOutput::VersionNotFound {
                        message: format!(
                            "Version '{}' does not belong to entity '{}'",
                            input.version_id, input.entity_id
                        ),
                    });
                }

                // Create a new snapshot representing the rollback
                let now = chrono::Utc::now();
                let rollback_version_id =
                    format!("v_{}_{}", input.entity_id, now.timestamp_millis());

                storage
                    .put(
                        "version_history",
                        &rollback_version_id,
                        json!({
                            "version_id": rollback_version_id,
                            "entity_id": input.entity_id,
                            "snapshot_data": version_record["snapshot_data"],
                            "created_at": now.to_rfc3339(),
                            "rollback_from": input.version_id,
                        }),
                    )
                    .await?;

                Ok(RollbackOutput::Ok {
                    entity_id: input.entity_id,
                })
            }
        }
    }

    pub async fn diff(
        &self,
        input: DiffInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DiffOutput> {
        let version_a = storage
            .get("version_history", &input.version_a)
            .await?;
        let version_b = storage
            .get("version_history", &input.version_b)
            .await?;

        if version_a.is_none() {
            return Ok(DiffOutput::NotFound {
                message: format!("Version '{}' not found", input.version_a),
            });
        }
        if version_b.is_none() {
            return Ok(DiffOutput::NotFound {
                message: format!("Version '{}' not found", input.version_b),
            });
        }

        let data_a = &version_a.unwrap()["snapshot_data"];
        let data_b = &version_b.unwrap()["snapshot_data"];

        // Simple diff: report fields that differ
        let mut changes: Vec<serde_json::Value> = vec![];

        if let (Some(obj_a), Some(obj_b)) = (data_a.as_object(), data_b.as_object()) {
            // Fields in A or B
            let mut all_keys: Vec<&String> = obj_a.keys().collect();
            for key in obj_b.keys() {
                if !all_keys.contains(&key) {
                    all_keys.push(key);
                }
            }

            for key in all_keys {
                let val_a = obj_a.get(key);
                let val_b = obj_b.get(key);

                if val_a != val_b {
                    changes.push(json!({
                        "field": key,
                        "from": val_a,
                        "to": val_b,
                    }));
                }
            }
        }

        Ok(DiffOutput::Ok {
            entity_id: input.entity_id,
            changes: serde_json::to_string(&changes)?,
        })
    }
}
