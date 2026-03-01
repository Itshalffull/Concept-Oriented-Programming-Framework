// generated: local_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait LocalRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: LocalRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: LocalRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: LocalRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: LocalRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: LocalRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
