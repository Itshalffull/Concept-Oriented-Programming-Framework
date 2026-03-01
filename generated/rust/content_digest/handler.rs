// generated: content_digest/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ContentDigestHandler: Send + Sync {
    async fn compute(
        &self,
        input: ContentDigestComputeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentDigestComputeOutput, Box<dyn std::error::Error>>;

    async fn lookup(
        &self,
        input: ContentDigestLookupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentDigestLookupOutput, Box<dyn std::error::Error>>;

    async fn equivalent(
        &self,
        input: ContentDigestEquivalentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentDigestEquivalentOutput, Box<dyn std::error::Error>>;

}
