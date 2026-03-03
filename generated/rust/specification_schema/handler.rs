// generated: specification_schema/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait SpecificationSchemaHandler: Send + Sync {
    async fn define(
        &self,
        input: SpecificationSchemaDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecificationSchemaDefineOutput, Box<dyn std::error::Error>>;

    async fn instantiate(
        &self,
        input: SpecificationSchemaInstantiateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecificationSchemaInstantiateOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: SpecificationSchemaValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecificationSchemaValidateOutput, Box<dyn std::error::Error>>;

    async fn list_by_category(
        &self,
        input: SpecificationSchemaList_by_categoryInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecificationSchemaList_by_categoryOutput, Box<dyn std::error::Error>>;

    async fn search(
        &self,
        input: SpecificationSchemaSearchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<SpecificationSchemaSearchOutput, Box<dyn std::error::Error>>;

}