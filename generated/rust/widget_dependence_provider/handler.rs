// generated: widget_dependence_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetDependenceProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: WidgetDependenceProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetDependenceProviderInitializeOutput, Box<dyn std::error::Error>>;

}
