// generated: page_as_record/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait PageAsRecordHandler: Send + Sync {
    async fn create(
        &self,
        input: PageAsRecordCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordCreateOutput, Box<dyn std::error::Error>>;

    async fn set_property(
        &self,
        input: PageAsRecordSetPropertyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordSetPropertyOutput, Box<dyn std::error::Error>>;

    async fn get_property(
        &self,
        input: PageAsRecordGetPropertyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordGetPropertyOutput, Box<dyn std::error::Error>>;

    async fn append_to_body(
        &self,
        input: PageAsRecordAppendToBodyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordAppendToBodyOutput, Box<dyn std::error::Error>>;

    async fn attach_to_schema(
        &self,
        input: PageAsRecordAttachToSchemaInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordAttachToSchemaOutput, Box<dyn std::error::Error>>;

    async fn convert_from_freeform(
        &self,
        input: PageAsRecordConvertFromFreeformInput,
        storage: &dyn ConceptStorage,
    ) -> Result<PageAsRecordConvertFromFreeformOutput, Box<dyn std::error::Error>>;

}
