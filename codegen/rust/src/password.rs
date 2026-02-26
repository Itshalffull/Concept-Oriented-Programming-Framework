// Password Concept Implementation (Rust)
//
// Mirrors the TypeScript password.impl.ts — set, check, validate actions.
// Uses SHA-256 for hashing with random salt.

use crate::storage::{ConceptStorage, StorageResult};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PasswordSetInput {
    pub user: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PasswordSetOutput {
    #[serde(rename = "ok")]
    Ok { user: String },
    #[serde(rename = "invalid")]
    Invalid { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PasswordCheckInput {
    pub user: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PasswordCheckOutput {
    #[serde(rename = "ok")]
    Ok { valid: bool },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PasswordValidateInput {
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PasswordValidateOutput {
    #[serde(rename = "ok")]
    Ok { valid: bool },
}

// ── Handler ────────────────────────────────────────────────

pub struct PasswordHandler;

impl PasswordHandler {
    pub async fn set(
        &self,
        input: PasswordSetInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PasswordSetOutput> {
        if input.password.len() < 8 {
            return Ok(PasswordSetOutput::Invalid {
                message: "Password must be at least 8 characters".to_string(),
            });
        }

        // Generate random salt (16 bytes)
        let mut salt = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut salt);

        // SHA-256 hash of password + salt
        let mut hasher = Sha256::new();
        hasher.update(input.password.as_bytes());
        hasher.update(&salt);
        let hash = hasher.finalize();

        let hash_b64 = BASE64.encode(hash);
        let salt_b64 = BASE64.encode(salt);

        storage
            .put(
                "password",
                &input.user,
                json!({
                    "user": input.user,
                    "hash": hash_b64,
                    "salt": salt_b64,
                }),
            )
            .await?;

        Ok(PasswordSetOutput::Ok { user: input.user })
    }

    pub async fn check(
        &self,
        input: PasswordCheckInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<PasswordCheckOutput> {
        let record = storage.get("password", &input.user).await?;

        let Some(record) = record else {
            return Ok(PasswordCheckOutput::Notfound {
                message: "No credentials for user".to_string(),
            });
        };

        let stored_hash_b64 = record["hash"].as_str().unwrap_or_default();
        let stored_salt_b64 = record["salt"].as_str().unwrap_or_default();

        let salt = BASE64.decode(stored_salt_b64)?;

        let mut hasher = Sha256::new();
        hasher.update(input.password.as_bytes());
        hasher.update(&salt);
        let computed_hash = hasher.finalize();

        let stored_hash = BASE64.decode(stored_hash_b64)?;
        let valid = computed_hash.as_slice() == stored_hash.as_slice();

        Ok(PasswordCheckOutput::Ok { valid })
    }

    pub async fn validate(
        &self,
        input: PasswordValidateInput,
        _storage: &dyn ConceptStorage,
    ) -> StorageResult<PasswordValidateOutput> {
        Ok(PasswordValidateOutput::Ok {
            valid: input.password.len() >= 8,
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn set_ok() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandler;
        let result = handler
            .set(
                PasswordSetInput {
                    user: "u1".into(),
                    password: "securepassword".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, PasswordSetOutput::Ok { user } if user == "u1"));
    }

    #[tokio::test]
    async fn set_too_short() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandler;
        let result = handler
            .set(
                PasswordSetInput {
                    user: "u1".into(),
                    password: "short".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, PasswordSetOutput::Invalid { .. }));
    }

    #[tokio::test]
    async fn check_correct_password() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandler;
        handler
            .set(
                PasswordSetInput {
                    user: "u1".into(),
                    password: "mysecretpw".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .check(
                PasswordCheckInput {
                    user: "u1".into(),
                    password: "mysecretpw".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, PasswordCheckOutput::Ok { valid } if valid));
    }

    #[tokio::test]
    async fn check_wrong_password() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandler;
        handler
            .set(
                PasswordSetInput {
                    user: "u1".into(),
                    password: "mysecretpw".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .check(
                PasswordCheckInput {
                    user: "u1".into(),
                    password: "wrongpassword".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, PasswordCheckOutput::Ok { valid } if !valid));
    }

    #[tokio::test]
    async fn check_notfound() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandler;
        let result = handler
            .check(
                PasswordCheckInput {
                    user: "nonexistent".into(),
                    password: "anything".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, PasswordCheckOutput::Notfound { .. }));
    }

    #[tokio::test]
    async fn validate_ok() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandler;
        let result = handler
            .validate(
                PasswordValidateInput {
                    password: "longenough".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, PasswordValidateOutput::Ok { valid } if valid));
    }

    #[tokio::test]
    async fn validate_too_short() {
        let storage = InMemoryStorage::new();
        let handler = PasswordHandler;
        let result = handler
            .validate(
                PasswordValidateInput {
                    password: "short".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, PasswordValidateOutput::Ok { valid } if !valid));
    }
}
