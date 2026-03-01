// generated: flaky_test/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FlakyTestHandler: Send + Sync {
    async fn record(
        &self,
        input: FlakyTestRecordInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestRecordOutput, Box<dyn std::error::Error>>;

    async fn quarantine(
        &self,
        input: FlakyTestQuarantineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestQuarantineOutput, Box<dyn std::error::Error>>;

    async fn release(
        &self,
        input: FlakyTestReleaseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestReleaseOutput, Box<dyn std::error::Error>>;

    async fn is_quarantined(
        &self,
        input: FlakyTestIsQuarantinedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestIsQuarantinedOutput, Box<dyn std::error::Error>>;

    async fn report(
        &self,
        input: FlakyTestReportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestReportOutput, Box<dyn std::error::Error>>;

    async fn set_policy(
        &self,
        input: FlakyTestSetPolicyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FlakyTestSetPolicyOutput, Box<dyn std::error::Error>>;

}
