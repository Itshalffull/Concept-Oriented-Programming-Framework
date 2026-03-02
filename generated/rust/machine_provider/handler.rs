// generated: machine_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MachineProviderHandler: Send + Sync {
    async fn initialize(
        &self,
        input: MachineProviderInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderInitializeOutput, Box<dyn std::error::Error>>;

    async fn spawn(
        &self,
        input: MachineProviderSpawnInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderSpawnOutput, Box<dyn std::error::Error>>;

    async fn send(
        &self,
        input: MachineProviderSendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderSendOutput, Box<dyn std::error::Error>>;

    async fn connect(
        &self,
        input: MachineProviderConnectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderConnectOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: MachineProviderDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineProviderDestroyOutput, Box<dyn std::error::Error>>;
}
