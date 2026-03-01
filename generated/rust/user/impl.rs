// User handler implementation
// User registration with duplicate name and email checking.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::UserHandler;
use serde_json::json;

pub struct UserHandlerImpl;

#[async_trait]
impl UserHandler for UserHandlerImpl {
    async fn register(
        &self,
        input: UserRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UserRegisterOutput, Box<dyn std::error::Error>> {
        let user = &input.user;
        let name = &input.name;
        let email = &input.email;

        // Check for duplicate name
        let existing_by_name = storage.find("user", Some(&json!({"name": name}))).await?;
        if !existing_by_name.is_empty() {
            return Ok(UserRegisterOutput::Error {
                message: "name already taken".to_string(),
            });
        }

        // Check for duplicate email
        let existing_by_email = storage.find("user", Some(&json!({"email": email}))).await?;
        if !existing_by_email.is_empty() {
            return Ok(UserRegisterOutput::Error {
                message: "email already taken".to_string(),
            });
        }

        storage.put("user", user, json!({
            "user": user,
            "name": name,
            "email": email,
        })).await?;

        Ok(UserRegisterOutput::Ok { user: user.clone() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_register_success() {
        let storage = InMemoryStorage::new();
        let handler = UserHandlerImpl;
        let result = handler.register(
            UserRegisterInput {
                user: "user-1".to_string(),
                name: "Alice".to_string(),
                email: "alice@example.com".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            UserRegisterOutput::Ok { user } => {
                assert_eq!(user, "user-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate_name() {
        let storage = InMemoryStorage::new();
        let handler = UserHandlerImpl;
        handler.register(
            UserRegisterInput {
                user: "user-1".to_string(),
                name: "Alice".to_string(),
                email: "alice@example.com".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            UserRegisterInput {
                user: "user-2".to_string(),
                name: "Alice".to_string(),
                email: "alice2@example.com".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            UserRegisterOutput::Error { message } => {
                assert!(message.contains("name"));
            },
            _ => panic!("Expected Error variant for duplicate name"),
        }
    }

    #[tokio::test]
    async fn test_register_duplicate_email() {
        let storage = InMemoryStorage::new();
        let handler = UserHandlerImpl;
        handler.register(
            UserRegisterInput {
                user: "user-1".to_string(),
                name: "Alice".to_string(),
                email: "alice@example.com".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.register(
            UserRegisterInput {
                user: "user-2".to_string(),
                name: "Bob".to_string(),
                email: "alice@example.com".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            UserRegisterOutput::Error { message } => {
                assert!(message.contains("email"));
            },
            _ => panic!("Expected Error variant for duplicate email"),
        }
    }
}
