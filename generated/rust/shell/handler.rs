// generated: shell/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ShellHandler: Send + Sync {
    async fn initialize(
        &self,
        input: ShellInitializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellInitializeOutput, Box<dyn std::error::Error>>;

    async fn assign_to_zone(
        &self,
        input: ShellAssignToZoneInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellAssignToZoneOutput, Box<dyn std::error::Error>>;

    async fn clear_zone(
        &self,
        input: ShellClearZoneInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellClearZoneOutput, Box<dyn std::error::Error>>;

    async fn push_overlay(
        &self,
        input: ShellPushOverlayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellPushOverlayOutput, Box<dyn std::error::Error>>;

    async fn pop_overlay(
        &self,
        input: ShellPopOverlayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ShellPopOverlayOutput, Box<dyn std::error::Error>>;

}
