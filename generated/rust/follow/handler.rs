// generated: follow/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FollowHandler: Send + Sync {
    async fn follow(
        &self,
        input: FollowFollowInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FollowFollowOutput, Box<dyn std::error::Error>>;

    async fn unfollow(
        &self,
        input: FollowUnfollowInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FollowUnfollowOutput, Box<dyn std::error::Error>>;

    async fn is_following(
        &self,
        input: FollowIsFollowingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FollowIsFollowingOutput, Box<dyn std::error::Error>>;

}
