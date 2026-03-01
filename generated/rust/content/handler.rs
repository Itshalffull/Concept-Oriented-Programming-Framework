// generated: content/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ContentHandler: Send + Sync {
    async fn store(
        &self,
        input: ContentStoreInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentStoreOutput, Box<dyn std::error::Error>>;

    async fn pin(
        &self,
        input: ContentPinInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentPinOutput, Box<dyn std::error::Error>>;

    async fn unpin(
        &self,
        input: ContentUnpinInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentUnpinOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: ContentResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentResolveOutput, Box<dyn std::error::Error>>;

}
