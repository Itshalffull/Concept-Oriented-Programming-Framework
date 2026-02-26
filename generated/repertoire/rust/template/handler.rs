// generated: template/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TemplateHandler: Send + Sync {
    async fn define(
        &self,
        input: TemplateDefineInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemplateDefineOutput, Box<dyn std::error::Error>>;

    async fn instantiate(
        &self,
        input: TemplateInstantiateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemplateInstantiateOutput, Box<dyn std::error::Error>>;

    async fn register_trigger(
        &self,
        input: TemplateRegisterTriggerInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemplateRegisterTriggerOutput, Box<dyn std::error::Error>>;

    async fn merge_properties(
        &self,
        input: TemplateMergePropertiesInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TemplateMergePropertiesOutput, Box<dyn std::error::Error>>;

}
