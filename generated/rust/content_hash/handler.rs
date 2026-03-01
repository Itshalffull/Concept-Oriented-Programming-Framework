// generated: content_hash/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ContentHashHandler: Send + Sync {
    async fn store(
        &self,
        input: ContentHashStoreInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentHashStoreOutput, Box<dyn std::error::Error>>;

    async fn retrieve(
        &self,
        input: ContentHashRetrieveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentHashRetrieveOutput, Box<dyn std::error::Error>>;

    async fn verify(
        &self,
        input: ContentHashVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentHashVerifyOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: ContentHashDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ContentHashDeleteOutput, Box<dyn std::error::Error>>;

}
