// generated: outline/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait OutlineHandler: Send + Sync {
    async fn create(
        &self,
        input: OutlineCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineCreateOutput, Box<dyn std::error::Error>>;

    async fn indent(
        &self,
        input: OutlineIndentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineIndentOutput, Box<dyn std::error::Error>>;

    async fn outdent(
        &self,
        input: OutlineOutdentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineOutdentOutput, Box<dyn std::error::Error>>;

    async fn move_up(
        &self,
        input: OutlineMoveUpInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineMoveUpOutput, Box<dyn std::error::Error>>;

    async fn move_down(
        &self,
        input: OutlineMoveDownInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineMoveDownOutput, Box<dyn std::error::Error>>;

    async fn collapse(
        &self,
        input: OutlineCollapseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineCollapseOutput, Box<dyn std::error::Error>>;

    async fn expand(
        &self,
        input: OutlineExpandInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineExpandOutput, Box<dyn std::error::Error>>;

    async fn reparent(
        &self,
        input: OutlineReparentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineReparentOutput, Box<dyn std::error::Error>>;

    async fn get_children(
        &self,
        input: OutlineGetChildrenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<OutlineGetChildrenOutput, Box<dyn std::error::Error>>;

}
