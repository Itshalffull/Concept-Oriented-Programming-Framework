// generated: enrichment_renderer/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EnrichmentRendererHandler: Send + Sync {
    async fn register(
        &self,
        input: EnrichmentRendererRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnrichmentRendererRegisterOutput, Box<dyn std::error::Error>>;

    async fn render(
        &self,
        input: EnrichmentRendererRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnrichmentRendererRenderOutput, Box<dyn std::error::Error>>;

    async fn list_handlers(
        &self,
        input: EnrichmentRendererListHandlersInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnrichmentRendererListHandlersOutput, Box<dyn std::error::Error>>;

    async fn list_patterns(
        &self,
        input: EnrichmentRendererListPatternsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnrichmentRendererListPatternsOutput, Box<dyn std::error::Error>>;

}
