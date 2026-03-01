// generated: action_guide/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ActionGuideHandler: Send + Sync {
    async fn define(
        &self,
        input: ActionGuideDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionGuideDefineOutput, Box<dyn std::error::Error>>;

    async fn render(
        &self,
        input: ActionGuideRenderInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ActionGuideRenderOutput, Box<dyn std::error::Error>>;

}
