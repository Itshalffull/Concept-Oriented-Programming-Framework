// generated: article/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait ArticleHandler: Send + Sync {
    async fn create(
        &self,
        input: ArticleCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleCreateOutput, Box<dyn std::error::Error>>;

    async fn update(
        &self,
        input: ArticleUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleUpdateOutput, Box<dyn std::error::Error>>;

    async fn delete(
        &self,
        input: ArticleDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleDeleteOutput, Box<dyn std::error::Error>>;

    async fn get(
        &self,
        input: ArticleGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleGetOutput, Box<dyn std::error::Error>>;

    async fn list(
        &self,
        input: ArticleListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleListOutput, Box<dyn std::error::Error>>;

}
