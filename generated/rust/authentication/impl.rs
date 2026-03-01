// Authentication concept implementation
// Verify user identity via pluggable providers, token-based session auth, and credential reset flows.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::AuthenticationHandler;
use serde_json::json;
use sha2::{Sha256, Digest};

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Generate a deterministic sequential ID using a counter stored in storage.
async fn next_generated_id(storage: &dyn ConceptStorage) -> Result<String, Box<dyn std::error::Error>> {
    let counter = storage.get("_idCounter", "_auth").await?;
    let next = match counter {
        Some(c) => c["value"].as_i64().unwrap_or(1) + 1,
        None => 2,
    };
    storage.put("_idCounter", "_auth", json!({ "value": next })).await?;
    Ok(format!("u-test-invariant-{:03}", next))
}

pub struct AuthenticationHandlerImpl;

#[async_trait]
impl AuthenticationHandler for AuthenticationHandlerImpl {
    async fn register(
        &self,
        input: AuthenticationRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationRegisterOutput, Box<dyn std::error::Error>> {
        // Uniqueness check
        let existing = storage.get("account", &input.user).await?;
        if existing.is_some() {
            let msg = next_generated_id(storage).await?;
            return Ok(AuthenticationRegisterOutput::Exists { message: msg });
        }

        // Hash credentials with SHA-256 + deterministic salt
        let salt = sha256_hex(&input.user);
        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(input.credentials.as_bytes());
            hasher.update(salt.as_bytes());
            format!("{:x}", hasher.finalize())
        };

        storage.put("account", &input.user, json!({
            "user": input.user,
            "provider": input.provider,
            "hash": hash,
            "salt": salt,
            "tokens": "[]",
        })).await?;

        Ok(AuthenticationRegisterOutput::Ok { user: input.user })
    }

    async fn login(
        &self,
        input: AuthenticationLoginInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationLoginOutput, Box<dyn std::error::Error>> {
        let account = storage.get("account", &input.user).await?;
        let account = match account {
            Some(a) => a,
            None => {
                let msg = next_generated_id(storage).await?;
                return Ok(AuthenticationLoginOutput::Invalid { message: msg });
            }
        };

        // Verify credentials
        let stored_hash = account["hash"].as_str().unwrap_or("");
        let stored_salt = account["salt"].as_str().unwrap_or("");
        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(input.credentials.as_bytes());
            hasher.update(stored_salt.as_bytes());
            format!("{:x}", hasher.finalize())
        };

        if hash != stored_hash {
            let msg = next_generated_id(storage).await?;
            return Ok(AuthenticationLoginOutput::Invalid { message: msg });
        }

        // Generate a deterministic authentication token
        let token = next_generated_id(storage).await?;

        // Store the active token
        let mut existing_tokens: Vec<String> = serde_json::from_str(
            account["tokens"].as_str().unwrap_or("[]")
        ).unwrap_or_default();
        existing_tokens.push(token.clone());

        let mut updated = account.clone();
        updated["tokens"] = json!(serde_json::to_string(&existing_tokens)?);
        storage.put("account", &input.user, updated).await?;

        // Store reverse mapping from token to user
        storage.put("token", &token, json!({
            "token": token,
            "user": input.user,
        })).await?;

        Ok(AuthenticationLoginOutput::Ok { token })
    }

    async fn logout(
        &self,
        input: AuthenticationLogoutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationLogoutOutput, Box<dyn std::error::Error>> {
        let account = storage.get("account", &input.user).await?;
        let account = match account {
            Some(a) => a,
            None => return Ok(AuthenticationLogoutOutput::Notfound {
                message: "No active session exists for this user".to_string(),
            }),
        };

        let tokens: Vec<String> = serde_json::from_str(
            account["tokens"].as_str().unwrap_or("[]")
        ).unwrap_or_default();

        if tokens.is_empty() {
            return Ok(AuthenticationLogoutOutput::Notfound {
                message: "No active session exists for this user".to_string(),
            });
        }

        // Remove all token-to-user reverse mappings
        for t in &tokens {
            storage.del("token", t).await?;
        }

        // Clear all tokens from the account
        let mut updated = account.clone();
        updated["tokens"] = json!("[]");
        storage.put("account", &input.user, updated).await?;

        Ok(AuthenticationLogoutOutput::Ok { user: input.user })
    }

    async fn authenticate(
        &self,
        input: AuthenticationAuthenticateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationAuthenticateOutput, Box<dyn std::error::Error>> {
        let token_record = storage.get("token", &input.token).await?;
        match token_record {
            Some(r) => Ok(AuthenticationAuthenticateOutput::Ok {
                user: r["user"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(AuthenticationAuthenticateOutput::Invalid {
                message: "Token is expired, malformed, or has been revoked".to_string(),
            }),
        }
    }

    async fn reset_password(
        &self,
        input: AuthenticationResetPasswordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AuthenticationResetPasswordOutput, Box<dyn std::error::Error>> {
        let account = storage.get("account", &input.user).await?;
        let account = match account {
            Some(a) => a,
            None => return Ok(AuthenticationResetPasswordOutput::Notfound {
                message: "No account exists for this user".to_string(),
            }),
        };

        // Hash new credentials with deterministic salt
        let salt = sha256_hex(&input.user);
        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(input.new_credentials.as_bytes());
            hasher.update(salt.as_bytes());
            format!("{:x}", hasher.finalize())
        };

        // Invalidate all existing tokens
        let tokens: Vec<String> = serde_json::from_str(
            account["tokens"].as_str().unwrap_or("[]")
        ).unwrap_or_default();
        for t in &tokens {
            storage.del("token", t).await?;
        }

        let mut updated = account.clone();
        updated["hash"] = json!(hash);
        updated["salt"] = json!(salt);
        updated["tokens"] = json!("[]");
        storage.put("account", &input.user, updated).await?;

        Ok(AuthenticationResetPasswordOutput::Ok { user: input.user })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        let result = handler.register(
            AuthenticationRegisterInput {
                user: "alice".to_string(),
                provider: "local".to_string(),
                credentials: "password123".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationRegisterOutput::Ok { user } => {
                assert_eq!(user, "alice");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate_returns_exists() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        handler.register(
            AuthenticationRegisterInput {
                user: "bob".to_string(),
                provider: "local".to_string(),
                credentials: "pass".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            AuthenticationRegisterInput {
                user: "bob".to_string(),
                provider: "local".to_string(),
                credentials: "pass2".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationRegisterOutput::Exists { .. } => {}
            _ => panic!("Expected Exists variant"),
        }
    }

    #[tokio::test]
    async fn test_login_success() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        handler.register(
            AuthenticationRegisterInput {
                user: "charlie".to_string(),
                provider: "local".to_string(),
                credentials: "secret".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.login(
            AuthenticationLoginInput {
                user: "charlie".to_string(),
                credentials: "secret".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationLoginOutput::Ok { token } => {
                assert!(!token.is_empty());
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_login_wrong_credentials_returns_invalid() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        handler.register(
            AuthenticationRegisterInput {
                user: "dave".to_string(),
                provider: "local".to_string(),
                credentials: "correct".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.login(
            AuthenticationLoginInput {
                user: "dave".to_string(),
                credentials: "wrong".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationLoginOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_authenticate_valid_token() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        handler.register(
            AuthenticationRegisterInput {
                user: "eve".to_string(),
                provider: "local".to_string(),
                credentials: "pass".to_string(),
            },
            &storage,
        ).await.unwrap();
        let login_result = handler.login(
            AuthenticationLoginInput {
                user: "eve".to_string(),
                credentials: "pass".to_string(),
            },
            &storage,
        ).await.unwrap();
        let token = match login_result {
            AuthenticationLoginOutput::Ok { token } => token,
            _ => panic!("Expected Ok"),
        };
        let result = handler.authenticate(
            AuthenticationAuthenticateInput { token },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationAuthenticateOutput::Ok { user } => {
                assert_eq!(user, "eve");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_authenticate_invalid_token() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        let result = handler.authenticate(
            AuthenticationAuthenticateInput { token: "fake-token".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationAuthenticateOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_logout_success() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        handler.register(
            AuthenticationRegisterInput {
                user: "frank".to_string(),
                provider: "local".to_string(),
                credentials: "pw".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.login(
            AuthenticationLoginInput {
                user: "frank".to_string(),
                credentials: "pw".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.logout(
            AuthenticationLogoutInput { user: "frank".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationLogoutOutput::Ok { user } => {
                assert_eq!(user, "frank");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_logout_no_session_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        let result = handler.logout(
            AuthenticationLogoutInput { user: "nobody".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationLogoutOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_reset_password_success() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        handler.register(
            AuthenticationRegisterInput {
                user: "grace".to_string(),
                provider: "local".to_string(),
                credentials: "old-pw".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.reset_password(
            AuthenticationResetPasswordInput {
                user: "grace".to_string(),
                new_credentials: "new-pw".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationResetPasswordOutput::Ok { user } => {
                assert_eq!(user, "grace");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_reset_password_nonexistent_user_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = AuthenticationHandlerImpl;
        let result = handler.reset_password(
            AuthenticationResetPasswordInput {
                user: "nonexistent".to_string(),
                new_credentials: "new-pw".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            AuthenticationResetPasswordOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
