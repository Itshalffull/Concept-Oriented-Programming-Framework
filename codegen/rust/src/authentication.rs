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

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    // --- register ---

    #[tokio::test]
    async fn register_creates_new_account() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        let result = handler
            .register(
                RegisterInput {
                    user_id: "u1".into(),
                    credentials: "pass123".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RegisterOutput::Ok { user_id } if user_id == "u1"));
    }

    #[tokio::test]
    async fn register_duplicate_returns_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        handler
            .register(
                RegisterInput {
                    user_id: "u1".into(),
                    credentials: "pass123".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .register(
                RegisterInput {
                    user_id: "u1".into(),
                    credentials: "other".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, RegisterOutput::AlreadyExists { user_id } if user_id == "u1"));
    }

    // --- login ---

    #[tokio::test]
    async fn login_succeeds_with_correct_credentials() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        handler
            .register(
                RegisterInput {
                    user_id: "u1".into(),
                    credentials: "secret".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .login(
                LoginInput {
                    user_id: "u1".into(),
                    credentials: "secret".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        match result {
            LoginOutput::Ok { user_id, token } => {
                assert_eq!(user_id, "u1");
                assert!(token.starts_with("tok_"));
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn login_fails_with_wrong_credentials() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        handler
            .register(
                RegisterInput {
                    user_id: "u1".into(),
                    credentials: "secret".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .login(
                LoginInput {
                    user_id: "u1".into(),
                    credentials: "wrong".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, LoginOutput::InvalidCredentials { .. }));
    }

    #[tokio::test]
    async fn login_fails_for_nonexistent_user() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        let result = handler
            .login(
                LoginInput {
                    user_id: "ghost".into(),
                    credentials: "anything".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, LoginOutput::InvalidCredentials { .. }));
    }

    // --- logout ---

    #[tokio::test]
    async fn logout_succeeds_for_registered_user() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        handler
            .register(
                RegisterInput {
                    user_id: "u1".into(),
                    credentials: "pass".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .logout(LogoutInput { user_id: "u1".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, LogoutOutput::Ok { user_id } if user_id == "u1"));
    }

    #[tokio::test]
    async fn logout_not_found_for_missing_user() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        let result = handler
            .logout(LogoutInput { user_id: "ghost".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, LogoutOutput::NotFound { .. }));
    }

    // --- reset_password ---

    #[tokio::test]
    async fn reset_password_generates_token() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        handler
            .register(
                RegisterInput {
                    user_id: "u1".into(),
                    credentials: "pass".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .reset_password(ResetPasswordInput { user_id: "u1".into() }, &storage)
            .await
            .unwrap();

        match result {
            ResetPasswordOutput::Ok { user_id, reset_token } => {
                assert_eq!(user_id, "u1");
                assert!(reset_token.starts_with("reset_"));
            }
            _ => panic!("expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn reset_password_not_found_for_missing_user() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandler;

        let result = handler
            .reset_password(ResetPasswordInput { user_id: "ghost".into() }, &storage)
            .await
            .unwrap();

        assert!(matches!(result, ResetPasswordOutput::NotFound { .. }));
    }
}
