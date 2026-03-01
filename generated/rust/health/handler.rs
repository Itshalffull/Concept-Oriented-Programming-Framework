// generated: health/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait HealthHandler: Send + Sync {
    async fn check_concept(
        &self,
        input: HealthCheckConceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HealthCheckConceptOutput, Box<dyn std::error::Error>>;

    async fn check_sync(
        &self,
        input: HealthCheckSyncInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HealthCheckSyncOutput, Box<dyn std::error::Error>>;

    async fn check_kit(
        &self,
        input: HealthCheckKitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HealthCheckKitOutput, Box<dyn std::error::Error>>;

    async fn check_invariant(
        &self,
        input: HealthCheckInvariantInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HealthCheckInvariantOutput, Box<dyn std::error::Error>>;

}
