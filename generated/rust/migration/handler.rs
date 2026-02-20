// generated: migration/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MigrationHandler: Send + Sync {
    async fn check(
        &self,
        input: MigrationCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationCheckOutput, Box<dyn std::error::Error>>;

    async fn complete(
        &self,
        input: MigrationCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationCompleteOutput, Box<dyn std::error::Error>>;

}
