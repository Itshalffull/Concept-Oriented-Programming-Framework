// generated: exposed_filter/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ExposedFilterHandler: Send + Sync {
    async fn expose(
        &self,
        input: ExposedFilterExposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExposedFilterExposeOutput, Box<dyn std::error::Error>>;

    async fn collect_input(
        &self,
        input: ExposedFilterCollectInputInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExposedFilterCollectInputOutput, Box<dyn std::error::Error>>;

    async fn apply_to_query(
        &self,
        input: ExposedFilterApplyToQueryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExposedFilterApplyToQueryOutput, Box<dyn std::error::Error>>;

    async fn reset_to_defaults(
        &self,
        input: ExposedFilterResetToDefaultsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ExposedFilterResetToDefaultsOutput, Box<dyn std::error::Error>>;

}
