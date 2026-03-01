// generated: widget_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: WidgetEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: WidgetEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityGetOutput, Box<dyn std::error::Error>>;

    async fn find_by_affordance(
        &self,
        input: WidgetEntityFindByAffordanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityFindByAffordanceOutput, Box<dyn std::error::Error>>;

    async fn find_composing(
        &self,
        input: WidgetEntityFindComposingInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityFindComposingOutput, Box<dyn std::error::Error>>;

    async fn find_composed_by(
        &self,
        input: WidgetEntityFindComposedByInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityFindComposedByOutput, Box<dyn std::error::Error>>;

    async fn generated_components(
        &self,
        input: WidgetEntityGeneratedComponentsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityGeneratedComponentsOutput, Box<dyn std::error::Error>>;

    async fn accessibility_audit(
        &self,
        input: WidgetEntityAccessibilityAuditInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityAccessibilityAuditOutput, Box<dyn std::error::Error>>;

    async fn trace_to_concept(
        &self,
        input: WidgetEntityTraceToConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetEntityTraceToConceptOutput, Box<dyn std::error::Error>>;

}
