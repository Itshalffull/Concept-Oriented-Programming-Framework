// generated: add_wins_resolution/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait AddWinsResolutionHandler: Send + Sync {
    async fn register(
        &self,
        input: AddWinsResolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AddWinsResolutionRegisterOutput, Box<dyn std::error::Error>>;

    async fn attempt_resolve(
        &self,
        input: AddWinsResolutionAttemptResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<AddWinsResolutionAttemptResolveOutput, Box<dyn std::error::Error>>;

}
