// generated: secret/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SecretHandler: Send + Sync {
    async fn resolve(
        &self,
        input: SecretResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SecretResolveOutput, Box<dyn std::error::Error>>;

    async fn exists(
        &self,
        input: SecretExistsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SecretExistsOutput, Box<dyn std::error::Error>>;

    async fn rotate(
        &self,
        input: SecretRotateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SecretRotateOutput, Box<dyn std::error::Error>>;

    async fn invalidate_cache(
        &self,
        input: SecretInvalidateCacheInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SecretInvalidateCacheOutput, Box<dyn std::error::Error>>;

}
