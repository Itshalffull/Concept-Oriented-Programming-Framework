// generated: multi_value_resolution/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MultiValueResolutionHandler: Send + Sync {
    async fn register(
        &self,
        input: MultiValueResolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MultiValueResolutionRegisterOutput, Box<dyn std::error::Error>>;

    async fn attempt_resolve(
        &self,
        input: MultiValueResolutionAttemptResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MultiValueResolutionAttemptResolveOutput, Box<dyn std::error::Error>>;

}
