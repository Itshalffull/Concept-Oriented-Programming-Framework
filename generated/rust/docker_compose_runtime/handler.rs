// generated: docker_compose_runtime/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DockerComposeRuntimeHandler: Send + Sync {
    async fn provision(
        &self,
        input: DockerComposeRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeProvisionOutput, Box<dyn std::error::Error>>;

    async fn deploy(
        &self,
        input: DockerComposeRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeDeployOutput, Box<dyn std::error::Error>>;

    async fn set_traffic_weight(
        &self,
        input: DockerComposeRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>>;

    async fn rollback(
        &self,
        input: DockerComposeRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeRollbackOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: DockerComposeRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DockerComposeRuntimeDestroyOutput, Box<dyn std::error::Error>>;

}
