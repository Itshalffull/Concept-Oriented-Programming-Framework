// generated: relation/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RelationHandler: Send + Sync {
    async fn define_relation(
        &self,
        input: RelationDefineRelationInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationDefineRelationOutput, Box<dyn std::error::Error>>;

    async fn link(
        &self,
        input: RelationLinkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationLinkOutput, Box<dyn std::error::Error>>;

    async fn unlink(
        &self,
        input: RelationUnlinkInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationUnlinkOutput, Box<dyn std::error::Error>>;

    async fn get_related(
        &self,
        input: RelationGetRelatedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationGetRelatedOutput, Box<dyn std::error::Error>>;

    async fn define_rollup(
        &self,
        input: RelationDefineRollupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationDefineRollupOutput, Box<dyn std::error::Error>>;

    async fn compute_rollup(
        &self,
        input: RelationComputeRollupInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RelationComputeRollupOutput, Box<dyn std::error::Error>>;

}
