// generated: renderer/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RendererHandler: Send + Sync {
    async fn render(
        &self,
        input: RendererRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RendererRenderOutput, Box<dyn std::error::Error>>;

    async fn auto_placeholder(
        &self,
        input: RendererAutoPlaceholderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RendererAutoPlaceholderOutput, Box<dyn std::error::Error>>;

    async fn stream(
        &self,
        input: RendererStreamInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RendererStreamOutput, Box<dyn std::error::Error>>;

    async fn merge_cacheability(
        &self,
        input: RendererMergeCacheabilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RendererMergeCacheabilityOutput, Box<dyn std::error::Error>>;

}
