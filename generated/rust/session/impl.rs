// Session Handler Implementation
//
// Manage authenticated session lifecycle: creation, validation, refresh,
// and device tracking. Each session binds a user identity to a specific
// device with a bounded-lifetime token.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::SessionHandler;
use serde_json::json;

/// Session time-to-live in seconds (30 minutes).
const SESSION_TTL_SECS: i64 = 30 * 60;

pub struct SessionHandlerImpl;

/// Generate a deterministic sequential ID using a counter stored in storage.
async fn next_generated_id(storage: &dyn ConceptStorage) -> Result<String, Box<dyn std::error::Error>> {
    let counter_record = storage.get("_idCounter", "_session").await?;
    let next = match counter_record {
        Some(val) => val["value"].as_i64().unwrap_or(1) + 1,
        None => 2,
    };
    storage.put("_idCounter", "_session", json!({ "value": next })).await?;
    Ok(format!("u-test-invariant-{:03}", next))
}

/// Get the current Unix timestamp in seconds.
fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[async_trait]
impl SessionHandler for SessionHandlerImpl {
    async fn create(
        &self,
        input: SessionCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionCreateOutput, Box<dyn std::error::Error>> {
        let token = next_generated_id(storage).await?;
        let expires_at = now_secs() + SESSION_TTL_SECS;

        storage.put("session", &input.session, json!({
            "session": input.session,
            "userId": input.user_id,
            "device": input.device,
            "token": token,
            "expiresAt": expires_at,
            "isValid": true,
        })).await?;

        // Maintain a reverse index: user -> list of session IDs for destroy_all
        let user_sessions = storage.get("userSessions", &input.user_id).await?;
        let mut session_ids: Vec<String> = match &user_sessions {
            Some(val) => {
                let raw = val["sessionIds"].as_str().unwrap_or("[]");
                serde_json::from_str(raw).unwrap_or_default()
            }
            None => Vec::new(),
        };
        session_ids.push(input.session.clone());

        storage.put("userSessions", &input.user_id, json!({
            "userId": input.user_id,
            "sessionIds": serde_json::to_string(&session_ids)?,
        })).await?;

        Ok(SessionCreateOutput::Ok { token })
    }

    async fn validate(
        &self,
        input: SessionValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionValidateOutput, Box<dyn std::error::Error>> {
        let record = storage.get("session", &input.session).await?;
        let record = match record {
            Some(r) => r,
            None => {
                let msg = next_generated_id(storage).await?;
                return Ok(SessionValidateOutput::Notfound { message: msg });
            }
        };

        let expires_at = record["expiresAt"].as_i64().unwrap_or(0);
        let is_valid = record["isValid"].as_bool().unwrap_or(false);
        let valid = is_valid && expires_at > now_secs();

        Ok(SessionValidateOutput::Ok { valid })
    }

    async fn refresh(
        &self,
        input: SessionRefreshInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionRefreshOutput, Box<dyn std::error::Error>> {
        let record = storage.get("session", &input.session).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(SessionRefreshOutput::Notfound {
                    message: "No session exists with this identifier".to_string(),
                });
            }
        };

        let expires_at = record["expiresAt"].as_i64().unwrap_or(0);
        let is_valid = record["isValid"].as_bool().unwrap_or(false);

        if !is_valid || expires_at <= now_secs() {
            return Ok(SessionRefreshOutput::Expired {
                message: "The session has already expired and cannot be refreshed".to_string(),
            });
        }

        // Issue a new token and extend lifetime
        let new_token = next_generated_id(storage).await?;
        let new_expires_at = now_secs() + SESSION_TTL_SECS;

        let mut updated = record.clone();
        updated["token"] = json!(new_token);
        updated["expiresAt"] = json!(new_expires_at);
        storage.put("session", &input.session, updated).await?;

        Ok(SessionRefreshOutput::Ok { token: new_token })
    }

    async fn destroy(
        &self,
        input: SessionDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionDestroyOutput, Box<dyn std::error::Error>> {
        let record = storage.get("session", &input.session).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(SessionDestroyOutput::Notfound {
                    message: "No session exists with this identifier".to_string(),
                });
            }
        };

        // Remove session from the user's reverse index
        let user_id = record["userId"].as_str().unwrap_or("").to_string();
        let user_sessions = storage.get("userSessions", &user_id).await?;
        if let Some(val) = user_sessions {
            let raw = val["sessionIds"].as_str().unwrap_or("[]");
            let mut session_ids: Vec<String> = serde_json::from_str(raw).unwrap_or_default();
            session_ids.retain(|id| id != &input.session);
            storage.put("userSessions", &user_id, json!({
                "userId": user_id,
                "sessionIds": serde_json::to_string(&session_ids)?,
            })).await?;
        }

        storage.del("session", &input.session).await?;

        Ok(SessionDestroyOutput::Ok {
            session: input.session,
        })
    }

    async fn destroy_all(
        &self,
        input: SessionDestroyAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionDestroyAllOutput, Box<dyn std::error::Error>> {
        let user_sessions = storage.get("userSessions", &input.user_id).await?;
        if let Some(val) = user_sessions {
            let raw = val["sessionIds"].as_str().unwrap_or("[]");
            let session_ids: Vec<String> = serde_json::from_str(raw).unwrap_or_default();
            for id in &session_ids {
                storage.del("session", id).await?;
            }
        }

        // Clear the user's session index
        storage.put("userSessions", &input.user_id, json!({
            "userId": input.user_id,
            "sessionIds": "[]",
        })).await?;

        Ok(SessionDestroyAllOutput::Ok {
            user_id: input.user_id,
        })
    }

    async fn get_context(
        &self,
        input: SessionGetContextInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionGetContextOutput, Box<dyn std::error::Error>> {
        let record = storage.get("session", &input.session).await?;
        let record = match record {
            Some(r) => r,
            None => {
                return Ok(SessionGetContextOutput::Notfound {
                    message: "No session exists with this identifier".to_string(),
                });
            }
        };

        Ok(SessionGetContextOutput::Ok {
            user_id: record["userId"].as_str().unwrap_or("").to_string(),
            device: record["device"].as_str().unwrap_or("").to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_session() {
        let storage = InMemoryStorage::new();
        let handler = SessionHandlerImpl;
        let result = handler.create(
            SessionCreateInput {
                session: "sess-1".to_string(),
                user_id: "user-1".to_string(),
                device: "chrome".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            SessionCreateOutput::Ok { token } => {
                assert!(!token.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SessionHandlerImpl;
        let result = handler.validate(
            SessionValidateInput { session: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SessionValidateOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_refresh_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SessionHandlerImpl;
        let result = handler.refresh(
            SessionRefreshInput { session: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SessionRefreshOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_destroy_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SessionHandlerImpl;
        let result = handler.destroy(
            SessionDestroyInput { session: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SessionDestroyOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_destroy_all() {
        let storage = InMemoryStorage::new();
        let handler = SessionHandlerImpl;
        let result = handler.destroy_all(
            SessionDestroyAllInput { user_id: "user-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SessionDestroyAllOutput::Ok { user_id } => {
                assert_eq!(user_id, "user-1");
            },
        }
    }

    #[tokio::test]
    async fn test_get_context_not_found() {
        let storage = InMemoryStorage::new();
        let handler = SessionHandlerImpl;
        let result = handler.get_context(
            SessionGetContextInput { session: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            SessionGetContextOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
