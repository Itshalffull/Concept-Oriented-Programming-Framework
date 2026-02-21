// generated: property/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PropertyHandler: Send + Sync {
    async fn set(
        &self,
        input: PropertySetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertySetOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: PropertyGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertyGetOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: PropertyDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertyDeleteOutput, Box<dyn std::error::Error>>;

    async fn define_type(
        &self,
        input: PropertyDefineTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertyDefineTypeOutput, Box<dyn std::error::Error>>;

    async fn list_all(
        &self,
        input: PropertyListAllInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PropertyListAllOutput, Box<dyn std::error::Error>>;

}
