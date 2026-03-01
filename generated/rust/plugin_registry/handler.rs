// generated: plugin_registry/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PluginRegistryHandler: Send + Sync {
    async fn register(
        &self,
        input: PluginRegistryRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryRegisterOutput, Box<dyn std::error::Error>>;

    async fn discover(
        &self,
        input: PluginRegistryDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryDiscoverOutput, Box<dyn std::error::Error>>;

    async fn create_instance(
        &self,
        input: PluginRegistryCreateInstanceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryCreateInstanceOutput, Box<dyn std::error::Error>>;

    async fn get_definitions(
        &self,
        input: PluginRegistryGetDefinitionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryGetDefinitionsOutput, Box<dyn std::error::Error>>;

    async fn alter_definitions(
        &self,
        input: PluginRegistryAlterDefinitionsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryAlterDefinitionsOutput, Box<dyn std::error::Error>>;

    async fn derive_plugins(
        &self,
        input: PluginRegistryDerivePluginsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PluginRegistryDerivePluginsOutput, Box<dyn std::error::Error>>;

}
