// User Concept Implementation (Rust)
//
// Mirrors the TypeScript user.impl.ts — register action with
// uniqueness constraints on name and email.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterInput {
    pub user: String,
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum RegisterOutput {
    #[serde(rename = "ok")]
    Ok { user: String },
    #[serde(rename = "error")]
    Error { message: String },
}

pub struct UserHandler;

impl UserHandler {
    pub async fn register(
        &self,
        input: RegisterInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<RegisterOutput> {
        // Check for duplicate name
        let existing_by_name = storage
            .find("user", Some(&json!({ "name": input.name })))
            .await?;
        if !existing_by_name.is_empty() {
            return Ok(RegisterOutput::Error {
                message: "name already taken".to_string(),
            });
        }

        // Check for duplicate email
        let existing_by_email = storage
            .find("user", Some(&json!({ "email": input.email })))
            .await?;
        if !existing_by_email.is_empty() {
            return Ok(RegisterOutput::Error {
                message: "email already taken".to_string(),
            });
        }

        storage
            .put(
                "user",
                &input.user,
                json!({
                    "user": input.user,
                    "name": input.name,
                    "email": input.email,
                }),
            )
            .await?;

        Ok(RegisterOutput::Ok {
            user: input.user,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn register_ok() {
        let storage = InMemoryStorage::new();
        let handler = UserHandler;
        let result = handler
            .register(
                RegisterInput {
                    user: "u1".into(),
                    name: "alice".into(),
                    email: "alice@example.com".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, RegisterOutput::Ok { user } if user == "u1"));
    }

    #[tokio::test]
    async fn register_duplicate_name() {
        let storage = InMemoryStorage::new();
        let handler = UserHandler;
        handler
            .register(
                RegisterInput {
                    user: "u1".into(),
                    name: "alice".into(),
                    email: "a@b.com".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .register(
                RegisterInput {
                    user: "u2".into(),
                    name: "alice".into(),
                    email: "c@d.com".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, RegisterOutput::Error { message } if message == "name already taken"));
    }

    #[tokio::test]
    async fn register_duplicate_email() {
        let storage = InMemoryStorage::new();
        let handler = UserHandler;
        handler
            .register(
                RegisterInput {
                    user: "u1".into(),
                    name: "alice".into(),
                    email: "a@b.com".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .register(
                RegisterInput {
                    user: "u2".into(),
                    name: "bob".into(),
                    email: "a@b.com".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, RegisterOutput::Error { message } if message == "email already taken"));
    }
}
