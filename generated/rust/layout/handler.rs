// generated: layout/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait LayoutHandler: Send + Sync {
    async fn create(
        &self,
        input: LayoutCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutCreateOutput, Box<dyn std::error::Error>>;

    async fn configure(
        &self,
        input: LayoutConfigureInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutConfigureOutput, Box<dyn std::error::Error>>;

    async fn nest(
        &self,
        input: LayoutNestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutNestOutput, Box<dyn std::error::Error>>;

    async fn set_responsive(
        &self,
        input: LayoutSetResponsiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutSetResponsiveOutput, Box<dyn std::error::Error>>;

    async fn remove(
        &self,
        input: LayoutRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LayoutRemoveOutput, Box<dyn std::error::Error>>;

}
