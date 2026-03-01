// generated: temporal_version/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TemporalVersionHandler: Send + Sync {
    async fn record(
        &self,
        input: TemporalVersionRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionRecordOutput, Box<dyn std::error::Error>>;

    async fn as_of(
        &self,
        input: TemporalVersionAsOfInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionAsOfOutput, Box<dyn std::error::Error>>;

    async fn between(
        &self,
        input: TemporalVersionBetweenInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionBetweenOutput, Box<dyn std::error::Error>>;

    async fn current(
        &self,
        input: TemporalVersionCurrentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionCurrentOutput, Box<dyn std::error::Error>>;

    async fn supersede(
        &self,
        input: TemporalVersionSupersedeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemporalVersionSupersedeOutput, Box<dyn std::error::Error>>;

}
