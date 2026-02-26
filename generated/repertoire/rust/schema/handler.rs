// generated: schema/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SchemaHandler: Send + Sync {
    async fn define_schema(
        &self,
        input: SchemaDefineSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaDefineSchemaOutput, Box<dyn std::error::Error>>;

    async fn add_field(
        &self,
        input: SchemaAddFieldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaAddFieldOutput, Box<dyn std::error::Error>>;

    async fn extend_schema(
        &self,
        input: SchemaExtendSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaExtendSchemaOutput, Box<dyn std::error::Error>>;

    async fn apply_to(
        &self,
        input: SchemaApplyToInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaApplyToOutput, Box<dyn std::error::Error>>;

    async fn remove_from(
        &self,
        input: SchemaRemoveFromInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaRemoveFromOutput, Box<dyn std::error::Error>>;

    async fn get_associations(
        &self,
        input: SchemaGetAssociationsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaGetAssociationsOutput, Box<dyn std::error::Error>>;

    async fn export(
        &self,
        input: SchemaExportInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SchemaExportOutput, Box<dyn std::error::Error>>;

}
