// generated: middleware/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MiddlewareHandler: Send + Sync {
    async fn resolve(
        &self,
        input: MiddlewareResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MiddlewareResolveOutput, Box<dyn std::error::Error>>;

    async fn inject(
        &self,
        input: MiddlewareInjectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MiddlewareInjectOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: MiddlewareRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MiddlewareRegisterOutput, Box<dyn std::error::Error>>;

}
