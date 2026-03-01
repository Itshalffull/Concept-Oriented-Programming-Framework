// generated: view/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ViewHandler: Send + Sync {
    async fn create(
        &self,
        input: ViewCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewCreateOutput, Box<dyn std::error::Error>>;

    async fn set_filter(
        &self,
        input: ViewSetFilterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewSetFilterOutput, Box<dyn std::error::Error>>;

    async fn set_sort(
        &self,
        input: ViewSetSortInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewSetSortOutput, Box<dyn std::error::Error>>;

    async fn set_group(
        &self,
        input: ViewSetGroupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewSetGroupOutput, Box<dyn std::error::Error>>;

    async fn set_visible_fields(
        &self,
        input: ViewSetVisibleFieldsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewSetVisibleFieldsOutput, Box<dyn std::error::Error>>;

    async fn change_layout(
        &self,
        input: ViewChangeLayoutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewChangeLayoutOutput, Box<dyn std::error::Error>>;

    async fn duplicate(
        &self,
        input: ViewDuplicateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewDuplicateOutput, Box<dyn std::error::Error>>;

    async fn embed(
        &self,
        input: ViewEmbedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ViewEmbedOutput, Box<dyn std::error::Error>>;

}
