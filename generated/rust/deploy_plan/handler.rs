// generated: deploy_plan/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DeployPlanHandler: Send + Sync {
    async fn plan(
        &self,
        input: DeployPlanPlanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanPlanOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: DeployPlanValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanValidateOutput, Box<dyn std::error::Error>>;

    async fn execute(
        &self,
        input: DeployPlanExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanExecuteOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: DeployPlanRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanRollbackOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: DeployPlanStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanStatusOutput, Box<dyn std::error::Error>>;

}
