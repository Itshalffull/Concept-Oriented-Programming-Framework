// generated: conflict_resolution/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConflictResolutionHandler: Send + Sync {
    async fn register_policy(
        &self,
        input: ConflictResolutionRegisterPolicyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConflictResolutionRegisterPolicyOutput, Box<dyn std::error::Error>>;

    async fn detect(
        &self,
        input: ConflictResolutionDetectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConflictResolutionDetectOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: ConflictResolutionResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConflictResolutionResolveOutput, Box<dyn std::error::Error>>;

    async fn manual_resolve(
        &self,
        input: ConflictResolutionManualResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConflictResolutionManualResolveOutput, Box<dyn std::error::Error>>;

}
