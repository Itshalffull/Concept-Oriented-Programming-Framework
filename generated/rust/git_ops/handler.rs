// generated: git_ops/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait GitOpsHandler: Send + Sync {
    async fn emit(
        &self,
        input: GitOpsEmitInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GitOpsEmitOutput, Box<dyn std::error::Error>>;

    async fn reconciliation_status(
        &self,
        input: GitOpsReconciliationStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<GitOpsReconciliationStatusOutput, Box<dyn std::error::Error>>;

}
