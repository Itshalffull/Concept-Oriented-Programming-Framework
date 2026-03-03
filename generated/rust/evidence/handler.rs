// generated: evidence/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EvidenceHandler: Send + Sync {
    async fn record(
        &self,
        input: EvidenceRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvidenceRecordOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: EvidenceValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvidenceValidateOutput, Box<dyn std::error::Error>>;

    async fn retrieve(
        &self,
        input: EvidenceRetrieveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvidenceRetrieveOutput, Box<dyn std::error::Error>>;

    async fn compare(
        &self,
        input: EvidenceCompareInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvidenceCompareOutput, Box<dyn std::error::Error>>;

    async fn minimize(
        &self,
        input: EvidenceMinimizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvidenceMinimizeOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: EvidenceListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EvidenceListOutput, Box<dyn std::error::Error>>;

}