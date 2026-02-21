// generated: taxonomy/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait TaxonomyHandler: Send + Sync {
    async fn create_vocabulary(
        &self,
        input: TaxonomyCreateVocabularyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomyCreateVocabularyOutput, Box<dyn std::error::Error>>;

    async fn add_term(
        &self,
        input: TaxonomyAddTermInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomyAddTermOutput, Box<dyn std::error::Error>>;

    async fn set_parent(
        &self,
        input: TaxonomySetParentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomySetParentOutput, Box<dyn std::error::Error>>;

    async fn tag_entity(
        &self,
        input: TaxonomyTagEntityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomyTagEntityOutput, Box<dyn std::error::Error>>;

    async fn untag_entity(
        &self,
        input: TaxonomyUntagEntityInput,
        storage: &dyn ConceptStorage,
    ) -> Result<TaxonomyUntagEntityOutput, Box<dyn std::error::Error>>;

}
