// generated: component/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ComponentHandler: Send + Sync {
    async fn register(
        &self,
        input: ComponentRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentRegisterOutput, Box<dyn std::error::Error>>;

    async fn render(
        &self,
        input: ComponentRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentRenderOutput, Box<dyn std::error::Error>>;

    async fn place(
        &self,
        input: ComponentPlaceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentPlaceOutput, Box<dyn std::error::Error>>;

    async fn set_visibility(
        &self,
        input: ComponentSetVisibilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentSetVisibilityOutput, Box<dyn std::error::Error>>;

    async fn evaluate_visibility(
        &self,
        input: ComponentEvaluateVisibilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ComponentEvaluateVisibilityOutput, Box<dyn std::error::Error>>;

}
