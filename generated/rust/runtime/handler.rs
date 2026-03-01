// generated: runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: RuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: RuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: RuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: RuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: RuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeDestroyOutput, Box<dyn std::error::Error>>;

    async fn health_check(
        &self,
        input: RuntimeHealthCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeHealthCheckOutput, Box<dyn std::error::Error>>;

}
