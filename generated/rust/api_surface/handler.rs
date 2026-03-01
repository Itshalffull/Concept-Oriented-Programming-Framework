// generated: api_surface/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ApiSurfaceHandler: Send + Sync {
    async fn compose(
        &self,
        input: ApiSurfaceComposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApiSurfaceComposeOutput, Box<dyn std::error::Error>>;

    async fn entrypoint(
        &self,
        input: ApiSurfaceEntrypointInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ApiSurfaceEntrypointOutput, Box<dyn std::error::Error>>;

}
