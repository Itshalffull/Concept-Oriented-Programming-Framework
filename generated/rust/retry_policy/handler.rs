// generated: retry_policy/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RetryPolicyHandler: Send + Sync {
    async fn create(
        &self,
        input: RetryPolicyCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetryPolicyCreateOutput, Box<dyn std::error::Error>>;

    async fn should_retry(
        &self,
        input: RetryPolicyShouldRetryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetryPolicyShouldRetryOutput, Box<dyn std::error::Error>>;

    async fn record_attempt(
        &self,
        input: RetryPolicyRecordAttemptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetryPolicyRecordAttemptOutput, Box<dyn std::error::Error>>;

    async fn mark_succeeded(
        &self,
        input: RetryPolicyMarkSucceededInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetryPolicyMarkSucceededOutput, Box<dyn std::error::Error>>;
}
