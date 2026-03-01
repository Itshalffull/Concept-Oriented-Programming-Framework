// generated: schema_gen/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SchemaGenHandler: Send + Sync {
    async fn generate(
        &self,
        input: SchemaGenGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaGenGenerateOutput, Box<dyn std::error::Error>>;

    async fn register(
        &self,
        input: SchemaGenRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaGenRegisterOutput, Box<dyn std::error::Error>>;

}
