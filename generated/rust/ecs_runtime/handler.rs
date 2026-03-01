// generated: ecs_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait EcsRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: EcsRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: EcsRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: EcsRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: EcsRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: EcsRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EcsRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
