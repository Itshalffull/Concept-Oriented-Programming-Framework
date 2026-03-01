// generated: migration/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MigrationHandler: Send + Sync {
    async fn plan(
        &self,
        input: MigrationPlanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationPlanOutput, Box<dyn std::error::Error>>;

    async fn expand(
        &self,
        input: MigrationExpandInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationExpandOutput, Box<dyn std::error::Error>>;

    async fn migrate(
        &self,
        input: MigrationMigrateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationMigrateOutput, Box<dyn std::error::Error>>;

    async fn contract(
        &self,
        input: MigrationContractInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationContractOutput, Box<dyn std::error::Error>>;

    async fn status(
        &self,
        input: MigrationStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationStatusOutput, Box<dyn std::error::Error>>;

}
