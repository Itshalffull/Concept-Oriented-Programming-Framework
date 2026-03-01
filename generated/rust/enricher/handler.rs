// generated: enricher/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EnricherHandler: Send + Sync {
    async fn enrich(
        &self,
        input: EnricherEnrichInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherEnrichOutput, Box<dyn std::error::Error>>;

    async fn suggest(
        &self,
        input: EnricherSuggestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherSuggestOutput, Box<dyn std::error::Error>>;

    async fn accept(
        &self,
        input: EnricherAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherAcceptOutput, Box<dyn std::error::Error>>;

    async fn reject(
        &self,
        input: EnricherRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherRejectOutput, Box<dyn std::error::Error>>;

    async fn refresh_stale(
        &self,
        input: EnricherRefreshStaleInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EnricherRefreshStaleOutput, Box<dyn std::error::Error>>;

}
