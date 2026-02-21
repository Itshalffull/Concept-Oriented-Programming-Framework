// Flag Concept Implementation (Rust) — Collaboration kit
//
// Flags/unflags entities by user and flag type, checks flagged status,
// and counts flags per entity.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Flag ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationFlagFlagInput {
    pub user_id: String,
    pub entity_id: String,
    pub flag_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CollaborationFlagFlagOutput {
    #[serde(rename = "ok")]
    Ok {
        user_id: String,
        entity_id: String,
        flag_type: String,
    },
    #[serde(rename = "already_flagged")]
    AlreadyFlagged { message: String },
}

// ── Unflag ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationFlagUnflagInput {
    pub user_id: String,
    pub entity_id: String,
    pub flag_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CollaborationFlagUnflagOutput {
    #[serde(rename = "ok")]
    Ok {
        user_id: String,
        entity_id: String,
        flag_type: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── IsFlagged ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationFlagIsFlaggedInput {
    pub user_id: String,
    pub entity_id: String,
    pub flag_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CollaborationFlagIsFlaggedOutput {
    #[serde(rename = "ok")]
    Ok { flagged: bool },
}

// ── GetCount ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationFlagGetCountInput {
    pub entity_id: String,
    pub flag_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CollaborationFlagGetCountOutput {
    #[serde(rename = "ok")]
    Ok { entity_id: String, count: u64 },
}

// ── Handler ───────────────────────────────────────────────

pub struct CollaborationFlagHandler;

impl CollaborationFlagHandler {
    fn make_key(user_id: &str, entity_id: &str, flag_type: &str) -> String {
        format!("{}:{}:{}", user_id, entity_id, flag_type)
    }

    pub async fn flag(
        &self,
        input: CollaborationFlagFlagInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CollaborationFlagFlagOutput> {
        let key = Self::make_key(&input.user_id, &input.entity_id, &input.flag_type);
        let existing = storage.get("flagging", &key).await?;

        if existing.is_some() {
            return Ok(CollaborationFlagFlagOutput::AlreadyFlagged {
                message: format!(
                    "user '{}' already flagged entity '{}' with type '{}'",
                    input.user_id, input.entity_id, input.flag_type
                ),
            });
        }

        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "flagging",
                &key,
                json!({
                    "user_id": input.user_id,
                    "entity_id": input.entity_id,
                    "flag_type": input.flag_type,
                    "flagged_at": now,
                }),
            )
            .await?;

        Ok(CollaborationFlagFlagOutput::Ok {
            user_id: input.user_id,
            entity_id: input.entity_id,
            flag_type: input.flag_type,
        })
    }

    pub async fn unflag(
        &self,
        input: CollaborationFlagUnflagInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CollaborationFlagUnflagOutput> {
        let key = Self::make_key(&input.user_id, &input.entity_id, &input.flag_type);
        let existing = storage.get("flagging", &key).await?;

        if existing.is_none() {
            return Ok(CollaborationFlagUnflagOutput::NotFound {
                message: format!(
                    "flag not found for user '{}' on entity '{}' with type '{}'",
                    input.user_id, input.entity_id, input.flag_type
                ),
            });
        }

        storage.del("flagging", &key).await?;
        Ok(CollaborationFlagUnflagOutput::Ok {
            user_id: input.user_id,
            entity_id: input.entity_id,
            flag_type: input.flag_type,
        })
    }

    pub async fn is_flagged(
        &self,
        input: CollaborationFlagIsFlaggedInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CollaborationFlagIsFlaggedOutput> {
        let key = Self::make_key(&input.user_id, &input.entity_id, &input.flag_type);
        let existing = storage.get("flagging", &key).await?;
        Ok(CollaborationFlagIsFlaggedOutput::Ok {
            flagged: existing.is_some(),
        })
    }

    pub async fn get_count(
        &self,
        input: CollaborationFlagGetCountInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CollaborationFlagGetCountOutput> {
        let criteria = json!({
            "entity_id": input.entity_id,
            "flag_type": input.flag_type,
        });
        let flags = storage.find("flagging", Some(&criteria)).await?;
        let count = flags.len() as u64;
        Ok(CollaborationFlagGetCountOutput::Ok {
            entity_id: input.entity_id,
            count,
        })
    }
}
