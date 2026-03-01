// generated: form_builder/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FormBuilderHandler: Send + Sync {
    async fn build_form(
        &self,
        input: FormBuilderBuildFormInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormBuilderBuildFormOutput, Box<dyn std::error::Error>>;

}
