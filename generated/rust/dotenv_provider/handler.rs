// generated: dotenv_provider/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait DotenvProviderHandler: Send + Sync {
    async fn fetch(
        &self,
        input: DotenvProviderFetchInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DotenvProviderFetchOutput, Box<dyn std::error::Error>>;

}
