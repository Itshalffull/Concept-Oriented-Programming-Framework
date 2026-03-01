// generated: tool_registry/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ToolRegistryHandler: Send + Sync {
    async fn register(
        &self,
        input: ToolRegistryRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryRegisterOutput, Box<dyn std::error::Error>>;

    async fn deprecate(
        &self,
        input: ToolRegistryDeprecateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryDeprecateOutput, Box<dyn std::error::Error>>;

    async fn disable(
        &self,
        input: ToolRegistryDisableInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryDisableOutput, Box<dyn std::error::Error>>;

    async fn authorize(
        &self,
        input: ToolRegistryAuthorizeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryAuthorizeOutput, Box<dyn std::error::Error>>;

    async fn check_access(
        &self,
        input: ToolRegistryCheckAccessInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryCheckAccessOutput, Box<dyn std::error::Error>>;

    async fn list_active(
        &self,
        input: ToolRegistryListActiveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ToolRegistryListActiveOutput, Box<dyn std::error::Error>>;
}
