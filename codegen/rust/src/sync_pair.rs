// SyncPair Concept Implementation (Rust)
//
// Data integration kit — bidirectional sync with conflict resolution.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPairLinkInput {
    pub pair_id: String,
    pub id_a: String,
    pub id_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SyncPairLinkOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPairSyncInput {
    pub pair_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SyncPairSyncOutput {
    #[serde(rename = "ok")]
    Ok { changes: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "conflict")]
    Conflict { conflicts: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPairDetectConflictsInput {
    pub pair_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SyncPairDetectConflictsOutput {
    #[serde(rename = "ok")]
    Ok { conflicts: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPairResolveInput {
    pub conflict_id: String,
    pub resolution: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SyncPairResolveOutput {
    #[serde(rename = "ok")]
    Ok { winner: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPairUnlinkInput {
    pub pair_id: String,
    pub id_a: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SyncPairUnlinkOutput {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPairGetChangeLogInput {
    pub pair_id: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum SyncPairGetChangeLogOutput {
    #[serde(rename = "ok")]
    Ok { log: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

pub struct SyncPairHandler;

impl SyncPairHandler {
    pub async fn link(
        &self,
        input: SyncPairLinkInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SyncPairLinkOutput> {
        let existing = storage.get("sync_pair", &input.pair_id).await?;
        match existing {
            None => Ok(SyncPairLinkOutput::Notfound {
                message: format!("Pair \"{}\" not found", input.pair_id),
            }),
            Some(mut record) => {
                let pair_map = record["pair_map"].as_object_mut();
                if let Some(pm) = pair_map {
                    pm.insert(input.id_a, json!(input.id_b));
                } else {
                    record["pair_map"] = json!({ input.id_a: input.id_b });
                }
                storage.put("sync_pair", &input.pair_id, record).await?;
                Ok(SyncPairLinkOutput::Ok)
            }
        }
    }

    pub async fn sync(
        &self,
        input: SyncPairSyncInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SyncPairSyncOutput> {
        let existing = storage.get("sync_pair", &input.pair_id).await?;
        match existing {
            None => Ok(SyncPairSyncOutput::Notfound {
                message: format!("Pair \"{}\" not found", input.pair_id),
            }),
            Some(mut record) => {
                record["status"] = json!("syncing");
                storage.put("sync_pair", &input.pair_id, record.clone()).await?;

                let mut change_log = record["change_log"].as_array().cloned().unwrap_or_default();
                change_log.push(json!({
                    "pair_id": input.pair_id,
                    "operation": "sync",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                }));

                record["status"] = json!("idle");
                record["change_log"] = json!(change_log);
                storage.put("sync_pair", &input.pair_id, record).await?;

                Ok(SyncPairSyncOutput::Ok {
                    changes: "[]".into(),
                })
            }
        }
    }

    pub async fn detect_conflicts(
        &self,
        input: SyncPairDetectConflictsInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SyncPairDetectConflictsOutput> {
        let existing = storage.get("sync_pair", &input.pair_id).await?;
        match existing {
            None => Ok(SyncPairDetectConflictsOutput::Notfound {
                message: format!("Pair \"{}\" not found", input.pair_id),
            }),
            Some(_) => Ok(SyncPairDetectConflictsOutput::Ok {
                conflicts: "[]".into(),
            }),
        }
    }

    pub async fn resolve(
        &self,
        input: SyncPairResolveInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SyncPairResolveOutput> {
        let existing = storage.get("sync_conflict", &input.conflict_id).await?;
        match existing {
            None => Ok(SyncPairResolveOutput::Notfound {
                message: format!("Conflict \"{}\" not found", input.conflict_id),
            }),
            Some(_) => {
                storage.del("sync_conflict", &input.conflict_id).await?;
                let winner = if input.resolution.is_empty() {
                    "auto".to_string()
                } else {
                    input.resolution
                };
                Ok(SyncPairResolveOutput::Ok { winner })
            }
        }
    }

    pub async fn unlink(
        &self,
        input: SyncPairUnlinkInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SyncPairUnlinkOutput> {
        let existing = storage.get("sync_pair", &input.pair_id).await?;
        match existing {
            None => Ok(SyncPairUnlinkOutput::Notfound {
                message: format!("Pair \"{}\" not found", input.pair_id),
            }),
            Some(mut record) => {
                if let Some(pm) = record["pair_map"].as_object_mut() {
                    pm.remove(&input.id_a);
                }
                storage.put("sync_pair", &input.pair_id, record).await?;
                Ok(SyncPairUnlinkOutput::Ok)
            }
        }
    }

    pub async fn get_change_log(
        &self,
        input: SyncPairGetChangeLogInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<SyncPairGetChangeLogOutput> {
        let existing = storage.get("sync_pair", &input.pair_id).await?;
        match existing {
            None => Ok(SyncPairGetChangeLogOutput::Notfound {
                message: format!("Pair \"{}\" not found", input.pair_id),
            }),
            Some(record) => {
                let log = record["change_log"].as_array().cloned().unwrap_or_default();
                Ok(SyncPairGetChangeLogOutput::Ok {
                    log: json!(log).to_string(),
                })
            }
        }
    }
}
