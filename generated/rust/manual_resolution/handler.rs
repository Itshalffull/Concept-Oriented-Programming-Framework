// generated: manual_resolution/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ManualResolutionHandler: Send + Sync {
    async fn register(
        &self,
        input: ManualResolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ManualResolutionRegisterOutput, Box<dyn std::error::Error>>;

    async fn attempt_resolve(
        &self,
        input: ManualResolutionAttemptResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ManualResolutionAttemptResolveOutput, Box<dyn std::error::Error>>;

}
