// generated: verification_run/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait VerificationRunHandler: Send + Sync {
    async fn start(
        &self,
        input: VerificationRunStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VerificationRunStartOutput, Box<dyn std::error::Error>>;

    async fn complete(
        &self,
        input: VerificationRunCompleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VerificationRunCompleteOutput, Box<dyn std::error::Error>>;

    async fn timeout(
        &self,
        input: VerificationRunTimeoutInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VerificationRunTimeoutOutput, Box<dyn std::error::Error>>;

    async fn cancel(
        &self,
        input: VerificationRunCancelInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VerificationRunCancelOutput, Box<dyn std::error::Error>>;

    async fn get_status(
        &self,
        input: VerificationRunGet_statusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VerificationRunGet_statusOutput, Box<dyn std::error::Error>>;

    async fn compare(
        &self,
        input: VerificationRunCompareInput,
        storage: &dyn ConceptStorage,
    ) -> Result<VerificationRunCompareOutput, Box<dyn std::error::Error>>;

}