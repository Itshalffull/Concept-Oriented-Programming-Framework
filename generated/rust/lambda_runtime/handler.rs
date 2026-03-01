// generated: lambda_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait LambdaRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: LambdaRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: LambdaRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: LambdaRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: LambdaRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: LambdaRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
