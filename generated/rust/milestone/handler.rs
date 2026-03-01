// generated: milestone/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MilestoneHandler: Send + Sync {
    async fn define(
        &self,
        input: MilestoneDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MilestoneDefineOutput, Box<dyn std::error::Error>>;

    async fn evaluate(
        &self,
        input: MilestoneEvaluateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MilestoneEvaluateOutput, Box<dyn std::error::Error>>;

    async fn revoke(
        &self,
        input: MilestoneRevokeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MilestoneRevokeOutput, Box<dyn std::error::Error>>;
}
