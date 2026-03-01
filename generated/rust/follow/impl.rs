// Follow concept implementation
// User follow/unfollow relationship management.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FollowHandler;
use serde_json::json;

pub struct FollowHandlerImpl;

#[async_trait]
impl FollowHandler for FollowHandlerImpl {
    async fn follow(
        &self,
        input: FollowFollowInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FollowFollowOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("follow", &input.user).await?;
        let mut following: Vec<String> = existing
            .as_ref()
            .and_then(|e| e.get("following"))
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        if !following.contains(&input.target) {
            following.push(input.target.clone());
        }

        storage.put("follow", &input.user, json!({
            "user": input.user,
            "following": following,
        })).await?;

        Ok(FollowFollowOutput::Ok {
            user: input.user,
            target: input.target,
        })
    }

    async fn unfollow(
        &self,
        input: FollowUnfollowInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FollowUnfollowOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("follow", &input.user).await?;
        if let Some(record) = existing {
            let mut following: Vec<String> = record
                .get("following")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            following.retain(|t| t != &input.target);
            storage.put("follow", &input.user, json!({
                "user": input.user,
                "following": following,
            })).await?;
        }

        Ok(FollowUnfollowOutput::Ok {
            user: input.user,
            target: input.target,
        })
    }

    async fn is_following(
        &self,
        input: FollowIsFollowingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FollowIsFollowingOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("follow", &input.user).await?;
        let following: Vec<String> = existing
            .as_ref()
            .and_then(|e| e.get("following"))
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        Ok(FollowIsFollowingOutput::Ok {
            following: following.contains(&input.target),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_follow_success() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandlerImpl;
        let result = handler.follow(
            FollowFollowInput {
                user: "alice".to_string(),
                target: "bob".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FollowFollowOutput::Ok { user, target } => {
                assert_eq!(user, "alice");
                assert_eq!(target, "bob");
            },
        }
    }

    #[tokio::test]
    async fn test_unfollow_success() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandlerImpl;
        handler.follow(
            FollowFollowInput { user: "alice".to_string(), target: "bob".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.unfollow(
            FollowUnfollowInput { user: "alice".to_string(), target: "bob".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FollowUnfollowOutput::Ok { user, target } => {
                assert_eq!(user, "alice");
                assert_eq!(target, "bob");
            },
        }
    }

    #[tokio::test]
    async fn test_is_following_true() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandlerImpl;
        handler.follow(
            FollowFollowInput { user: "alice".to_string(), target: "bob".to_string() },
            &storage,
        ).await.unwrap();
        let result = handler.is_following(
            FollowIsFollowingInput { user: "alice".to_string(), target: "bob".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FollowIsFollowingOutput::Ok { following } => {
                assert!(following);
            },
        }
    }

    #[tokio::test]
    async fn test_is_following_false() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandlerImpl;
        let result = handler.is_following(
            FollowIsFollowingInput { user: "alice".to_string(), target: "charlie".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            FollowIsFollowingOutput::Ok { following } => {
                assert!(!following);
            },
        }
    }
}
