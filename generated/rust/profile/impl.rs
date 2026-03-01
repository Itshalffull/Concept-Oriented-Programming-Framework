// Profile -- user profile management with bio and image fields.
// Supports update (upsert) and retrieval by user identifier.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ProfileHandler;
use serde_json::json;

pub struct ProfileHandlerImpl;

#[async_trait]
impl ProfileHandler for ProfileHandlerImpl {
    async fn update(
        &self,
        input: ProfileUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProfileUpdateOutput, Box<dyn std::error::Error>> {
        storage.put("profile", &input.user, json!({
            "user": input.user,
            "bio": input.bio,
            "image": input.image,
        })).await?;

        Ok(ProfileUpdateOutput::Ok {
            user: input.user,
            bio: input.bio,
            image: input.image,
        })
    }

    async fn get(
        &self,
        input: ProfileGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProfileGetOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("profile", &input.user).await?;

        match existing {
            Some(record) => {
                let bio = record.get("bio").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let image = record.get("image").and_then(|v| v.as_str()).unwrap_or("").to_string();

                Ok(ProfileGetOutput::Ok {
                    user: input.user,
                    bio,
                    image,
                })
            }
            None => Ok(ProfileGetOutput::Notfound {
                message: format!("Profile for user '{}' not found", input.user),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_update_profile() {
        let storage = InMemoryStorage::new();
        let handler = ProfileHandlerImpl;
        let result = handler.update(
            ProfileUpdateInput {
                user: "alice".to_string(),
                bio: "Hello world".to_string(),
                image: "avatar.png".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ProfileUpdateOutput::Ok { user, bio, image } => {
                assert_eq!(user, "alice");
                assert_eq!(bio, "Hello world");
                assert_eq!(image, "avatar.png");
            }
        }
    }

    #[tokio::test]
    async fn test_get_profile() {
        let storage = InMemoryStorage::new();
        let handler = ProfileHandlerImpl;
        handler.update(
            ProfileUpdateInput {
                user: "alice".to_string(),
                bio: "Hello".to_string(),
                image: "img.png".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            ProfileGetInput { user: "alice".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProfileGetOutput::Ok { user, bio, image } => {
                assert_eq!(user, "alice");
                assert_eq!(bio, "Hello");
                assert_eq!(image, "img.png");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_profile_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ProfileHandlerImpl;
        let result = handler.get(
            ProfileGetInput { user: "nonexistent".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ProfileGetOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }
}
