// Authentication Concept Implementation (Rust)
//
// Account registration, login with token generation, logout,
// and password reset flows.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// --- Register ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterInput {
    pub user_id: String,
    pub credentials: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RegisterOutput {
    #[serde(rename = "ok")]
    Ok { user_id: String },
    #[serde(rename = "already_exists")]
    AlreadyExists { user_id: String },
}

// --- Login ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginInput {
    pub user_id: String,
    pub credentials: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum LoginOutput {
    #[serde(rename = "ok")]
    Ok { user_id: String, token: String },
    #[serde(rename = "invalid_credentials")]
    InvalidCredentials { message: String },
}

// --- Logout ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogoutInput {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum LogoutOutput {
    #[serde(rename = "ok")]
    Ok { user_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// --- ResetPassword ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetPasswordInput {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ResetPasswordOutput {
    #[serde(rename = "ok")]
    Ok {
        user_id: String,
        reset_token: String,
    },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

pub struct AuthenticationHandler;

impl AuthenticationHandler {
    pub async fn register(
        &self,
        input: RegisterInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RegisterOutput> {
        let existing = storage.get("account", &input.user_id).await?;
        if existing.is_some() {
            return Ok(RegisterOutput::AlreadyExists {
                user_id: input.user_id,
            });
        }

        let now = chrono::Utc::now().to_rfc3339();
        storage
            .put(
                "account",
                &input.user_id,
                json!({
                    "user_id": input.user_id,
                    "credentials": input.credentials,
                    "created_at": now,
                    "updated_at": now,
                    "active": true,
                }),
            )
            .await?;

        Ok(RegisterOutput::Ok {
            user_id: input.user_id,
        })
    }

    pub async fn login(
        &self,
        input: LoginInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<LoginOutput> {
        let existing = storage.get("account", &input.user_id).await?;
        match existing {
            None => Ok(LoginOutput::InvalidCredentials {
                message: "invalid user or credentials".to_string(),
            }),
            Some(account) => {
                let stored_credentials = account
                    .get("credentials")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if stored_credentials != input.credentials {
                    return Ok(LoginOutput::InvalidCredentials {
                        message: "invalid user or credentials".to_string(),
                    });
                }

                let token = format!("tok_{}", rand::random::<u64>());

                // Mark account as logged in
                let mut updated = account;
                updated["last_login"] = json!(chrono::Utc::now().to_rfc3339());
                updated["token"] = json!(token);
                storage
                    .put("account", &input.user_id, updated)
                    .await?;

                Ok(LoginOutput::Ok {
                    user_id: input.user_id,
                    token,
                })
            }
        }
    }

    pub async fn logout(
        &self,
        input: LogoutInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<LogoutOutput> {
        let existing = storage.get("account", &input.user_id).await?;
        match existing {
            None => Ok(LogoutOutput::NotFound {
                message: format!("account '{}' not found", input.user_id),
            }),
            Some(mut account) => {
                account["token"] = serde_json::Value::Null;
                storage
                    .put("account", &input.user_id, account)
                    .await?;
                Ok(LogoutOutput::Ok {
                    user_id: input.user_id,
                })
            }
        }
    }

    pub async fn reset_password(
        &self,
        input: ResetPasswordInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ResetPasswordOutput> {
        let existing = storage.get("account", &input.user_id).await?;
        match existing {
            None => Ok(ResetPasswordOutput::NotFound {
                message: format!("account '{}' not found", input.user_id),
            }),
            Some(mut account) => {
                let reset_token = format!("reset_{}", rand::random::<u64>());
                account["reset_token"] = json!(reset_token);
                account["reset_requested_at"] = json!(chrono::Utc::now().to_rfc3339());
                storage
                    .put("account", &input.user_id, account)
                    .await?;
                Ok(ResetPasswordOutput::Ok {
                    user_id: input.user_id,
                    reset_token,
                })
            }
        }
    }
}
