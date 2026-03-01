// generated: widget_prop_entity/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetPropEntityHandler: Send + Sync {
    async fn register(
        &self,
        input: WidgetPropEntityRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetPropEntityRegisterOutput, Box<dyn std::error::Error>>;

    async fn find_by_widget(
        &self,
        input: WidgetPropEntityFindByWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetPropEntityFindByWidgetOutput, Box<dyn std::error::Error>>;

    async fn trace_to_field(
        &self,
        input: WidgetPropEntityTraceToFieldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetPropEntityTraceToFieldOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: WidgetPropEntityGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetPropEntityGetOutput, Box<dyn std::error::Error>>;

}
