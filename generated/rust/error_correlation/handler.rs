// generated: error_correlation/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ErrorCorrelationHandler: Send + Sync {
    async fn record(
        &self,
        input: ErrorCorrelationRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationRecordOutput, Box<dyn std::error::Error>>;

    async fn find_by_entity(
        &self,
        input: ErrorCorrelationFindByEntityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationFindByEntityOutput, Box<dyn std::error::Error>>;

    async fn find_by_kind(
        &self,
        input: ErrorCorrelationFindByKindInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationFindByKindOutput, Box<dyn std::error::Error>>;

    async fn error_hotspots(
        &self,
        input: ErrorCorrelationErrorHotspotsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationErrorHotspotsOutput, Box<dyn std::error::Error>>;

    async fn root_cause(
        &self,
        input: ErrorCorrelationRootCauseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationRootCauseOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ErrorCorrelationGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ErrorCorrelationGetOutput, Box<dyn std::error::Error>>;

}
