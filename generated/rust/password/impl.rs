// Password concept implementation
// Secure password hashing with salt, verification, and strength validation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::PasswordHandler;
use serde_json::json;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub struct PasswordHandlerImpl;

/// Simple hash function for password storage (in production, use bcrypt/argon2)
fn hash_password(password: &str, salt: u64) -> String {
    let mut hasher = DefaultHasher::new();
    password.hash(&mut hasher);
    salt.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Generate a pseudo-random salt from the current state
fn generate_salt() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64
}

#[async_trait]
impl PasswordHandler for PasswordHandlerImpl {
    async fn set(
        &self,
        input: PasswordSetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PasswordSetOutput, Box<dyn std::error::Error>> {
        if input.password.len() < 8 {
            return Ok(PasswordSetOutput::Invalid {
                message: "Password must be at least 8 characters".to_string(),
            });
        }

        let salt = generate_salt();
        let hash = hash_password(&input.password, salt);

        storage.put("password", &input.user, json!({
            "user": input.user,
            "hash": hash,
            "salt": salt.to_string()
        })).await?;

        Ok(PasswordSetOutput::Ok { user: input.user })
    }

    async fn check(
        &self,
        input: PasswordCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PasswordCheckOutput, Box<dyn std::error::Error>> {
        let record = match storage.get("password", &input.user).await? {
            Some(r) => r,
            None => return Ok(PasswordCheckOutput::Notfound {
                message: "No credentials for user".to_string(),
            }),
        };

        let stored_hash = record["hash"].as_str().unwrap_or("");
        let salt: u64 = record["salt"].as_str().unwrap_or("0").parse().unwrap_or(0);
        let computed_hash = hash_password(&input.password, salt);

        Ok(PasswordCheckOutput::Ok {
            valid: computed_hash == stored_hash,
        })
    }

    async fn validate(
        &self,
        input: PasswordValidateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<PasswordValidateOutput, Box<dyn std::error::Error>> {
        Ok(PasswordValidateOutput::Ok {
            valid: input.password.len() >= 8,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_set_password() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandlerImpl;
        let result = handler.set(
            PasswordSetInput { user: "alice".to_string(), password: "securePass123".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PasswordSetOutput::Ok { user } => assert_eq!(user, "alice"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_set_password_too_short() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandlerImpl;
        let result = handler.set(
            PasswordSetInput { user: "alice".to_string(), password: "short".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PasswordSetOutput::Invalid { .. } => {}
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_check_correct_password() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandlerImpl;
        handler.set(
            PasswordSetInput { user: "alice".to_string(), password: "securePass123".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.check(
            PasswordCheckInput { user: "alice".to_string(), password: "securePass123".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PasswordCheckOutput::Ok { valid } => assert!(valid),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_wrong_password() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandlerImpl;
        handler.set(
            PasswordSetInput { user: "alice".to_string(), password: "securePass123".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.check(
            PasswordCheckInput { user: "alice".to_string(), password: "wrongPassword".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PasswordCheckOutput::Ok { valid } => assert!(!valid),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_check_user_not_found() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandlerImpl;
        let result = handler.check(
            PasswordCheckInput { user: "unknown".to_string(), password: "anything".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PasswordCheckOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_strong_password() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandlerImpl;
        let result = handler.validate(
            PasswordValidateInput { password: "strongEnough".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PasswordValidateOutput::Ok { valid } => assert!(valid),
        }
    }

    #[tokio::test]
    async fn test_validate_weak_password() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandlerImpl;
        let result = handler.validate(
            PasswordValidateInput { password: "short".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            PasswordValidateOutput::Ok { valid } => assert!(!valid),
        }
    }
}
