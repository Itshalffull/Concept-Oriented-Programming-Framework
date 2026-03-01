// generated: provenance/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ProvenanceHandler: Send + Sync {
    async fn record(
        &self,
        input: ProvenanceRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceRecordOutput, Box<dyn std::error::Error>>;

    async fn trace(
        &self,
        input: ProvenanceTraceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceTraceOutput, Box<dyn std::error::Error>>;

    async fn audit(
        &self,
        input: ProvenanceAuditInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceAuditOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: ProvenanceRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceRollbackOutput, Box<dyn std::error::Error>>;

    async fn diff(
        &self,
        input: ProvenanceDiffInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceDiffOutput, Box<dyn std::error::Error>>;

    async fn reproduce(
        &self,
        input: ProvenanceReproduceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ProvenanceReproduceOutput, Box<dyn std::error::Error>>;

}
