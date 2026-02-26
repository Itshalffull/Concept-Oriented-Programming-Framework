// Follow Concept Implementation (Rust)
//
// Mirrors the TypeScript follow.impl.ts — follow, unfollow, is_following actions.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FollowFollowInput {
    pub user: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FollowFollowOutput {
    #[serde(rename = "ok")]
    Ok { user: String, target: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FollowUnfollowInput {
    pub user: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FollowUnfollowOutput {
    #[serde(rename = "ok")]
    Ok { user: String, target: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FollowIsFollowingInput {
    pub user: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FollowIsFollowingOutput {
    #[serde(rename = "ok")]
    Ok { following: bool },
}

// ── Handler ────────────────────────────────────────────────

pub struct FollowHandler;

impl FollowHandler {
    fn parse_following(record: &serde_json::Value) -> Vec<String> {
        record["following"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub async fn follow(
        &self,
        input: FollowFollowInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FollowFollowOutput> {
        let existing = storage.get("follow", &input.user).await?;

        let mut following = match &existing {
            Some(record) => Self::parse_following(record),
            None => vec![],
        };

        if !following.contains(&input.target) {
            following.push(input.target.clone());
        }

        storage
            .put(
                "follow",
                &input.user,
                json!({ "user": input.user, "following": following }),
            )
            .await?;

        Ok(FollowFollowOutput::Ok {
            user: input.user,
            target: input.target,
        })
    }

    pub async fn unfollow(
        &self,
        input: FollowUnfollowInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FollowUnfollowOutput> {
        let existing = storage.get("follow", &input.user).await?;

        if let Some(record) = existing {
            let following: Vec<String> = Self::parse_following(&record)
                .into_iter()
                .filter(|t| t != &input.target)
                .collect();

            storage
                .put(
                    "follow",
                    &input.user,
                    json!({ "user": input.user, "following": following }),
                )
                .await?;
        }

        Ok(FollowUnfollowOutput::Ok {
            user: input.user,
            target: input.target,
        })
    }

    pub async fn is_following(
        &self,
        input: FollowIsFollowingInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FollowIsFollowingOutput> {
        let existing = storage.get("follow", &input.user).await?;

        let following = match &existing {
            Some(record) => Self::parse_following(record),
            None => vec![],
        };

        Ok(FollowIsFollowingOutput::Ok {
            following: following.contains(&input.target),
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn follow_and_is_following() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandler;

        handler
            .follow(
                FollowFollowInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .is_following(
                FollowIsFollowingInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            FollowIsFollowingOutput::Ok { following } if following
        ));
    }

    #[tokio::test]
    async fn unfollow() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandler;

        handler
            .follow(
                FollowFollowInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .unfollow(
                FollowUnfollowInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .is_following(
                FollowIsFollowingInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            FollowIsFollowingOutput::Ok { following } if !following
        ));
    }

    #[tokio::test]
    async fn follow_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandler;

        handler
            .follow(
                FollowFollowInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .follow(
                FollowFollowInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // Check the storage directly — should only have one entry
        let record = storage.get("follow", "alice").await.unwrap().unwrap();
        let following = record["following"].as_array().unwrap();
        assert_eq!(following.len(), 1);
    }

    #[tokio::test]
    async fn is_following_when_not() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandler;

        let result = handler
            .is_following(
                FollowIsFollowingInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            FollowIsFollowingOutput::Ok { following } if !following
        ));
    }

    #[tokio::test]
    async fn follow_multiple_targets() {
        let storage = InMemoryStorage::new();
        let handler = FollowHandler;

        handler
            .follow(
                FollowFollowInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .follow(
                FollowFollowInput {
                    user: "alice".into(),
                    target: "carol".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let record = storage.get("follow", "alice").await.unwrap().unwrap();
        let following = record["following"].as_array().unwrap();
        assert_eq!(following.len(), 2);

        // Check individual follows
        let is_bob = handler
            .is_following(
                FollowIsFollowingInput {
                    user: "alice".into(),
                    target: "bob".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(
            is_bob,
            FollowIsFollowingOutput::Ok { following } if following
        ));

        let is_carol = handler
            .is_following(
                FollowIsFollowingInput {
                    user: "alice".into(),
                    target: "carol".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(
            is_carol,
            FollowIsFollowingOutput::Ok { following } if following
        ));
    }
}
