// generated: l_w_w_resolution/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait LWWResolutionHandler: Send + Sync {
    async fn register(
        &self,
        input: LWWResolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LWWResolutionRegisterOutput, Box<dyn std::error::Error>>;

    async fn attempt_resolve(
        &self,
        input: LWWResolutionAttemptResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LWWResolutionAttemptResolveOutput, Box<dyn std::error::Error>>;

}
