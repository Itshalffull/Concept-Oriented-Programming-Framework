// generated: structural_pattern/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait StructuralPatternHandler: Send + Sync {
    async fn create(
        &self,
        input: StructuralPatternCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StructuralPatternCreateOutput, Box<dyn std::error::Error>>;

    async fn match(
        &self,
        input: StructuralPatternMatchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StructuralPatternMatchOutput, Box<dyn std::error::Error>>;

    async fn match_project(
        &self,
        input: StructuralPatternMatchProjectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<StructuralPatternMatchProjectOutput, Box<dyn std::error::Error>>;

}
