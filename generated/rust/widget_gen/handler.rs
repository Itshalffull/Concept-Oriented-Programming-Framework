// generated: widget_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait WidgetGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: WidgetGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<WidgetGenGenerateOutput, Box<dyn std::error::Error>>;

}
