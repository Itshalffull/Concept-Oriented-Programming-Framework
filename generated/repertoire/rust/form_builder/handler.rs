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

    async fn validate(
        &self,
        input: FormBuilderValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormBuilderValidateOutput, Box<dyn std::error::Error>>;

    async fn process_submission(
        &self,
        input: FormBuilderProcessSubmissionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormBuilderProcessSubmissionOutput, Box<dyn std::error::Error>>;

    async fn register_widget(
        &self,
        input: FormBuilderRegisterWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormBuilderRegisterWidgetOutput, Box<dyn std::error::Error>>;

    async fn get_widget(
        &self,
        input: FormBuilderGetWidgetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FormBuilderGetWidgetOutput, Box<dyn std::error::Error>>;

}
