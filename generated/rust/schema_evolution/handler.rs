// generated: schema_evolution/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SchemaEvolutionHandler: Send + Sync {
    async fn register(
        &self,
        input: SchemaEvolutionRegisterInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionRegisterOutput, Box<dyn std::error::Error>>;

    async fn check(
        &self,
        input: SchemaEvolutionCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionCheckOutput, Box<dyn std::error::Error>>;

    async fn upcast(
        &self,
        input: SchemaEvolutionUpcastInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionUpcastOutput, Box<dyn std::error::Error>>;

    async fn resolve(
        &self,
        input: SchemaEvolutionResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionResolveOutput, Box<dyn std::error::Error>>;

    async fn get_schema(
        &self,
        input: SchemaEvolutionGetSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaEvolutionGetSchemaOutput, Box<dyn std::error::Error>>;

}
