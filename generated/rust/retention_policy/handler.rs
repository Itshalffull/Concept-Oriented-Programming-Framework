// generated: retention_policy/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RetentionPolicyHandler: Send + Sync {
    async fn set_retention(
        &self,
        input: RetentionPolicySetRetentionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicySetRetentionOutput, Box<dyn std::error::Error>>;

    async fn apply_hold(
        &self,
        input: RetentionPolicyApplyHoldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyApplyHoldOutput, Box<dyn std::error::Error>>;

    async fn release_hold(
        &self,
        input: RetentionPolicyReleaseHoldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyReleaseHoldOutput, Box<dyn std::error::Error>>;

    async fn check_disposition(
        &self,
        input: RetentionPolicyCheckDispositionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyCheckDispositionOutput, Box<dyn std::error::Error>>;

    async fn dispose(
        &self,
        input: RetentionPolicyDisposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyDisposeOutput, Box<dyn std::error::Error>>;

    async fn audit_log(
        &self,
        input: RetentionPolicyAuditLogInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyAuditLogOutput, Box<dyn std::error::Error>>;

}
