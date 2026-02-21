// generated: cache/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait CacheHandler: Send + Sync {
    async fn set(
        &self,
        input: CacheSetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CacheSetOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: CacheGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CacheGetOutput, Box<dyn std::error::Error>>;

    async fn invalidate(
        &self,
        input: CacheInvalidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CacheInvalidateOutput, Box<dyn std::error::Error>>;

    async fn invalidate_by_tags(
        &self,
        input: CacheInvalidateByTagsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<CacheInvalidateByTagsOutput, Box<dyn std::error::Error>>;

}
