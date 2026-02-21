// Session Concept Implementation (Rust)
//
// Session lifecycle management — create, validate, refresh, destroy
// individual sessions and bulk destroy all sessions for a user.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- Create ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInput {
    pub user_id: String,
    pub device_info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum CreateOutput {
    #[serde(rename = "ok")]
    Ok { session_id: String },
}

// --- Validate ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateInput {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ValidateOutput {
    #[serde(rename = "ok")]
    Ok {
        session_id: String,
        user_id: String,
        valid: bool,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- Refresh ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshInput {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RefreshOutput {
    #[serde(rename = "ok")]
    Ok { session_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
    #[serde(rename = "expired")]
    Expired { session_id: String },
}

// --- Destroy ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestroyInput {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DestroyOutput {
    #[serde(rename = "ok")]
    Ok { session_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- DestroyAll ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestroyAllInput {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum DestroyAllOutput {
    #[serde(rename = "ok")]
    Ok { user_id: String, count: u64 },
}

pub struct SessionHandler;

impl SessionHandler {
    pub async fn create(
        &self,
        input: CreateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<CreateOutput> {
        let session_id = format!("sess_{}", rand::random::<u32>());
        let now = chrono::Utc::now().to_rfc3339();

        storage
            .put(
                "session",
                &session_id,
                json!({
                    "session_id": session_id,
                    "user_id": input.user_id,
                    "device_info": input.device_info,
                    "created_at": now,
                    "refreshed_at": now,
                    "active": true,
                    "expired": false,
                }),
            )
            .await?;

        // Also store in active_session for quick user-level lookup
        storage
            .put(
                "active_session",
                &session_id,
                json!({
                    "session_id": session_id,
                    "user_id": input.user_id,
                }),
            )
            .await?;

        Ok(CreateOutput::Ok { session_id })
    }

    pub async fn validate(
        &self,
        input: ValidateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ValidateOutput> {
        let existing = storage.get("session", &input.session_id).await?;
        match existing {
            None => Ok(ValidateOutput::NotFound {
                message: format!("session '{}' not found", input.session_id),
            }),
            Some(session) => {
                let user_id = session
                    .get("user_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let active = session
                    .get("active")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let expired = session
                    .get("expired")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                Ok(ValidateOutput::Ok {
                    session_id: input.session_id,
                    user_id,
                    valid: active && !expired,
                })
            }
        }
    }

    pub async fn refresh(
        &self,
        input: RefreshInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RefreshOutput> {
        let existing = storage.get("session", &input.session_id).await?;
        match existing {
            None => Ok(RefreshOutput::NotFound {
                message: format!("session '{}' not found", input.session_id),
            }),
            Some(mut session) => {
                let expired = session
                    .get("expired")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                if expired {
                    return Ok(RefreshOutput::Expired {
                        session_id: input.session_id,
                    });
                }

                session["refreshed_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage
                    .put("session", &input.session_id, session)
                    .await?;

                Ok(RefreshOutput::Ok {
                    session_id: input.session_id,
                })
            }
        }
    }

    pub async fn destroy(
        &self,
        input: DestroyInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DestroyOutput> {
        let existing = storage.get("session", &input.session_id).await?;
        match existing {
            None => Ok(DestroyOutput::NotFound {
                message: format!("session '{}' not found", input.session_id),
            }),
            Some(_) => {
                storage.del("session", &input.session_id).await?;
                storage.del("active_session", &input.session_id).await?;
                Ok(DestroyOutput::Ok {
                    session_id: input.session_id,
                })
            }
        }
    }

    pub async fn destroy_all(
        &self,
        input: DestroyAllInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<DestroyAllOutput> {
        // Find all active sessions for this user
        let user_sessions = storage
            .find(
                "active_session",
                Some(&json!({ "user_id": input.user_id })),
            )
            .await?;

        let count = user_sessions.len() as u64;

        for session in &user_sessions {
            if let Some(sid) = session.get("session_id").and_then(|v| v.as_str()) {
                storage.del("session", sid).await?;
                storage.del("active_session", sid).await?;
            }
        }

        Ok(DestroyAllOutput::Ok {
            user_id: input.user_id,
            count,
        })
    }
}
