// generated: registry/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait RegistryHandler: Send + Sync {
    async fn register(
        &self,
        input: RegistryRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RegistryRegisterOutput, Box<dyn std::error::Error>>;

    async fn deregister(
        &self,
        input: RegistryDeregisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RegistryDeregisterOutput, Box<dyn std::error::Error>>;

    async fn heartbeat(
        &self,
        input: RegistryHeartbeatInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RegistryHeartbeatOutput, Box<dyn std::error::Error>>;

}
