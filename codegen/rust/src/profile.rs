// Profile Concept Implementation (Rust)
//
// Mirrors the TypeScript profile.impl.ts — update and get actions.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProfileUpdateInput {
    pub user: String,
    pub bio: String,
    pub image: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProfileUpdateOutput {
    #[serde(rename = "ok")]
    Ok {
        user: String,
        bio: String,
        image: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProfileGetInput {
    pub user: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProfileGetOutput {
    #[serde(rename = "ok")]
    Ok {
        user: String,
        bio: String,
        image: String,
    },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

// ── Handler ────────────────────────────────────────────────

pub struct ProfileHandler;

impl ProfileHandler {
    pub async fn update(
        &self,
        input: ProfileUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProfileUpdateOutput> {
        storage
            .put(
                "profile",
                &input.user,
                json!({
                    "user": input.user,
                    "bio": input.bio,
                    "image": input.image,
                }),
            )
            .await?;

        Ok(ProfileUpdateOutput::Ok {
            user: input.user,
            bio: input.bio,
            image: input.image,
        })
    }

    pub async fn get(
        &self,
        input: ProfileGetInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ProfileGetOutput> {
        let record = storage.get("profile", &input.user).await?;

        match record {
            None => Ok(ProfileGetOutput::Notfound {
                message: "No profile found for user".to_string(),
            }),
            Some(r) => {
                let bio = r["bio"].as_str().unwrap_or_default().to_string();
                let image = r["image"].as_str().unwrap_or_default().to_string();
                Ok(ProfileGetOutput::Ok {
                    user: input.user,
                    bio,
                    image,
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

    #[tokio::test]
    async fn update_and_get() {
        let storage = InMemoryStorage::new();
        let handler = ProfileHandler;

        let update_result = handler
            .update(
                ProfileUpdateInput {
                    user: "u1".into(),
                    bio: "Hello world".into(),
                    image: "https://example.com/avatar.png".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            update_result,
            ProfileUpdateOutput::Ok { ref user, ref bio, .. }
            if user == "u1" && bio == "Hello world"
        ));

        let get_result = handler
            .get(ProfileGetInput { user: "u1".into() }, &storage)
            .await
            .unwrap();

        match get_result {
            ProfileGetOutput::Ok { user, bio, image } => {
                assert_eq!(user, "u1");
                assert_eq!(bio, "Hello world");
                assert_eq!(image, "https://example.com/avatar.png");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn get_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ProfileHandler;
        let result = handler
            .get(
                ProfileGetInput {
                    user: "nonexistent".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ProfileGetOutput::Notfound { .. }));
    }

    #[tokio::test]
    async fn update_overwrites() {
        let storage = InMemoryStorage::new();
        let handler = ProfileHandler;

        handler
            .update(
                ProfileUpdateInput {
                    user: "u1".into(),
                    bio: "Old bio".into(),
                    image: "old.png".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .update(
                ProfileUpdateInput {
                    user: "u1".into(),
                    bio: "New bio".into(),
                    image: "new.png".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .get(ProfileGetInput { user: "u1".into() }, &storage)
            .await
            .unwrap();

        match result {
            ProfileGetOutput::Ok { bio, image, .. } => {
                assert_eq!(bio, "New bio");
                assert_eq!(image, "new.png");
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
