// generated: session/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SessionHandler: Send + Sync {
    async fn create(
        &self,
        input: SessionCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionCreateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: SessionValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionValidateOutput, Box<dyn std::error::Error>>;

    async fn refresh(
        &self,
        input: SessionRefreshInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionRefreshOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: SessionDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionDestroyOutput, Box<dyn std::error::Error>>;

    async fn destroy_all(
        &self,
        input: SessionDestroyAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionDestroyAllOutput, Box<dyn std::error::Error>>;

    async fn get_context(
        &self,
        input: SessionGetContextInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SessionGetContextOutput, Box<dyn std::error::Error>>;

}
