// generated: u_i_schema/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait UISchemaHandler: Send + Sync {
    async fn inspect(
        &self,
        input: UISchemaInspectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UISchemaInspectOutput, Box<dyn std::error::Error>>;

    async fn override(
        &self,
        input: UISchemaOverrideInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UISchemaOverrideOutput, Box<dyn std::error::Error>>;

    async fn get_schema(
        &self,
        input: UISchemaGetSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UISchemaGetSchemaOutput, Box<dyn std::error::Error>>;

    async fn get_elements(
        &self,
        input: UISchemaGetElementsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<UISchemaGetElementsOutput, Box<dyn std::error::Error>>;

}
