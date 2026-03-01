// generated: element/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ElementHandler: Send + Sync {
    async fn create(
        &self,
        input: ElementCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementCreateOutput, Box<dyn std::error::Error>>;

    async fn nest(
        &self,
        input: ElementNestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementNestOutput, Box<dyn std::error::Error>>;

    async fn set_constraints(
        &self,
        input: ElementSetConstraintsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementSetConstraintsOutput, Box<dyn std::error::Error>>;

    async fn enrich(
        &self,
        input: ElementEnrichInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementEnrichOutput, Box<dyn std::error::Error>>;

    async fn assign_widget(
        &self,
        input: ElementAssignWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementAssignWidgetOutput, Box<dyn std::error::Error>>;

    async fn remove(
        &self,
        input: ElementRemoveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ElementRemoveOutput, Box<dyn std::error::Error>>;

}
