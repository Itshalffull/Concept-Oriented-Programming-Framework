// generated: type_system/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TypeSystemHandler: Send + Sync {
    async fn register_type(
        &self,
        input: TypeSystemRegisterTypeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemRegisterTypeOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: TypeSystemResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemResolveOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: TypeSystemValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemValidateOutput, Box<dyn std::error::Error>>;

    async fn navigate(
        &self,
        input: TypeSystemNavigateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemNavigateOutput, Box<dyn std::error::Error>>;

    async fn serialize(
        &self,
        input: TypeSystemSerializeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TypeSystemSerializeOutput, Box<dyn std::error::Error>>;

}
