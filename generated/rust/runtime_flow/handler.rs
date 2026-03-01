// generated: runtime_flow/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RuntimeFlowHandler: Send + Sync {
    async fn correlate(
        &self,
        input: RuntimeFlowCorrelateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowCorrelateOutput, Box<dyn std::error::Error>>;

    async fn find_by_action(
        &self,
        input: RuntimeFlowFindByActionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowFindByActionOutput, Box<dyn std::error::Error>>;

    async fn find_by_sync(
        &self,
        input: RuntimeFlowFindBySyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowFindBySyncOutput, Box<dyn std::error::Error>>;

    async fn find_by_variant(
        &self,
        input: RuntimeFlowFindByVariantInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowFindByVariantOutput, Box<dyn std::error::Error>>;

    async fn find_failures(
        &self,
        input: RuntimeFlowFindFailuresInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowFindFailuresOutput, Box<dyn std::error::Error>>;

    async fn compare_to_static(
        &self,
        input: RuntimeFlowCompareToStaticInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowCompareToStaticOutput, Box<dyn std::error::Error>>;

    async fn source_locations(
        &self,
        input: RuntimeFlowSourceLocationsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowSourceLocationsOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: RuntimeFlowGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeFlowGetOutput, Box<dyn std::error::Error>>;

}
