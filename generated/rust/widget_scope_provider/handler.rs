// generated: widget_scope_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetScopeProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: WidgetScopeProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetScopeProviderInitializeOutput, Box<dyn std::error::Error>>;

}
