// generated: field_mapping/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FieldMappingHandler: Send + Sync {
    async fn map(
        &self,
        input: FieldMappingMapInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingMapOutput, Box<dyn std::error::Error>>;

    async fn apply(
        &self,
        input: FieldMappingApplyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingApplyOutput, Box<dyn std::error::Error>>;

    async fn reverse(
        &self,
        input: FieldMappingReverseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingReverseOutput, Box<dyn std::error::Error>>;

    async fn auto_discover(
        &self,
        input: FieldMappingAutoDiscoverInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingAutoDiscoverOutput, Box<dyn std::error::Error>>;

    async fn validate(
        &self,
        input: FieldMappingValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FieldMappingValidateOutput, Box<dyn std::error::Error>>;

}
