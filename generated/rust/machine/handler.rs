// generated: machine/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait MachineHandler: Send + Sync {
    async fn spawn(
        &self,
        input: MachineSpawnInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineSpawnOutput, Box<dyn std::error::Error>>;

    async fn send(
        &self,
        input: MachineSendInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineSendOutput, Box<dyn std::error::Error>>;

    async fn connect(
        &self,
        input: MachineConnectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineConnectOutput, Box<dyn std::error::Error>>;

    async fn destroy(
        &self,
        input: MachineDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MachineDestroyOutput, Box<dyn std::error::Error>>;

}
