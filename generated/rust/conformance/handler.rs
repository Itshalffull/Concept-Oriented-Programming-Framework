// generated: conformance/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ConformanceHandler: Send + Sync {
    async fn generate(
        &self,
        input: ConformanceGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConformanceGenerateOutput, Box<dyn std::error::Error>>;

    async fn verify(
        &self,
        input: ConformanceVerifyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConformanceVerifyOutput, Box<dyn std::error::Error>>;

    async fn register_deviation(
        &self,
        input: ConformanceRegisterDeviationInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConformanceRegisterDeviationOutput, Box<dyn std::error::Error>>;

    async fn matrix(
        &self,
        input: ConformanceMatrixInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConformanceMatrixOutput, Box<dyn std::error::Error>>;

    async fn traceability(
        &self,
        input: ConformanceTraceabilityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ConformanceTraceabilityOutput, Box<dyn std::error::Error>>;

}
